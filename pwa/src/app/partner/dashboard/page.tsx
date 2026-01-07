'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

interface WashEvent {
  id: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  location?: { name: string; code: string };
  servicePackage?: { name: string };
  driver?: { firstName: string; lastName: string };
  tractorPlateManual?: string;
  trailerPlateManual?: string;
  tractorVehicle?: { plateNumber: string };
  trailerVehicle?: { plateNumber: string };
}

interface Statistics {
  total: number;
  byStatus: Record<string, number>;
  byLocation: Record<string, number>;
  byService: Record<string, number>;
}

interface PartnerInfo {
  partnerId: string;
  partnerName: string;
  partnerCode: string;
}

export default function PartnerDashboardPage() {
  const router = useRouter();
  const [partnerInfo, setPartnerInfo] = useState<PartnerInfo | null>(null);
  const [washEvents, setWashEvents] = useState<WashEvent[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [statusFilter, setStatusFilter] = useState('');

  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const session = localStorage.getItem('partner_session');
    const info = localStorage.getItem('partner_info');

    if (!session || !info) {
      router.replace('/partner/login');
      return;
    }

    setPartnerInfo(JSON.parse(info));
    loadData(session);
  }, [router]);

  const loadData = async (session?: string) => {
    const sessionId = session || localStorage.getItem('partner_session');
    if (!sessionId) return;

    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (statusFilter) params.append('status', statusFilter);

      const [eventsRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/partner-portal/wash-events?${params}`, {
          headers: { 'x-partner-session': sessionId },
        }),
        fetch(`${API_URL}/partner-portal/statistics?${params}`, {
          headers: { 'x-partner-session': sessionId },
        }),
      ]);

      if (!eventsRes.ok || !statsRes.ok) {
        if (eventsRes.status === 401 || statsRes.status === 401) {
          localStorage.removeItem('partner_session');
          localStorage.removeItem('partner_info');
          router.replace('/partner/login');
          return;
        }
        throw new Error('Adatok betöltése sikertelen');
      }

      const eventsData = await eventsRes.json();
      const statsData = await statsRes.json();

      setWashEvents(eventsData.data || []);
      setStatistics(statsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba történt');
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = () => {
    loadData();
  };

  const handleExport = async () => {
    const sessionId = localStorage.getItem('partner_session');
    if (!sessionId) return;

    setExporting(true);

    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await fetch(`${API_URL}/partner-portal/wash-events/export?${params}`, {
        headers: { 'x-partner-session': sessionId },
      });

      if (!response.ok) {
        throw new Error('Export sikertelen');
      }

      const data = await response.json();

      // Create and download CSV file
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + data.data], { type: 'text/csv;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export sikertelen');
    } finally {
      setExporting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('partner_session');
    localStorage.removeItem('partner_info');
    router.replace('/partner/login');
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      CREATED: 'bg-gray-100 text-gray-800',
      AUTHORIZED: 'bg-blue-100 text-blue-800',
      IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
      COMPLETED: 'bg-green-100 text-green-800',
      LOCKED: 'bg-purple-100 text-purple-800',
      REJECTED: 'bg-red-100 text-red-800',
    };
    const labels: Record<string, string> = {
      CREATED: 'Létrehozva',
      AUTHORIZED: 'Engedélyezve',
      IN_PROGRESS: 'Folyamatban',
      COMPLETED: 'Befejezve',
      LOCKED: 'Lezárva',
      REJECTED: 'Elutasítva',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100'}`}>
        {labels[status] || status}
      </span>
    );
  };

  if (!partnerInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Betöltés...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-blue-600 text-white px-4 py-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{partnerInfo.partnerName}</h1>
            <p className="text-blue-200 text-sm">Partner Portál</p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/partner/invoices"
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-sm transition-colors flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Szamlak
            </Link>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-blue-700 hover:bg-blue-800 rounded-lg text-sm transition-colors"
            >
              Kijelentkezes
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Statistics Cards */}
        {statistics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="text-3xl font-bold text-blue-600">{statistics.total}</div>
              <div className="text-sm text-gray-500">Összes mosás</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="text-3xl font-bold text-green-600">
                {statistics.byStatus['COMPLETED'] || 0}
              </div>
              <div className="text-sm text-gray-500">Befejezett</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="text-3xl font-bold text-yellow-600">
                {statistics.byStatus['IN_PROGRESS'] || 0}
              </div>
              <div className="text-sm text-gray-500">Folyamatban</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="text-3xl font-bold text-purple-600">
                {statistics.byStatus['LOCKED'] || 0}
              </div>
              <div className="text-sm text-gray-500">Lezárt</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kezdő dátum
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Befejező dátum
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Státusz
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Mind</option>
                <option value="CREATED">Létrehozva</option>
                <option value="AUTHORIZED">Engedélyezve</option>
                <option value="IN_PROGRESS">Folyamatban</option>
                <option value="COMPLETED">Befejezve</option>
                <option value="LOCKED">Lezárva</option>
              </select>
            </div>
            <button
              onClick={handleFilter}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Szűrés
            </button>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {exporting ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Exportálás...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Excel export
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-600">
            {error}
          </div>
        )}

        {/* Wash Events Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">Mosási események</h2>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-500">Betöltés...</div>
          ) : washEvents.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              Nincs találat a megadott szűrőkkel
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Dátum
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Helyszín
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Szolgáltatás
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rendszám
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sofőr
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Státusz
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {washEvents.map((event) => (
                    <tr key={event.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {new Date(event.createdAt).toLocaleString('hu-HU')}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {event.location?.name || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {event.servicePackage?.name || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-900">
                        <div>{event.tractorPlateManual || event.tractorVehicle?.plateNumber || '-'}</div>
                        {(event.trailerPlateManual || event.trailerVehicle?.plateNumber) && (
                          <div className="text-gray-500 text-xs">
                            + {event.trailerPlateManual || event.trailerVehicle?.plateNumber}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {event.driver
                          ? `${event.driver.firstName} ${event.driver.lastName}`
                          : '-'}
                      </td>
                      <td className="px-4 py-3">
                        {getStatusBadge(event.status)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
