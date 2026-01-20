'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { fetchOperatorApi, getNetworkAdmin } from '@/lib/network-admin-api';

const POLLING_INTERVAL = 15000; // 15 seconds

interface DashboardStats {
  todayWashes: number;
  activeWashes: number;
  completedToday: number;
  totalDrivers: number;
}

interface WashEvent {
  id: string;
  status: string;
  tractorPlateManual?: string;
  createdAt: string;
  location?: { name: string };
}

export default function NetworkAdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    todayWashes: 0,
    activeWashes: 0,
    completedToday: 0,
    totalDrivers: 0,
  });
  const [recentWashes, setRecentWashes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const loadDashboardData = useCallback(async (isPolling = false) => {
    // Don't show loading spinner for polling updates
    if (!isPolling) {
      setLoading(true);
    }
    try {
      // Load locations first to get wash events from ALL locations
      const locations = await fetchOperatorApi<any[]>('/operator/locations');
      let allWashEvents: WashEvent[] = [];

      if (locations.length > 0) {
        // Load wash events for ALL locations
        const eventPromises = locations.map((loc: { id: string; name: string }) =>
          fetchOperatorApi<{ data: WashEvent[] }>(`/operator/wash-events?locationId=${loc.id}&limit=100`)
            .then(data => (data.data || []).map((e: WashEvent) => ({ ...e, location: { name: loc.name } })))
            .catch(() => [])
        );
        const results = await Promise.all(eventPromises);
        allWashEvents = results.flat().sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }

      // Load drivers count
      let driversCount = 0;
      try {
        const drivers = await fetchOperatorApi<any[]>('/operator/drivers');
        driversCount = drivers.length;
      } catch {
        // ignore
      }

      // Calculate stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayWashes = allWashEvents.filter(
        (w) => new Date(w.createdAt) >= today
      );
      const activeWashes = allWashEvents.filter(
        (w) => w.status === 'IN_PROGRESS' || w.status === 'AUTHORIZED'
      );
      const completedToday = todayWashes.filter(
        (w) => w.status === 'COMPLETED'
      );

      setStats({
        todayWashes: todayWashes.length,
        activeWashes: activeWashes.length,
        completedToday: completedToday.length,
        totalDrivers: driversCount,
      });

      // Get recent washes (last 5)
      const recent = allWashEvents.slice(0, 5).map((w) => ({
        id: w.id,
        status: w.status,
        location: w.location?.name || 'Unknown',
        plate: w.tractorPlateManual || '-',
        time: formatTimeAgo(new Date(w.createdAt)),
      }));
      setRecentWashes(recent);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load and polling setup
  useEffect(() => {
    loadDashboardData();

    // Set up polling interval
    intervalRef.current = setInterval(() => {
      loadDashboardData(true);
    }, POLLING_INTERVAL);

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [loadDashboardData]);

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'most';
    if (diffMins < 60) return `${diffMins} perce`;
    if (diffHours < 24) return `${diffHours} órája`;
    return `${diffDays} napja`;
  };

  const statCards = [
    { label: 'Mai mosások', value: stats.todayWashes, icon: '🚿', color: 'bg-blue-500' },
    { label: 'Aktív most', value: stats.activeWashes, icon: '⏳', color: 'bg-yellow-500' },
    { label: 'Ma befejezett', value: stats.completedToday, icon: '✅', color: 'bg-green-500' },
    { label: 'Összes sofőr', value: stats.totalDrivers, icon: '👤', color: 'bg-purple-500' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Betöltés...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vezérlőpult</h1>
          <p className="text-gray-500">Mosási műveletek áttekintése</p>
        </div>
        <Link
          href="/network-admin/wash-events/new"
          className="px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
        >
          + Új mosás
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-xl shadow-sm p-6"
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 ${stat.color} rounded-xl flex items-center justify-center text-white text-2xl`}>
                {stat.icon}
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-sm text-gray-500">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Legutóbbi tevékenység</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {recentWashes.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              Nincs aktivitás
            </div>
          ) : (
            recentWashes.map((wash) => (
              <div key={wash.id} className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${
                    wash.status === 'COMPLETED' ? 'bg-green-500' :
                    wash.status === 'IN_PROGRESS' ? 'bg-blue-500' :
                    'bg-yellow-500'
                  }`} />
                  <div>
                    <p className="font-medium text-gray-900">{wash.plate}</p>
                    <p className="text-sm text-gray-500">{wash.location}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                    wash.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                    wash.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {wash.status.replace('_', ' ')}
                  </span>
                  <p className="text-xs text-gray-400 mt-1">{wash.time}</p>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="px-6 py-4 border-t border-gray-200">
          <Link
            href="/network-admin/wash-events"
            className="text-primary-600 hover:text-primary-700 text-sm font-medium"
          >
            Összes mosás megtekintése →
          </Link>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Link
          href="/network-admin/wash-events/new"
          className="bg-white rounded-xl shadow-sm p-6 hover:bg-gray-50 transition-colors"
        >
          <div className="text-3xl mb-2">➕</div>
          <h3 className="font-semibold text-gray-900">Új mosás</h3>
          <p className="text-sm text-gray-500">Manuális rögzítés</p>
        </Link>
        <Link
          href="/network-admin/wash-events"
          className="bg-white rounded-xl shadow-sm p-6 hover:bg-gray-50 transition-colors"
        >
          <div className="text-3xl mb-2">📋</div>
          <h3 className="font-semibold text-gray-900">Mosások</h3>
          <p className="text-sm text-gray-500">Mosások listája</p>
        </Link>
        <Link
          href="/network-admin/partners"
          className="bg-white rounded-xl shadow-sm p-6 hover:bg-gray-50 transition-colors"
        >
          <div className="text-3xl mb-2">🏢</div>
          <h3 className="font-semibold text-gray-900">Partnerek</h3>
          <p className="text-sm text-gray-500">Cégek kezelése</p>
        </Link>
        <Link
          href="/network-admin/locations"
          className="bg-white rounded-xl shadow-sm p-6 hover:bg-gray-50 transition-colors"
        >
          <div className="text-3xl mb-2">📍</div>
          <h3 className="font-semibold text-gray-900">Helyszínek</h3>
          <p className="text-sm text-gray-500">Mosóállomások</p>
        </Link>
        <Link
          href="/network-admin/drivers"
          className="bg-white rounded-xl shadow-sm p-6 hover:bg-gray-50 transition-colors"
        >
          <div className="text-3xl mb-2">👥</div>
          <h3 className="font-semibold text-gray-900">Sofőrök</h3>
          <p className="text-sm text-gray-500">Sofőrök kezelése</p>
        </Link>
      </div>
    </div>
  );
}
