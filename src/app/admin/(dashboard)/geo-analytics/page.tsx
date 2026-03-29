'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

interface AnalyticsData {
  pageviews_total: number;
  clicks_total: number;
  errors_total: number;
  engagement_total: number;
  active_sessions: number;
  scroll_depth_avg: number;
  time_on_page_avg: number;
  pageViewsByPage: Record<string, number>;
  pageViewsByCountry: Record<string, number>;
  clicksByElement: Record<string, number>;
}

// Country code to name mapping
const countryNames: Record<string, string> = {
  'US': 'United States',
  'CD': 'Congo (DRC)',
  'CG': 'Congo (Brazzaville)',
  'FR': 'France',
  'GB': 'United Kingdom',
  'BE': 'Belgium',
  'CA': 'Canada',
  'DE': 'Germany',
  'ZA': 'South Africa',
  'NG': 'Nigeria',
  'KE': 'Kenya',
  'CM': 'Cameroon',
  'SN': 'Senegal',
  'CI': "Côte d'Ivoire",
  'MA': 'Morocco',
  'EG': 'Egypt',
  'GH': 'Ghana',
  'TZ': 'Tanzania',
  'UG': 'Uganda',
  'ET': 'Ethiopia',
  'AO': 'Angola',
  'RW': 'Rwanda',
  'BI': 'Burundi',
  'unknown': 'Unknown',
};

// Country flag emoji
const countryFlags: Record<string, string> = {
  'US': '🇺🇸',
  'CD': '🇨🇩',
  'CG': '🇨🇬',
  'FR': '🇫🇷',
  'GB': '🇬🇧',
  'BE': '🇧🇪',
  'CA': '🇨🇦',
  'DE': '🇩🇪',
  'ZA': '🇿🇦',
  'NG': '🇳🇬',
  'KE': '🇰🇪',
  'CM': '🇨🇲',
  'SN': '🇸🇳',
  'CI': '🇨🇮',
  'MA': '🇲🇦',
  'EG': '🇪🇬',
  'GH': '🇬🇭',
  'TZ': '🇹🇿',
  'UG': '🇺🇬',
  'ET': '🇪🇹',
  'AO': '🇦🇴',
  'RW': '🇷🇼',
  'BI': '🇧🇮',
  'unknown': '🌍',
};

export default function GeoAnalyticsPage() {
  const { user, isAdmin } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    if (!user) {
      router.push('/');
      return;
    }
    if (!isAdmin) {
      router.push('/');
      return;
    }
  }, [user, isAdmin, router]);

  const fetchAnalytics = async () => {
    try {
      const response = await fetch('/api/analytics');
      if (!response.ok) throw new Error('Failed to fetch analytics');
      
      const text = await response.text();
      
      // Parse Prometheus metrics format
      const parsed: AnalyticsData = {
        pageviews_total: 0,
        clicks_total: 0,
        errors_total: 0,
        engagement_total: 0,
        active_sessions: 0,
        scroll_depth_avg: 0,
        time_on_page_avg: 0,
        pageViewsByPage: {},
        pageViewsByCountry: {},
        clicksByElement: {},
      };

      const lines = text.split('\n');
      for (const line of lines) {
        if (line.startsWith('#') || !line.trim()) continue;

        // Parse total pageviews
        if (line.startsWith('liprobakin_pageviews_total ') && !line.includes('{')) {
          const match = line.match(/liprobakin_pageviews_total\s+(\d+)/);
          if (match) parsed.pageviews_total = parseInt(match[1]);
        }

        // Parse pageviews by country
        if (line.includes('liprobakin_pageviews_country_total{country=')) {
          const match = line.match(/liprobakin_pageviews_country_total\{country="([^"]+)"\}\s+(\d+)/);
          if (match) {
            parsed.pageViewsByCountry[match[1]] = parseInt(match[2]);
          }
        }

        // Parse pageviews by page
        if (line.includes('liprobakin_pageviews_total{page=')) {
          const match = line.match(/liprobakin_pageviews_total\{page="([^"]+)"\}\s+(\d+)/);
          if (match) {
            parsed.pageViewsByPage[match[1]] = parseInt(match[2]);
          }
        }

        // Parse clicks
        if (line.startsWith('liprobakin_clicks_total ') && !line.includes('{')) {
          const match = line.match(/liprobakin_clicks_total\s+(\d+)/);
          if (match) parsed.clicks_total = parseInt(match[1]);
        }

        // Parse errors
        if (line.startsWith('liprobakin_errors_total ')) {
          const match = line.match(/liprobakin_errors_total\s+(\d+)/);
          if (match) parsed.errors_total = parseInt(match[1]);
        }

        // Parse engagement
        if (line.startsWith('liprobakin_engagement_total ')) {
          const match = line.match(/liprobakin_engagement_total\s+(\d+)/);
          if (match) parsed.engagement_total = parseInt(match[1]);
        }

        // Parse active sessions
        if (line.startsWith('liprobakin_active_sessions ')) {
          const match = line.match(/liprobakin_active_sessions\s+(\d+)/);
          if (match) parsed.active_sessions = parseInt(match[1]);
        }

        // Parse scroll depth avg
        if (line.startsWith('liprobakin_scroll_depth_avg ') && !line.includes('{')) {
          const match = line.match(/liprobakin_scroll_depth_avg\s+([\d.]+)/);
          if (match) parsed.scroll_depth_avg = parseFloat(match[1]);
        }

        // Parse time on page avg
        if (line.startsWith('liprobakin_time_on_page_seconds_avg ') && !line.includes('{')) {
          const match = line.match(/liprobakin_time_on_page_seconds_avg\s+([\d.]+)/);
          if (match) parsed.time_on_page_avg = parseFloat(match[1]);
        }
      }

      setData(parsed);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  if (!user || !isAdmin) {
    return null;
  }

  const sortedCountries = data
    ? Object.entries(data.pageViewsByCountry)
        .sort(([, a], [, b]) => b - a)
    : [];

  const totalCountryViews = sortedCountries.reduce((sum, [, count]) => sum + count, 0);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-3 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">🌍 Geographic Analytics</h1>
            <p className="text-gray-400 mt-1 text-sm sm:text-base">
              See where your visitors are coming from
            </p>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            {lastUpdated && (
              <span className="text-gray-400 text-xs sm:text-sm">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={fetchAnalytics}
              className="px-3 py-2 sm:px-4 bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors text-sm sm:text-base"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {loading && !data && (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
          </div>
        )}

        {error && (
          <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 mb-6">
            <p className="text-red-400">Error: {error}</p>
          </div>
        )}

        {data && (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
              <div className="bg-gray-800 rounded-xl p-4 sm:p-6">
                <div className="text-xl sm:text-3xl font-bold text-orange-500">{data.pageviews_total.toLocaleString()}</div>
                <div className="text-gray-400 mt-1 text-xs sm:text-base">Total Pageviews</div>
              </div>
              <div className="bg-gray-800 rounded-xl p-4 sm:p-6">
                <div className="text-xl sm:text-3xl font-bold text-blue-500">{data.active_sessions}</div>
                <div className="text-gray-400 mt-1 text-xs sm:text-base">Active Sessions</div>
              </div>
              <div className="bg-gray-800 rounded-xl p-4 sm:p-6">
                <div className="text-xl sm:text-3xl font-bold text-green-500">{sortedCountries.length}</div>
                <div className="text-gray-400 mt-1 text-xs sm:text-base">Countries</div>
              </div>
              <div className="bg-gray-800 rounded-xl p-4 sm:p-6">
                <div className="text-xl sm:text-3xl font-bold text-purple-500">{Math.round(data.time_on_page_avg)}s</div>
                <div className="text-gray-400 mt-1 text-xs sm:text-base">Avg Time on Page</div>
              </div>
            </div>

            {/* Country Map & List */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* Country List */}
              <div className="bg-gray-800 rounded-xl p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl font-bold mb-4">📍 Visitors by Country</h2>
                
                {sortedCountries.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <div className="text-6xl mb-4">🌍</div>
                    <p className="text-lg">No geographic data yet</p>
                    <p className="text-sm mt-2">
                      Geographic data is collected from production traffic.<br/>
                      Local development (localhost) shows as &quot;Unknown&quot;.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sortedCountries.map(([country, count], index) => {
                      const percentage = totalCountryViews > 0 ? (count / totalCountryViews) * 100 : 0;
                      const flag = countryFlags[country] || '🏳️';
                      const name = countryNames[country] || country;
                      
                      return (
                        <div key={country} className="relative">
                          <div className="flex items-center justify-between relative z-10 py-2">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">{flag}</span>
                              <span className="font-medium">{name}</span>
                              {index === 0 && (
                                <span className="bg-orange-500 text-xs px-2 py-1 rounded">Top</span>
                              )}
                            </div>
                            <div className="text-right">
                              <span className="font-bold">{count.toLocaleString()}</span>
                              <span className="text-gray-400 ml-2">({percentage.toFixed(1)}%)</span>
                            </div>
                          </div>
                          <div className="absolute bottom-0 left-0 h-full bg-orange-500/20 rounded"
                               style={{ width: `${percentage}%` }} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Top Pages */}
              <div className="bg-gray-800 rounded-xl p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl font-bold mb-4">📄 Top Pages</h2>
                
                {Object.keys(data.pageViewsByPage).length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <div className="text-6xl mb-4">📊</div>
                    <p className="text-lg">No page data yet</p>
                    <p className="text-sm mt-2">Visit some pages to see statistics.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(data.pageViewsByPage)
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 10)
                      .map(([page, count]) => {
                        const percentage = data.pageviews_total > 0 
                          ? (count / data.pageviews_total) * 100 
                          : 0;
                        
                        return (
                          <div key={page} className="relative">
                            <div className="flex items-center justify-between relative z-10 py-2">
                              <span className="font-mono text-xs sm:text-sm truncate max-w-[140px] sm:max-w-[200px]">{page}</span>
                              <div className="text-right">
                                <span className="font-bold">{count.toLocaleString()}</span>
                                <span className="text-gray-400 ml-2">({percentage.toFixed(1)}%)</span>
                              </div>
                            </div>
                            <div className="absolute bottom-0 left-0 h-full bg-blue-500/20 rounded"
                                 style={{ width: `${percentage}%` }} />
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>

            {/* Info Box */}
            <div className="mt-6 sm:mt-8 bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-bold text-blue-400 mb-2">ℹ️ About Geographic Tracking</h3>
              <ul className="text-gray-300 space-y-2 text-sm">
                <li>• <strong>Local Development:</strong> Shows as &quot;Unknown&quot; because localhost IPs (::1, 127.0.0.1) have no geographic data</li>
                <li>• <strong>Production (liprobakin.com):</strong> Automatically tracks real visitor locations using Vercel&apos;s geo headers</li>
                <li>• <strong>Data Collection:</strong> Country is captured on every pageview event</li>
                <li>• <strong>Refresh Rate:</strong> This page auto-refreshes every 30 seconds</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
