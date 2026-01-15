'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { platformApi } from '@/lib/platform-api';

interface DashboardData {
  totalNetworks: number;
  activeNetworks: number;
  trialNetworks: number;
  totalLocations: number;
  totalDrivers: number;
  washEventsThisMonth: number;
  revenueThisMonth: number;
  networksExpiringSoon: Array<{
    id: string;
    name: string;
    slug: string;
    trialEndsAt?: string;
    locationCount: number;
    driverCount: number;
  }>;
}

export default function PlatformDashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const data = await platformApi.getDashboard();
      setDashboard(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba történt');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 text-red-300">
        {error}
      </div>
    );
  }

  if (!dashboard) return null;

  const stats = [
    {
      name: 'Összes hálózat',
      value: dashboard.totalNetworks,
      icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
      color: 'bg-blue-500',
    },
    {
      name: 'Aktív hálózatok',
      value: dashboard.activeNetworks,
      icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
      color: 'bg-green-500',
    },
    {
      name: 'Trial hálózatok',
      value: dashboard.trialNetworks,
      icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
      color: 'bg-yellow-500',
    },
    {
      name: 'Összes helyszín',
      value: dashboard.totalLocations,
      icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z',
      color: 'bg-purple-500',
    },
    {
      name: 'Összes sofőr',
      value: dashboard.totalDrivers,
      icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
      color: 'bg-pink-500',
    },
    {
      name: 'Mosások (hónap)',
      value: dashboard.washEventsThisMonth,
      icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
      color: 'bg-cyan-500',
    },
  ];

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('hu-HU');
  };

  const getDaysUntil = (dateStr?: string) => {
    if (!dateStr) return null;
    const days = Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <Link
          href="/platform-admin/networks"
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
        >
          + Új hálózat
        </Link>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map((stat) => (
          <div key={stat.name} className="bg-gray-800 rounded-xl p-4">
            <div className={`w-10 h-10 ${stat.color} rounded-lg flex items-center justify-center mb-3`}>
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={stat.icon} />
              </svg>
            </div>
            <p className="text-2xl font-bold text-white">{stat.value.toLocaleString('hu-HU')}</p>
            <p className="text-sm text-gray-400">{stat.name}</p>
          </div>
        ))}
      </div>

      {/* Revenue card */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-indigo-200 text-sm font-medium">Bevétel (havi platform díjak)</p>
            <p className="text-3xl font-bold text-white mt-1">
              {dashboard.revenueThisMonth.toLocaleString('hu-HU')} Ft
            </p>
          </div>
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Expiring networks */}
      {dashboard.networksExpiringSoon.length > 0 && (
        <div className="bg-gray-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-700 flex items-center gap-2">
            <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h2 className="text-lg font-semibold text-white">Hamarosan lejáró trial-ok</h2>
          </div>
          <div className="divide-y divide-gray-700">
            {dashboard.networksExpiringSoon.map((network) => {
              const daysLeft = getDaysUntil(network.trialEndsAt);
              return (
                <Link
                  key={network.id}
                  href={`/platform-admin/networks/${network.id}`}
                  className="flex items-center justify-between px-6 py-4 hover:bg-gray-700/50 transition-colors"
                >
                  <div>
                    <p className="font-medium text-white">{network.name}</p>
                    <p className="text-sm text-gray-400">
                      {network.locationCount} helyszín, {network.driverCount} sofőr
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-medium ${daysLeft && daysLeft <= 3 ? 'text-red-400' : 'text-yellow-400'}`}>
                      {daysLeft} nap
                    </p>
                    <p className="text-sm text-gray-400">{formatDate(network.trialEndsAt)}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/platform-admin/networks"
          className="bg-gray-800 rounded-xl p-6 hover:bg-gray-700/50 transition-colors group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600/20 rounded-lg flex items-center justify-center group-hover:bg-indigo-600/30 transition-colors">
              <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-white">Hálózatok kezelése</p>
              <p className="text-sm text-gray-400">Összes hálózat áttekintése</p>
            </div>
          </div>
        </Link>

        <Link
          href="/platform-admin/settings"
          className="bg-gray-800 rounded-xl p-6 hover:bg-gray-700/50 transition-colors group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-600/20 rounded-lg flex items-center justify-center group-hover:bg-purple-600/30 transition-colors">
              <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-white">Platform beállítások</p>
              <p className="text-sm text-gray-400">Árazás, Email, SMS</p>
            </div>
          </div>
        </Link>

        <div className="bg-gray-800 rounded-xl p-6 opacity-50 cursor-not-allowed">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gray-600/20 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-gray-400">Riportok</p>
              <p className="text-sm text-gray-500">Hamarosan...</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
