'use client';

import { useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';

interface AnalyticsEvent {
  type: 'pageview' | 'click' | 'scroll' | 'time_on_page' | 'error' | 'engagement';
  page: string;
  timestamp: number;
  data?: Record<string, unknown>;
  sessionId: string;
  userId?: string;
}

// Generate or retrieve session ID
function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  
  let sessionId = sessionStorage.getItem('liprobakin_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    sessionStorage.setItem('liprobakin_session_id', sessionId);
  }
  return sessionId;
}

// Get user ID from localStorage if available
function getUserId(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return localStorage.getItem('liprobakin_user_id') || undefined;
}

// Send analytics event to our API
async function sendEvent(event: AnalyticsEvent): Promise<void> {
  try {
    // Use navigator.sendBeacon for reliability when page is closing
    const payload = JSON.stringify(event);
    
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/analytics', payload);
    } else {
      await fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      });
    }
  } catch (error) {
    console.error('Failed to send analytics event:', error);
  }
}

// Track click events with element details
function trackClick(event: MouseEvent): void {
  const target = event.target as HTMLElement;
  const clickData = {
    element: target.tagName.toLowerCase(),
    id: target.id || undefined,
    className: target.className || undefined,
    text: target.textContent?.substring(0, 100) || undefined,
    href: (target as HTMLAnchorElement).href || undefined,
    x: event.clientX,
    y: event.clientY,
  };

  sendEvent({
    type: 'click',
    page: window.location.pathname,
    timestamp: Date.now(),
    data: clickData,
    sessionId: getSessionId(),
    userId: getUserId(),
  });
}

// Track scroll depth
function createScrollTracker() {
  let maxScrollDepth = 0;
  let lastReportedDepth = 0;
  
  return function trackScroll(): void {
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollPercent = scrollHeight > 0 ? Math.round((window.scrollY / scrollHeight) * 100) : 0;
    
    if (scrollPercent > maxScrollDepth) {
      maxScrollDepth = scrollPercent;
      
      // Report at 25%, 50%, 75%, 100% milestones
      const milestones = [25, 50, 75, 100];
      for (const milestone of milestones) {
        if (maxScrollDepth >= milestone && lastReportedDepth < milestone) {
          lastReportedDepth = milestone;
          sendEvent({
            type: 'scroll',
            page: window.location.pathname,
            timestamp: Date.now(),
            data: { depth: milestone, maxDepth: maxScrollDepth },
            sessionId: getSessionId(),
            userId: getUserId(),
          });
        }
      }
    }
  };
}

// Track errors
function trackError(event: ErrorEvent): void {
  sendEvent({
    type: 'error',
    page: window.location.pathname,
    timestamp: Date.now(),
    data: {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack?.substring(0, 500),
    },
    sessionId: getSessionId(),
    userId: getUserId(),
  });
}

// Track unhandled promise rejections
function trackUnhandledRejection(event: PromiseRejectionEvent): void {
  sendEvent({
    type: 'error',
    page: window.location.pathname,
    timestamp: Date.now(),
    data: {
      message: 'Unhandled Promise Rejection',
      reason: String(event.reason).substring(0, 500),
    },
    sessionId: getSessionId(),
    userId: getUserId(),
  });
}

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const pageStartTime = useRef<number>(Date.now());
  const scrollTracker = useRef<ReturnType<typeof createScrollTracker> | null>(null);
  const engagementInterval = useRef<NodeJS.Timeout | null>(null);

  // Track page view
  const trackPageView = useCallback(() => {
    sendEvent({
      type: 'pageview',
      page: pathname,
      timestamp: Date.now(),
      data: {
        referrer: document.referrer || undefined,
        userAgent: navigator.userAgent,
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
        language: navigator.language,
      },
      sessionId: getSessionId(),
      userId: getUserId(),
    });
  }, [pathname]);

  // Track time on page
  const trackTimeOnPage = useCallback(() => {
    const timeSpent = Math.round((Date.now() - pageStartTime.current) / 1000);
    
    sendEvent({
      type: 'time_on_page',
      page: pathname,
      timestamp: Date.now(),
      data: { seconds: timeSpent },
      sessionId: getSessionId(),
      userId: getUserId(),
    });
  }, [pathname]);

  // Track engagement (periodic heartbeat)
  const trackEngagement = useCallback(() => {
    const timeSpent = Math.round((Date.now() - pageStartTime.current) / 1000);
    
    sendEvent({
      type: 'engagement',
      page: pathname,
      timestamp: Date.now(),
      data: { 
        seconds: timeSpent,
        isVisible: document.visibilityState === 'visible',
      },
      sessionId: getSessionId(),
      userId: getUserId(),
    });
  }, [pathname]);

  useEffect(() => {
    // Reset page start time on route change
    pageStartTime.current = Date.now();
    
    // Track page view
    trackPageView();

    // Initialize scroll tracker
    scrollTracker.current = createScrollTracker();

    // Set up event listeners
    document.addEventListener('click', trackClick);
    window.addEventListener('scroll', scrollTracker.current, { passive: true });
    window.addEventListener('error', trackError);
    window.addEventListener('unhandledrejection', trackUnhandledRejection);

    // Engagement heartbeat every 30 seconds
    engagementInterval.current = setInterval(trackEngagement, 30000);

    // Track time on page when leaving
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        trackTimeOnPage();
      }
    };
    
    const handleBeforeUnload = () => {
      trackTimeOnPage();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup
    return () => {
      trackTimeOnPage();
      
      document.removeEventListener('click', trackClick);
      if (scrollTracker.current) {
        window.removeEventListener('scroll', scrollTracker.current);
      }
      window.removeEventListener('error', trackError);
      window.removeEventListener('unhandledrejection', trackUnhandledRejection);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      if (engagementInterval.current) {
        clearInterval(engagementInterval.current);
      }
    };
  }, [pathname, trackPageView, trackTimeOnPage, trackEngagement]);

  return <>{children}</>;
}

// Custom hook for manual event tracking
export function useAnalytics() {
  const trackCustomEvent = useCallback((eventName: string, data?: Record<string, unknown>) => {
    sendEvent({
      type: 'engagement',
      page: window.location.pathname,
      timestamp: Date.now(),
      data: { eventName, ...data },
      sessionId: getSessionId(),
      userId: getUserId(),
    });
  }, []);

  const setUserId = useCallback((userId: string) => {
    localStorage.setItem('liprobakin_user_id', userId);
  }, []);

  return { trackCustomEvent, setUserId };
}
