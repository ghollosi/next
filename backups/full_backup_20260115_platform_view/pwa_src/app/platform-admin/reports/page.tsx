'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { platformApi } from '@/lib/platform-api';

interface NetworkStats {
  id: string;
  name: string;
  slug: string;
  subscriptionStatus: string;
  washEventsThisMonth: number;
  washEventsLastMonth: number;
  totalWashEvents: number;
  activeDrivers: number;
  activeLocations: number;
  revenue: number;
}

interface MonthlyStats {
  month: string;
  washEvents: number;
  revenue: number;
  newNetworks: number;
  newDrivers: number;
}

interface ReportsData {
  networkStats: NetworkStats[];
  monthlyStats: MonthlyStats[];
  totals: {
    totalWashEvents: number;
    totalRevenue: number;
    avgWashesPerNetwork: number;
    avgWashesPerLocation: number;
  };
}

export default function PlatformReportsPage() {
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState<'month' | 'quarter' | 'year'>('month');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadReports();
  }, [selectedPeriod]);

  const loadReports = async () => {
    try {
      setLoading(true);
      const reports = await platformApi.getReports(selectedPeriod);
      setData(reports);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba tortent');
    } finally {
      setLoading(false);
    }
  };

  const exportToCsv = async (type: 'networks' | 'monthly') => {
    if (!data) return;

    setExporting(true);
    try {
      let csvContent = '';

      if (type === 'networks') {
        csvContent = 'Halozat;Statusz;Mosasok (honap);Mosasok (elozo honap);Osszes mosas;Soforok;Helyszinek;Bevetel\n';
        data.networkStats.forEach(n => {
          csvContent += `${n.name};${n.subscriptionStatus};${n.washEventsThisMonth};${n.washEventsLastMonth};${n.totalWashEvents};${n.activeDrivers};${n.activeLocations};${n.revenue}\n`;
        });
      } else {
        csvContent = 'Honap;Mosasok;Bevetel;Uj halozatok;Uj soforok\n';
        data.monthlyStats.forEach(m => {
          csvContent += `${m.month};${m.washEvents};${m.revenue};${m.newNetworks};${m.newDrivers}\n`;
        });
      }

      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `platform-report-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
    } finally {
      setExporting(false);
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

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/platform-admin/dashboard"
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">Riportok</h1>
            <p className="text-gray-400">Platform statisztikak es jelentesek</p>
          </div>
        </div>

        {/* Period selector */}
        <div className="flex items-center gap-2 bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setSelectedPeriod('month')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              selectedPeriod === 'month'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Honap
          </button>
          <button
            onClick={() => setSelectedPeriod('quarter')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              selectedPeriod === 'quarter'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Negyedev
          </button>
          <button
            onClick={() => setSelectedPeriod('year')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              selectedPeriod === 'year'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Ev
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-400">Osszes mosas</p>
              <p className="text-2xl font-bold text-white">{data.totals.totalWashEvents.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-600/20 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-400">Osszes bevetel</p>
              <p className="text-2xl font-bold text-white">{data.totals.totalRevenue.toLocaleString()} Ft</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-400">Atlag/halozat</p>
              <p className="text-2xl font-bold text-white">{data.totals.avgWashesPerNetwork.toFixed(1)}</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-600/20 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-400">Atlag/helyszin</p>
              <p className="text-2xl font-bold text-white">{data.totals.avgWashesPerLocation.toFixed(1)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Network Stats Table */}
      <div className="bg-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Halozatok teljesitmenye</h2>
          <button
            onClick={() => exportToCsv('networks')}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-gray-400 text-sm border-b border-gray-700">
                <th className="pb-3 font-medium">Halozat</th>
                <th className="pb-3 font-medium">Statusz</th>
                <th className="pb-3 font-medium text-right">Mosasok (honap)</th>
                <th className="pb-3 font-medium text-right">Elozo honap</th>
                <th className="pb-3 font-medium text-right">Valtozas</th>
                <th className="pb-3 font-medium text-right">Osszes mosas</th>
                <th className="pb-3 font-medium text-right">Soforok</th>
                <th className="pb-3 font-medium text-right">Helyszinek</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {data.networkStats.map((network) => {
                const change = network.washEventsLastMonth > 0
                  ? ((network.washEventsThisMonth - network.washEventsLastMonth) / network.washEventsLastMonth * 100)
                  : network.washEventsThisMonth > 0 ? 100 : 0;

                return (
                  <tr key={network.id} className="text-gray-300 hover:bg-gray-700/50">
                    <td className="py-3">
                      <Link href={`/platform-admin/networks/${network.id}`} className="text-indigo-400 hover:text-indigo-300">
                        {network.name}
                      </Link>
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        network.subscriptionStatus === 'ACTIVE'
                          ? 'bg-green-500/20 text-green-400'
                          : network.subscriptionStatus === 'TRIAL'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-gray-500/20 text-gray-400'
                      }`}>
                        {network.subscriptionStatus === 'ACTIVE' ? 'Aktiv' :
                         network.subscriptionStatus === 'TRIAL' ? 'Trial' : network.subscriptionStatus}
                      </span>
                    </td>
                    <td className="py-3 text-right font-medium">{network.washEventsThisMonth}</td>
                    <td className="py-3 text-right text-gray-400">{network.washEventsLastMonth}</td>
                    <td className="py-3 text-right">
                      <span className={`flex items-center justify-end gap-1 ${
                        change > 0 ? 'text-green-400' : change < 0 ? 'text-red-400' : 'text-gray-400'
                      }`}>
                        {change > 0 && (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                          </svg>
                        )}
                        {change < 0 && (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                          </svg>
                        )}
                        {Math.abs(change).toFixed(0)}%
                      </span>
                    </td>
                    <td className="py-3 text-right">{network.totalWashEvents}</td>
                    <td className="py-3 text-right">{network.activeDrivers}</td>
                    <td className="py-3 text-right">{network.activeLocations}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Monthly Trend */}
      <div className="bg-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Havi trend</h2>
          <button
            onClick={() => exportToCsv('monthly')}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-gray-400 text-sm border-b border-gray-700">
                <th className="pb-3 font-medium">Honap</th>
                <th className="pb-3 font-medium text-right">Mosasok</th>
                <th className="pb-3 font-medium text-right">Bevetel</th>
                <th className="pb-3 font-medium text-right">Uj halozatok</th>
                <th className="pb-3 font-medium text-right">Uj soforok</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {data.monthlyStats.map((month) => (
                <tr key={month.month} className="text-gray-300 hover:bg-gray-700/50">
                  <td className="py-3 font-medium">{month.month}</td>
                  <td className="py-3 text-right">{month.washEvents.toLocaleString()}</td>
                  <td className="py-3 text-right">{month.revenue.toLocaleString()} Ft</td>
                  <td className="py-3 text-right">{month.newNetworks}</td>
                  <td className="py-3 text-right">{month.newDrivers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
