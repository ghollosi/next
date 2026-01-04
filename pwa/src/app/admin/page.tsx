'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface DashboardStats {
  todayWashes: number;
  activeWashes: number;
  completedToday: number;
  totalDrivers: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    todayWashes: 0,
    activeWashes: 0,
    completedToday: 0,
    totalDrivers: 0,
  });
  const [recentWashes, setRecentWashes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // For now, use mock data - will connect to API later
      // In production, this would fetch from /api/admin/dashboard
      setStats({
        todayWashes: 5,
        activeWashes: 1,
        completedToday: 4,
        totalDrivers: 12,
      });

      setRecentWashes([
        {
          id: '1',
          status: 'COMPLETED',
          location: 'Main Wash Station',
          plate: 'ABC123',
          time: '10 min ago',
        },
        {
          id: '2',
          status: 'IN_PROGRESS',
          location: 'Main Wash Station',
          plate: 'XYZ789',
          time: '5 min ago',
        },
      ]);
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { label: "Today's Washes", value: stats.todayWashes, icon: '🚿', color: 'bg-blue-500' },
    { label: 'Active Now', value: stats.activeWashes, icon: '⏳', color: 'bg-yellow-500' },
    { label: 'Completed Today', value: stats.completedToday, icon: '✅', color: 'bg-green-500' },
    { label: 'Total Drivers', value: stats.totalDrivers, icon: '👤', color: 'bg-purple-500' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">Overview of wash operations</p>
        </div>
        <Link
          href="/admin/wash-events/new"
          className="px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
        >
          + New Wash Event
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
          <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {recentWashes.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              No recent activity
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
            href="/admin/wash-events"
            className="text-primary-600 hover:text-primary-700 text-sm font-medium"
          >
            View all wash events →
          </Link>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          href="/admin/wash-events/new"
          className="bg-white rounded-xl shadow-sm p-6 hover:bg-gray-50 transition-colors"
        >
          <div className="text-3xl mb-2">➕</div>
          <h3 className="font-semibold text-gray-900">New Wash</h3>
          <p className="text-sm text-gray-500">Create manual entry</p>
        </Link>
        <Link
          href="/admin/wash-events"
          className="bg-white rounded-xl shadow-sm p-6 hover:bg-gray-50 transition-colors"
        >
          <div className="text-3xl mb-2">📋</div>
          <h3 className="font-semibold text-gray-900">View All</h3>
          <p className="text-sm text-gray-500">Wash event list</p>
        </Link>
        <Link
          href="/admin/locations"
          className="bg-white rounded-xl shadow-sm p-6 hover:bg-gray-50 transition-colors"
        >
          <div className="text-3xl mb-2">📍</div>
          <h3 className="font-semibold text-gray-900">Locations</h3>
          <p className="text-sm text-gray-500">Manage wash stations</p>
        </Link>
        <Link
          href="/admin/drivers"
          className="bg-white rounded-xl shadow-sm p-6 hover:bg-gray-50 transition-colors"
        >
          <div className="text-3xl mb-2">👥</div>
          <h3 className="font-semibold text-gray-900">Drivers</h3>
          <p className="text-sm text-gray-500">Manage drivers</p>
        </Link>
      </div>
    </div>
  );
}
