import { NextRequest, NextResponse } from 'next/server';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Persistent metrics file path (use /tmp on Vercel to avoid read-only FS)
const METRICS_FILE = process.env.ANALYTICS_METRICS_FILE
  || (process.env.VERCEL ? '/tmp/analytics-metrics.json' : join(process.cwd(), '.analytics-metrics.json'));

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

type MetricsData = {
  pageviews_total: number;
  clicks_total: number;
  scroll_depth_sum: number;
  scroll_depth_count: number;
  time_on_page_sum: number;
  time_on_page_count: number;
  errors_total: number;
  engagement_total: number;
  active_sessions: string[];
  last_event_time: number;
  pageViewsByPage: Record<string, number>;
  pageViewsByCountry: Record<string, number>;
  clicksByElement: Record<string, number>;
  timeOnPageByPage: Record<string, { sum: number; count: number }>;
  scrollDepthByPage: Record<string, { sum: number; count: number }>;
};

// Load metrics from file or initialize defaults
function loadMetrics(): MetricsData {
  try {
    if (existsSync(METRICS_FILE)) {
      const data = readFileSync(METRICS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      parsed.pageViewsByCountry = parsed.pageViewsByCountry || {};
      return parsed;
    }
  } catch (error) {
    console.error('Error loading metrics:', error);
  }
  return {
    pageviews_total: 0,
    clicks_total: 0,
    scroll_depth_sum: 0,
    scroll_depth_count: 0,
    time_on_page_sum: 0,
    time_on_page_count: 0,
    errors_total: 0,
    engagement_total: 0,
    active_sessions: [],
    last_event_time: Date.now(),
    pageViewsByPage: {},
    pageViewsByCountry: {},
    clicksByElement: {},
    timeOnPageByPage: {},
    scrollDepthByPage: {},
  };
}

// Save metrics to file
function saveMetrics(data: MetricsData): void {
  try {
    writeFileSync(METRICS_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error saving metrics:', error);
  }
}

// Initialize from file
let persistentMetrics = loadMetrics();

// In-memory session tracking (sessions are ephemeral)
const activeSessionsSet = new Set<string>(persistentMetrics.active_sessions);
const recentEvents: AnalyticsEvent[] = [];

// Simple in-memory IP -> country cache to reduce remote lookups
const geoCache = new Map<string, { country: string; expires: number }>();

function getClientIp(req: NextRequest): string | null {
  const vercelCountry = req.headers.get('x-vercel-ip-country');
  if (vercelCountry) return `vercel-${vercelCountry}`; // use country header directly

  const forwarded = req.headers.get('x-forwarded-for') || '';
  const first = forwarded.split(',')[0]?.trim();
  if (first) return first;
  const cf = req.headers.get('cf-connecting-ip');
  if (cf) return cf;
  const real = req.headers.get('x-real-ip');
  if (real) return real;
  // NextRequest.ip is available on Vercel runtimes
  if ((req as any).ip) return (req as any).ip as string;
  return null;
}

async function lookupCountry(ip: string): Promise<string> {
  const now = Date.now();
  const cached = geoCache.get(ip);
  if (cached && cached.expires > now) return cached.country;

  // If the IP already encodes a country (vercel-XX), short-circuit
  if (ip.startsWith('vercel-')) {
    const country = ip.replace('vercel-', '') || 'unknown';
    geoCache.set(ip, { country, expires: now + 60 * 60 * 1000 });
    return country;
  }

  try {
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/country/`, { next: { revalidate: 3600 } });
    if (res.ok) {
      const country = (await res.text()).trim() || 'unknown';
      geoCache.set(ip, { country, expires: now + 60 * 60 * 1000 });
      return country;
    }
  } catch (error) {
    console.error('Geo lookup failed', error);
  }

  return 'unknown';
}

// Clean up stale sessions (older than 30 minutes)
function cleanupStaleSessions() {
  const now = Date.now();
  if (now - persistentMetrics.last_event_time > 30 * 60 * 1000) {
    activeSessionsSet.clear();
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
    const clientIp = getClientIp(request);
    const country = eventType === 'pageview' && clientIp ? await lookupCountry(clientIp) : 'unknown';

    // Update last event time
    persistentMetrics.last_event_time = Date.now();
    cleanupStaleSessions();

    // Update metrics based on event type
    if (eventType === 'pageview') {
      persistentMetrics.pageviews_total++;
      if (sessionId) {
        activeSessionsSet.add(sessionId);
      }
      // Track by page
      persistentMetrics.pageViewsByPage[page] = (persistentMetrics.pageViewsByPage[page] || 0) + 1;
      // Track by country
      persistentMetrics.pageViewsByCountry[country] = (persistentMetrics.pageViewsByCountry[country] || 0) + 1;
    } else if (eventType === 'click') {
      persistentMetrics.clicks_total++;
      // Track by element type
      persistentMetrics.clicksByElement[element] = (persistentMetrics.clicksByElement[element] || 0) + 1;
    } else if (eventType === 'scroll') {
      const depth = data.depth || data.maxDepth || value || 0;
      persistentMetrics.scroll_depth_sum += depth;
      persistentMetrics.scroll_depth_count++;
      // Track by page
      if (!persistentMetrics.scrollDepthByPage[page]) {
        persistentMetrics.scrollDepthByPage[page] = { sum: 0, count: 0 };
      }
      persistentMetrics.scrollDepthByPage[page].sum += depth;
      persistentMetrics.scrollDepthByPage[page].count++;
    } else if (eventType === 'time_on_page') {
      const seconds = data.seconds || value || 0;
      persistentMetrics.time_on_page_sum += seconds;
      persistentMetrics.time_on_page_count++;
      // Track by page
      if (!persistentMetrics.timeOnPageByPage[page]) {
        persistentMetrics.timeOnPageByPage[page] = { sum: 0, count: 0 };
      }
      persistentMetrics.timeOnPageByPage[page].sum += seconds;
      persistentMetrics.timeOnPageByPage[page].count++;
    } else if (eventType === 'error') {
      persistentMetrics.errors_total++;
    } else if (eventType === 'engagement') {
      persistentMetrics.engagement_total++;
      if (sessionId) {
        activeSessionsSet.add(sessionId);
      }
    }

    // Store event in memory (not persisted)
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

    // Save to file (persist across restarts)
    persistentMetrics.active_sessions = Array.from(activeSessionsSet);
    saveMetrics(persistentMetrics);

    console.log(`[Analytics] ${eventType} event from session ${sessionId?.substring(0, 15)}... on ${page}`);
    
    return NextResponse.json({ success: true, event: eventType });
  } catch (error: unknown) {
    console.error('Analytics error:', error);
    return NextResponse.json({ error: 'Failed to process analytics event' }, { status: 400 });
  }
}

export async function GET() {
  // Reload from file to get latest data
  persistentMetrics = loadMetrics();
  
  // Clean up stale sessions before reporting
  cleanupStaleSessions();
  
  // Prometheus metrics format
  const scrollDepthAvg = persistentMetrics.scroll_depth_count > 0 
    ? persistentMetrics.scroll_depth_sum / persistentMetrics.scroll_depth_count 
    : 0;
  const timeOnPageAvg = persistentMetrics.time_on_page_count > 0 
    ? persistentMetrics.time_on_page_sum / persistentMetrics.time_on_page_count 
    : 0;
  const activeSessions = activeSessionsSet.size;

  // Build page-level metrics
  let pageViewsMetrics = '';
  for (const [page, count] of Object.entries(persistentMetrics.pageViewsByPage)) {
    pageViewsMetrics += `liprobakin_pageviews_total{page="${page}"} ${count}\n`;
  }

  let countryViewsMetrics = '';
  for (const [country, count] of Object.entries(persistentMetrics.pageViewsByCountry)) {
    countryViewsMetrics += `liprobakin_pageviews_country_total{country="${country}"} ${count}\n`;
  }

  let clicksMetrics = '';
  for (const [element, count] of Object.entries(persistentMetrics.clicksByElement)) {
    clicksMetrics += `liprobakin_clicks_total{element="${element}"} ${count}\n`;
  }

  let timeOnPageMetrics = '';
  for (const [page, data] of Object.entries(persistentMetrics.timeOnPageByPage)) {
    const avg = data.count > 0 ? data.sum / data.count : 0;
    timeOnPageMetrics += `liprobakin_time_on_page_seconds_avg{page="${page}"} ${avg.toFixed(2)}\n`;
  }

  let scrollDepthMetrics = '';
  for (const [page, data] of Object.entries(persistentMetrics.scrollDepthByPage)) {
    const avg = data.count > 0 ? data.sum / data.count : 0;
    scrollDepthMetrics += `liprobakin_scroll_depth_avg{page="${page}"} ${avg.toFixed(2)}\n`;
  }

  const prometheusMetrics = `# HELP liprobakin_total_pageviews Total number of pageviews (alias for dashboard compatibility)
# TYPE liprobakin_total_pageviews counter
liprobakin_total_pageviews ${persistentMetrics.pageviews_total}

# HELP liprobakin_pageviews_total Total number of pageviews by page
# TYPE liprobakin_pageviews_total counter
liprobakin_pageviews_total ${persistentMetrics.pageviews_total}
${pageViewsMetrics}
# HELP liprobakin_pageviews_country_total Total number of pageviews by country
# TYPE liprobakin_pageviews_country_total counter
${countryViewsMetrics}
# HELP liprobakin_clicks_total Total number of clicks by element
# TYPE liprobakin_clicks_total counter
liprobakin_clicks_total ${persistentMetrics.clicks_total}
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
liprobakin_errors_total ${persistentMetrics.errors_total}

# HELP liprobakin_engagement_total Total engagement heartbeats
# TYPE liprobakin_engagement_total counter
liprobakin_engagement_total ${persistentMetrics.engagement_total}

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
