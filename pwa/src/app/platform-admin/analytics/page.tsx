'use client';

import { useEffect, useState, useMemo } from 'react';
import { platformApi } from '@/lib/platform-api';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface AnalyticsStats {
  pageviews: number;
  visitors: number;
  visits: number;
  bounces: number;
  totaltime: number;
}

interface TimeSeriesData {
  x: string;
  y: number;
}

interface MetricData {
  x: string;
  y: number;
}

type DateRange = '24h' | '7d' | '30d' | '90d';

const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316', '#eab308'];

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>('7d');
  const [activeVisitors, setActiveVisitors] = useState(0);

  // Stats
  const [stats, setStats] = useState<AnalyticsStats | null>(null);

  // Time series
  const [pageviews, setPageviews] = useState<TimeSeriesData[]>([]);
  const [sessions, setSessions] = useState<TimeSeriesData[]>([]);

  // Metrics
  const [countries, setCountries] = useState<MetricData[]>([]);
  const [browsers, setBrowsers] = useState<MetricData[]>([]);
  const [devices, setDevices] = useState<MetricData[]>([]);
  const [referrers, setReferrers] = useState<MetricData[]>([]);
  const [pages, setPages] = useState<MetricData[]>([]);

  const getDateRange = useMemo(() => {
    const now = Date.now();
    let startAt: number;
    let unit: 'hour' | 'day' = 'day';

    switch (dateRange) {
      case '24h':
        startAt = now - 24 * 60 * 60 * 1000;
        unit = 'hour';
        break;
      case '7d':
        startAt = now - 7 * 24 * 60 * 60 * 1000;
        break;
      case '30d':
        startAt = now - 30 * 24 * 60 * 60 * 1000;
        break;
      case '90d':
        startAt = now - 90 * 24 * 60 * 60 * 1000;
        break;
    }

    return { startAt, endAt: now, unit };
  }, [dateRange]);

  const loadData = async () => {
    setLoading(true);
    setError('');

    try {
      const { startAt, endAt, unit } = getDateRange;

      // Load all data in parallel
      const [
        statsData,
        pageviewsData,
        countriesData,
        browsersData,
        devicesData,
        referrersData,
        pagesData,
        activeData,
      ] = await Promise.all([
        platformApi.getAnalyticsStats(startAt, endAt),
        platformApi.getAnalyticsPageviews(startAt, endAt, unit),
        platformApi.getAnalyticsMetrics(startAt, endAt, 'country'),
        platformApi.getAnalyticsMetrics(startAt, endAt, 'browser'),
        platformApi.getAnalyticsMetrics(startAt, endAt, 'device'),
        platformApi.getAnalyticsMetrics(startAt, endAt, 'referrer'),
        platformApi.getAnalyticsMetrics(startAt, endAt, 'path'),  // Umami v3: 'path' instead of 'url'
        platformApi.getAnalyticsActive(),
      ]);

      setStats(statsData);
      setPageviews(pageviewsData.pageviews || []);
      setSessions(pageviewsData.sessions || []);
      setCountries(countriesData || []);
      setBrowsers(browsersData || []);
      setDevices(devicesData || []);
      setReferrers(referrersData || []);
      setPages(pagesData || []);
      setActiveVisitors(activeData.visitors || 0);
    } catch (err: any) {
      setError(err.message || 'Hiba az analytics adatok betoltese soran');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Refresh active visitors every 30 seconds
    const interval = setInterval(async () => {
      try {
        const data = await platformApi.getAnalyticsActive();
        setActiveVisitors(data.visitors || 0);
      } catch {
        // Ignore errors for active visitors refresh
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [dateRange]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (dateRange === '24h') {
      return date.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' });
  };

  const bounceRate = stats ? Math.round((stats.bounces / Math.max(stats.visits, 1)) * 100) : 0;
  const avgSessionDuration = stats ? Math.round(stats.totaltime / Math.max(stats.visits, 1)) : 0;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get country flag emoji
  const getCountryFlag = (countryCode: string) => {
    if (!countryCode || countryCode.length !== 2) return '';
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Landing Page Analytics</h1>
          <p className="text-gray-400">www.vemiax.com latogatottsagi adatok</p>
        </div>
        <div className="flex items-center gap-4">
          {/* Active visitors indicator */}
          <div className="flex items-center gap-2 bg-green-900/30 border border-green-700 rounded-lg px-4 py-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-green-400 font-medium">{activeVisitors} aktiv latogato</span>
          </div>

          {/* Date range selector */}
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as DateRange)}
            className="bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="24h">Utolso 24 ora</option>
            <option value="7d">Utolso 7 nap</option>
            <option value="30d">Utolso 30 nap</option>
            <option value="90d">Utolso 90 nap</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 text-red-300">
          {error}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Osszes megtekinets</p>
              <p className="text-3xl font-bold text-white mt-1">{stats?.pageviews?.toLocaleString() || 0}</p>
            </div>
            <div className="w-12 h-12 bg-indigo-500/20 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Egyedi latogatok</p>
              <p className="text-3xl font-bold text-white mt-1">{stats?.visitors?.toLocaleString() || 0}</p>
            </div>
            <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Lepattanasi rata</p>
              <p className="text-3xl font-bold text-white mt-1">{bounceRate}%</p>
            </div>
            <div className="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Atl. munkamenet ido</p>
              <p className="text-3xl font-bold text-white mt-1">{formatDuration(avgSessionDuration)}</p>
            </div>
            <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pageviews Chart */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Megtekintesek idoben</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={pageviews.map(p => ({ date: formatDate(p.x), value: p.y }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sessions Chart */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Munkamenetek idoben</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sessions.map(s => ({ date: formatDate(s.x), value: s.y }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} />
                <YAxis stroke="#9ca3af" fontSize={12} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Line type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Countries */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Orszagok</h3>
          <div className="space-y-3">
            {countries.slice(0, 8).map((country, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{getCountryFlag(country.x)}</span>
                  <span className="text-gray-300">{country.x || 'Ismeretlen'}</span>
                </div>
                <span className="text-white font-medium">{country.y}</span>
              </div>
            ))}
            {countries.length === 0 && (
              <p className="text-gray-500 text-center py-4">Nincs adat</p>
            )}
          </div>
        </div>

        {/* Browsers */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Bongeszok</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={browsers.slice(0, 5).map((b, i) => ({ name: b.x || 'Ismeretlen', value: b.y }))}
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {browsers.slice(0, 5).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Devices */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Eszkozok</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={devices.map(d => ({ name: d.x || 'Ismeretlen', value: d.y }))} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis type="number" stroke="#9ca3af" fontSize={12} />
                <YAxis dataKey="name" type="category" stroke="#9ca3af" fontSize={12} width={80} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                />
                <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Pages */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Top oldalak</h3>
          <div className="space-y-3">
            {pages.slice(0, 10).map((page, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-gray-300 truncate max-w-[70%]">{page.x || '/'}</span>
                <span className="text-white font-medium">{page.y}</span>
              </div>
            ))}
            {pages.length === 0 && (
              <p className="text-gray-500 text-center py-4">Nincs adat</p>
            )}
          </div>
        </div>

        {/* Referrers */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Forrasok (referrer)</h3>
          <div className="space-y-3">
            {referrers.slice(0, 10).map((ref, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-gray-300 truncate max-w-[70%]">{ref.x || 'Kozvetlen'}</span>
                <span className="text-white font-medium">{ref.y}</span>
              </div>
            ))}
            {referrers.length === 0 && (
              <p className="text-gray-500 text-center py-4">Nincs adat</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
