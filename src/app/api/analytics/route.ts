import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

// Type definitions
type AnalyticsEvent = {
  timestamp: string;
  event_type?: string;
  session_id?: string;
  page?: string;
  url?: string;
  element?: string;
  value?: number;
  data?: Record<string, unknown>;
  [key: string]: unknown;
};

// In-memory cache for active sessions (ephemeral is fine for this)
const activeSessionsSet = new Set<string>();
const recentEvents: AnalyticsEvent[] = [];
let lastEventTime = Date.now();

// Simple in-memory IP -> country cache to reduce remote lookups
const geoCache = new Map<string, { country: string; expires: number }>();

function getClientIp(req: NextRequest): string | null {
  // Vercel provides country code directly in headers
  const vercelCountry = req.headers.get('x-vercel-ip-country');
  if (vercelCountry) return `vercel-${vercelCountry}`;

  const forwarded = req.headers.get('x-forwarded-for') || '';
  const first = forwarded.split(',')[0]?.trim();
  if (first) return first;
  const cf = req.headers.get('cf-connecting-ip');
  if (cf) return cf;
  const real = req.headers.get('x-real-ip');
  if (real) return real;
  if ((req as any).ip) return (req as any).ip as string;
  return null;
}

async function lookupCountry(ip: string): Promise<string> {
  const now = Date.now();
  const cached = geoCache.get(ip);
  if (cached && cached.expires > now) return cached.country;

  // If the IP already encodes a country (vercel-XX), short-circuit
  if (ip.startsWith('vercel-')) {
    const country = ip.replace('vercel-', '').toUpperCase() || 'UNKNOWN';
    geoCache.set(ip, { country, expires: now + 60 * 60 * 1000 });
    return country;
  }

  try {
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/country/`, { 
      signal: AbortSignal.timeout(3000),
      cache: 'force-cache'
    });
    if (res.ok) {
      const country = (await res.text()).trim().toUpperCase() || 'UNKNOWN';
      geoCache.set(ip, { country, expires: now + 60 * 60 * 1000 });
      return country;
    }
  } catch (error) {
    console.error('Geo lookup failed', error);
  }

  return 'UNKNOWN';
}

// Clean up stale sessions (older than 30 minutes)
function cleanupStaleSessions() {
  const now = Date.now();
  if (now - lastEventTime > 30 * 60 * 1000) {
    activeSessionsSet.clear();
  }
}

// Firestore collection for analytics metrics
const ANALYTICS_COLLECTION = 'analytics_metrics';
const METRICS_DOC_ID = 'global_metrics';

// Update metrics in Firestore atomically
async function updateFirestoreMetrics(updates: {
  pageviews_total?: number;
  clicks_total?: number;
  errors_total?: number;
  engagement_total?: number;
  scroll_depth_sum?: number;
  scroll_depth_count?: number;
  time_on_page_sum?: number;
  time_on_page_count?: number;
  pageByPagePath?: string;
  countryCode?: string;
  element?: string;
  pageForTime?: { path: string; seconds: number };
  pageForScroll?: { path: string; depth: number };
}) {
  try {
    console.log('[Analytics] Attempting Firestore update:', JSON.stringify(updates));
    const db = getAdminFirestore();
    console.log('[Analytics] Firestore instance obtained');
    const metricsRef = db.collection(ANALYTICS_COLLECTION).doc(METRICS_DOC_ID);
    
    const batch: Record<string, any> = {
      last_updated: FieldValue.serverTimestamp()
    };
    
    if (updates.pageviews_total) {
      batch['pageviews_total'] = FieldValue.increment(updates.pageviews_total);
    }
    if (updates.clicks_total) {
      batch['clicks_total'] = FieldValue.increment(updates.clicks_total);
    }
    if (updates.errors_total) {
      batch['errors_total'] = FieldValue.increment(updates.errors_total);
    }
    if (updates.engagement_total) {
      batch['engagement_total'] = FieldValue.increment(updates.engagement_total);
    }
    if (updates.scroll_depth_sum) {
      batch['scroll_depth_sum'] = FieldValue.increment(updates.scroll_depth_sum);
      batch['scroll_depth_count'] = FieldValue.increment(updates.scroll_depth_count || 1);
    }
    if (updates.time_on_page_sum) {
      batch['time_on_page_sum'] = FieldValue.increment(updates.time_on_page_sum);
      batch['time_on_page_count'] = FieldValue.increment(updates.time_on_page_count || 1);
    }
    
    // Update page views by page
    if (updates.pageByPagePath) {
      const safePage = updates.pageByPagePath.replace(/\./g, '_').replace(/\//g, '_');
      batch[`pageViewsByPage.${safePage}`] = FieldValue.increment(1);
    }
    
    // Update country pageviews - THIS IS KEY FOR GEO MAP
    if (updates.countryCode && updates.countryCode !== 'UNKNOWN') {
      batch[`pageViewsByCountry.${updates.countryCode}`] = FieldValue.increment(1);
    }
    
    // Update clicks by element
    if (updates.element) {
      const safeElement = updates.element.replace(/\./g, '_').replace(/[^a-zA-Z0-9_]/g, '_');
      batch[`clicksByElement.${safeElement}`] = FieldValue.increment(1);
    }
    
    // Update time on page by page
    if (updates.pageForTime) {
      const safePage = updates.pageForTime.path.replace(/\./g, '_').replace(/\//g, '_');
      batch[`timeOnPageByPage.${safePage}.sum`] = FieldValue.increment(updates.pageForTime.seconds);
      batch[`timeOnPageByPage.${safePage}.count`] = FieldValue.increment(1);
    }
    
    // Update scroll depth by page
    if (updates.pageForScroll) {
      const safePage = updates.pageForScroll.path.replace(/\./g, '_').replace(/\//g, '_');
      batch[`scrollDepthByPage.${safePage}.sum`] = FieldValue.increment(updates.pageForScroll.depth);
      batch[`scrollDepthByPage.${safePage}.count`] = FieldValue.increment(1);
    }
    
    await metricsRef.set(batch, { merge: true });
    console.log('[Analytics] Firestore update succeeded');
  } catch (error) {
    console.error('[Analytics] Failed to update Firestore metrics:', error);
    // Don't throw - we don't want to break analytics if Firestore fails
  }
}

// Read metrics from Firestore
async function getFirestoreMetrics() {
  try {
    console.log('[Analytics] Reading Firestore metrics');
    const db = getAdminFirestore();
    const metricsRef = db.collection(ANALYTICS_COLLECTION).doc(METRICS_DOC_ID);
    const doc = await metricsRef.get();
    
    if (doc.exists) {
      const data = doc.data() || {};
      console.log('[Analytics] Read Firestore metrics:', JSON.stringify(data).substring(0, 500));
      return data;
    }
    console.log('[Analytics] Firestore doc does not exist yet');
    return {};
  } catch (error) {
    console.error('[Analytics] Failed to read Firestore metrics:', error);
    return {};
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Support both naming conventions: type/event_type and sessionId/session_id
    const eventType = body.type || body.event_type;
    const sessionId = body.sessionId || body.session_id;
    const page = body.page || body.url || '/';
    const data = body.data || {};
    const value = data.seconds || data.depth || body.value || 0;
    const element = data.element || body.element || 'unknown';
    
    // Get country for pageviews
    const clientIp = getClientIp(request);
    const country = eventType === 'pageview' && clientIp ? await lookupCountry(clientIp) : 'UNKNOWN';

    // Update last event time and cleanup
    lastEventTime = Date.now();
    cleanupStaleSessions();

    // Track session
    if (sessionId) {
      activeSessionsSet.add(sessionId);
    }

    // Update Firestore based on event type
    if (eventType === 'pageview') {
      await updateFirestoreMetrics({
        pageviews_total: 1,
        pageByPagePath: page,
        countryCode: country
      });
      console.log(`[Analytics] pageview from ${country} on ${page}`);
    } else if (eventType === 'click') {
      await updateFirestoreMetrics({
        clicks_total: 1,
        element: element
      });
    } else if (eventType === 'scroll') {
      const depth = data.depth || data.maxDepth || value || 0;
      await updateFirestoreMetrics({
        scroll_depth_sum: depth,
        scroll_depth_count: 1,
        pageForScroll: { path: page, depth }
      });
    } else if (eventType === 'time_on_page') {
      const seconds = data.seconds || value || 0;
      await updateFirestoreMetrics({
        time_on_page_sum: seconds,
        time_on_page_count: 1,
        pageForTime: { path: page, seconds }
      });
    } else if (eventType === 'error') {
      await updateFirestoreMetrics({ errors_total: 1 });
    } else if (eventType === 'engagement') {
      await updateFirestoreMetrics({ engagement_total: 1 });
    }

    // Store event in memory (for recent events display)
    recentEvents.push({
      timestamp: new Date().toISOString(),
      event_type: eventType,
      session_id: sessionId,
      page,
      ...body,
    });

    // Keep only last 1000 recent events in memory
    if (recentEvents.length > 1000) {
      recentEvents.splice(0, recentEvents.length - 1000);
    }

    console.log(`[Analytics] ${eventType} event from session ${sessionId?.substring(0, 15)}... on ${page}`);
    
    return NextResponse.json({ success: true, event: eventType });
  } catch (error: unknown) {
    console.error('Analytics error:', error);
    return NextResponse.json({ error: 'Failed to process analytics event' }, { status: 400 });
  }
}

export async function GET() {
  // Clean up stale sessions before reporting
  cleanupStaleSessions();
  
  // Read metrics from Firestore
  const metrics = await getFirestoreMetrics();
  
  // Extract values with defaults
  const pageviews_total = metrics.pageviews_total || 0;
  const clicks_total = metrics.clicks_total || 0;
  const errors_total = metrics.errors_total || 0;
  const engagement_total = metrics.engagement_total || 0;
  const scroll_depth_sum = metrics.scroll_depth_sum || 0;
  const scroll_depth_count = metrics.scroll_depth_count || 0;
  const time_on_page_sum = metrics.time_on_page_sum || 0;
  const time_on_page_count = metrics.time_on_page_count || 0;
  const pageViewsByPage = metrics.pageViewsByPage || {};
  const pageViewsByCountry = metrics.pageViewsByCountry || {};
  const clicksByElement = metrics.clicksByElement || {};
  const timeOnPageByPage = metrics.timeOnPageByPage || {};
  const scrollDepthByPage = metrics.scrollDepthByPage || {};
  
  // Prometheus metrics format
  const scrollDepthAvg = scroll_depth_count > 0 ? scroll_depth_sum / scroll_depth_count : 0;
  const timeOnPageAvg = time_on_page_count > 0 ? time_on_page_sum / time_on_page_count : 0;
  const activeSessions = activeSessionsSet.size;

  // Build page-level metrics
  let pageViewsMetrics = '';
  for (const [page, count] of Object.entries(pageViewsByPage)) {
    const displayPage = page.replace(/_/g, '/').replace(/^_/, '/');
    pageViewsMetrics += `liprobakin_pageviews_total{page="${displayPage}"} ${count}\n`;
  }

  // Build country metrics - CRITICAL FOR GEO MAP
  let countryViewsMetrics = '';
  for (const [country, count] of Object.entries(pageViewsByCountry)) {
    if (country && country !== 'UNKNOWN') {
      countryViewsMetrics += `liprobakin_pageviews_country_total{country="${country}"} ${count}\n`;
    }
  }

  let clicksMetrics = '';
  for (const [element, count] of Object.entries(clicksByElement)) {
    clicksMetrics += `liprobakin_clicks_total{element="${element}"} ${count}\n`;
  }

  let timeOnPageMetrics = '';
  for (const [page, data] of Object.entries(timeOnPageByPage as Record<string, { sum: number; count: number }>)) {
    const avg = data.count > 0 ? data.sum / data.count : 0;
    const displayPage = page.replace(/_/g, '/').replace(/^_/, '/');
    timeOnPageMetrics += `liprobakin_time_on_page_seconds_avg{page="${displayPage}"} ${avg.toFixed(2)}\n`;
  }

  let scrollDepthMetrics = '';
  for (const [page, data] of Object.entries(scrollDepthByPage as Record<string, { sum: number; count: number }>)) {
    const avg = data.count > 0 ? data.sum / data.count : 0;
    const displayPage = page.replace(/_/g, '/').replace(/^_/, '/');
    scrollDepthMetrics += `liprobakin_scroll_depth_avg{page="${displayPage}"} ${avg.toFixed(2)}\n`;
  }

  const prometheusMetrics = `# HELP liprobakin_total_pageviews Total number of pageviews (alias for dashboard compatibility)
# TYPE liprobakin_total_pageviews counter
liprobakin_total_pageviews ${pageviews_total}

# HELP liprobakin_pageviews_total Total number of pageviews by page
# TYPE liprobakin_pageviews_total counter
liprobakin_pageviews_total ${pageviews_total}
${pageViewsMetrics}
# HELP liprobakin_pageviews_country_total Total number of pageviews by country
# TYPE liprobakin_pageviews_country_total counter
${countryViewsMetrics}
# HELP liprobakin_clicks_total Total number of clicks by element
# TYPE liprobakin_clicks_total counter
liprobakin_clicks_total ${clicks_total}
${clicksMetrics}
# HELP liprobakin_scroll_depth_avg Average scroll depth percentage by page
# TYPE liprobakin_scroll_depth_avg gauge
liprobakin_scroll_depth_avg ${scrollDepthAvg.toFixed(2)}
${scrollDepthMetrics}
# HELP liprobakin_time_on_page_seconds_avg Average time on page in seconds by page
# TYPE liprobakin_time_on_page_seconds_avg gauge
liprobakin_time_on_page_seconds_avg ${timeOnPageAvg.toFixed(2)}
${timeOnPageMetrics}
# HELP liprobakin_errors_total Total number of errors
# TYPE liprobakin_errors_total counter
liprobakin_errors_total ${errors_total}

# HELP liprobakin_engagement_total Total engagement heartbeats
# TYPE liprobakin_engagement_total counter
liprobakin_engagement_total ${engagement_total}

# HELP liprobakin_active_sessions Active user sessions
# TYPE liprobakin_active_sessions gauge
liprobakin_active_sessions ${activeSessions}

# HELP liprobakin_events_stored Number of recent events in memory
# TYPE liprobakin_events_stored gauge
liprobakin_events_stored ${recentEvents.length}
`;

  return new NextResponse(prometheusMetrics, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
