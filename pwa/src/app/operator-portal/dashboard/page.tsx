'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { SessionTimeoutWarning } from '@/components/SessionTimeoutWarning';

const API_URL = 'https://api.vemiax.com';

interface WashEvent {
  id: string;
  status: string;
  createdAt: string;
  authorizedAt?: string;
  startedAt?: string;
  completedAt?: string;
  entryMode: string;
  driverNameManual?: string;
  tractorPlateManual?: string;
  trailerPlateManual?: string;
  driver?: { firstName: string; lastName: string };
  partnerCompany?: { name: string; code: string };
  servicePackage?: { name: string; code: string };
  tractorVehicle?: { plateNumber: string };
  trailerVehicle?: { plateNumber: string };
}

interface QueueData {
  inProgress: WashEvent[];
  authorized: WashEvent[];
  created: WashEvent[];
  total: number;
  washMode: string;
}

interface Statistics {
  total: number;
  byStatus: Record<string, number>;
  today: { total: number; completed: number };
}

interface OperatorInfo {
  locationId: string;
  locationName: string;
  locationCode: string;
  washMode: string;
  networkName: string;
  operationType?: string; // OWN or SUBCONTRACTOR
}

export default function OperatorDashboardPage() {
  const router = useRouter();
  const [operatorInfo, setOperatorInfo] = useState<OperatorInfo | null>(null);
  const [queue, setQueue] = useState<QueueData | null>(null);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadData = useCallback(async (session?: string) => {
    const sessionId = session || localStorage.getItem('operator_session');
    if (!sessionId) return;

    try {
      const [queueRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/operator-portal/queue`, {
          headers: { 'x-operator-session': sessionId },
        }),
        fetch(`${API_URL}/operator-portal/statistics`, {
          headers: { 'x-operator-session': sessionId },
        }),
      ]);

      if (!queueRes.ok || !statsRes.ok) {
        if (queueRes.status === 401 || statsRes.status === 401) {
          localStorage.removeItem('operator_session');
          localStorage.removeItem('operator_info');
          router.replace('/operator-portal/login');
          return;
        }
        throw new Error('Adatok betöltése sikertelen');
      }

      const queueData = await queueRes.json();
      const statsData = await statsRes.json();

      setQueue(queueData);
      setStatistics(statsData);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba történt');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const session = localStorage.getItem('operator_session');
    const info = localStorage.getItem('operator_info');

    if (!session || !info) {
      router.replace('/operator-portal/login');
      return;
    }

    setOperatorInfo(JSON.parse(info));
    loadData(session);

    // Auto-refresh every 10 seconds
    const interval = setInterval(() => loadData(session), 10000);
    return () => clearInterval(interval);
  }, [router, loadData]);

  const handleAction = async (eventId: string, action: 'authorize' | 'start' | 'complete' | 'reject', reason?: string) => {
    const sessionId = localStorage.getItem('operator_session');
    if (!sessionId) return;

    setActionLoading(eventId);

    try {
      const options: RequestInit = {
        method: 'POST',
        headers: {
          'x-operator-session': sessionId,
          'Content-Type': 'application/json',
        },
      };

      if (action === 'reject' && reason) {
        options.body = JSON.stringify({ reason });
      }

      const response = await fetch(`${API_URL}/operator-portal/wash-events/${eventId}/${action}`, options);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Művelet sikertelen');
      }

      // Reload data
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba történt');
    } finally {
      setActionLoading(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('operator_session');
    localStorage.removeItem('operator_info');
    router.replace('/operator-portal/login');
  };

  // SECURITY: Session timeout for automatic logout after inactivity
  const { showWarning, timeRemaining, dismissWarning } = useSessionTimeout({
    onTimeout: handleLogout,
    enabled: !!operatorInfo,
  });

  const getDriverName = (event: WashEvent) => {
    if (event.driver) {
      return `${event.driver.firstName} ${event.driver.lastName}`;
    }
    return event.driverNameManual || '-';
  };

  const getPlateNumber = (event: WashEvent) => {
    const tractor = event.tractorPlateManual || event.tractorVehicle?.plateNumber || '-';
    const trailer = event.trailerPlateManual || event.trailerVehicle?.plateNumber;
    return trailer ? `${tractor} + ${trailer}` : tractor;
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
      CREATED: 'Várakozik',
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

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
  };

  if (!operatorInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Betöltés...</div>
      </div>
    );
  }

  const isManualMode = operatorInfo.washMode === 'MANUAL';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* SECURITY: Session timeout warning */}
      <SessionTimeoutWarning
        show={showWarning}
        timeRemaining={timeRemaining}
        onExtend={dismissWarning}
        onLogout={handleLogout}
      />

      {/* Header */}
      <header className="bg-green-600 text-white px-4 py-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{operatorInfo.locationName}</h1>
            <p className="text-green-200 text-sm">
              {operatorInfo.locationCode} - {isManualMode ? 'Személyzetes mosó' : 'Automata mosó'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/docs/operator?from=operator')}
              className="px-4 py-2 bg-green-700 hover:bg-green-800 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              Súgó
            </button>
            <button
              onClick={() => router.push('/operator-portal/bookings')}
              className="px-4 py-2 bg-green-700 hover:bg-green-800 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Foglalások
            </button>
            {/* Billing menu for subcontractors */}
            {operatorInfo?.operationType === 'SUBCONTRACTOR' && (
              <div className="relative group">
                <button className="px-4 py-2 bg-green-700 hover:bg-green-800 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Számlázás
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  <button
                    onClick={() => router.push('/operator-portal/billing/partners')}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Partner cégek
                  </button>
                  <button
                    onClick={() => router.push('/operator-portal/billing/statements')}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Kimutatások
                  </button>
                  <button
                    onClick={() => router.push('/operator-portal/billing/invoices')}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Számlák
                  </button>
                  <hr className="my-1" />
                  <button
                    onClick={() => router.push('/operator-portal/billing/settings')}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Beállítások
                  </button>
                </div>
              </div>
            )}
            <button
              onClick={() => router.push('/operator-portal/new-wash')}
              className="px-4 py-2 bg-white text-green-600 hover:bg-green-50 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Új Mosás
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-green-700 hover:bg-green-800 rounded-lg text-sm transition-colors"
            >
              Kijelentkezés
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Statistics Cards */}
        {statistics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="text-3xl font-bold text-green-600">{statistics.today.total}</div>
              <div className="text-sm text-gray-500">Mai mosások</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="text-3xl font-bold text-blue-600">{statistics.today.completed}</div>
              <div className="text-sm text-gray-500">Befejezett</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="text-3xl font-bold text-yellow-600">
                {queue?.inProgress.length || 0}
              </div>
              <div className="text-sm text-gray-500">Folyamatban</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="text-3xl font-bold text-gray-600">
                {(queue?.authorized.length || 0) + (queue?.created.length || 0)}
              </div>
              <div className="text-sm text-gray-500">Várakozik</div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-600">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-8 text-gray-500">Betöltés...</div>
        ) : (
          <>
            {/* In Progress */}
            {queue && queue.inProgress.length > 0 && (
              <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4 mb-6">
                <h2 className="text-lg font-semibold text-yellow-800 mb-4 flex items-center gap-2">
                  <span className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></span>
                  Folyamatban lévő mosás
                </h2>
                {queue.inProgress.map((event) => (
                  <div key={event.id} className="bg-white rounded-lg p-4 shadow-sm">
                    <div className="flex flex-wrap gap-4 items-center justify-between">
                      <div className="flex-1 min-w-[200px]">
                        <div className="text-lg font-bold font-mono">{getPlateNumber(event)}</div>
                        <div className="text-sm text-gray-600">{getDriverName(event)}</div>
                        <div className="text-sm text-gray-500">{event.partnerCompany?.name}</div>
                        <div className="text-xs text-gray-400 mt-1">
                          Kezdve: {event.startedAt ? formatTime(event.startedAt) : '-'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-700">{event.servicePackage?.name}</div>
                        {getStatusBadge(event.status)}
                      </div>
                      {isManualMode && (
                        <button
                          onClick={() => handleAction(event.id, 'complete')}
                          disabled={actionLoading === event.id}
                          className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50"
                        >
                          {actionLoading === event.id ? 'Feldolgozás...' : 'Befejezés'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Authorized Queue */}
            {queue && queue.authorized.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                <h2 className="text-lg font-semibold text-blue-800 mb-4">
                  Engedélyezett - Várakozik indításra ({queue.authorized.length})
                </h2>
                <div className="space-y-3">
                  {queue.authorized.map((event, index) => (
                    <div key={event.id} className="bg-white rounded-lg p-4 shadow-sm">
                      <div className="flex flex-wrap gap-4 items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                            {index + 1}
                          </div>
                          <div>
                            <div className="font-bold font-mono">{getPlateNumber(event)}</div>
                            <div className="text-sm text-gray-600">{getDriverName(event)}</div>
                            <div className="text-xs text-gray-500">{event.partnerCompany?.name}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium text-gray-700">{event.servicePackage?.name}</div>
                          <div className="text-xs text-gray-500">
                            Érk: {formatTime(event.createdAt)}
                          </div>
                        </div>
                        {isManualMode && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleAction(event.id, 'start')}
                              disabled={actionLoading === event.id || queue.inProgress.length > 0}
                              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
                              title={queue.inProgress.length > 0 ? 'Először fejezd be a folyamatban lévő mosást' : ''}
                            >
                              {actionLoading === event.id ? '...' : 'Indítás'}
                            </button>
                            <button
                              onClick={() => {
                                const reason = prompt('Elutasítás oka:');
                                if (reason) handleAction(event.id, 'reject', reason);
                              }}
                              disabled={actionLoading === event.id}
                              className="px-4 py-2 bg-red-100 text-red-600 rounded-lg font-medium hover:bg-red-200 disabled:opacity-50"
                            >
                              Elutasít
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Created (Pending Authorization) */}
            {queue && queue.created.length > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6">
                <h2 className="text-lg font-semibold text-gray-700 mb-4">
                  Jóváhagyásra vár ({queue.created.length})
                </h2>
                <div className="space-y-3">
                  {queue.created.map((event) => (
                    <div key={event.id} className="bg-white rounded-lg p-4 shadow-sm">
                      <div className="flex flex-wrap gap-4 items-center justify-between">
                        <div>
                          <div className="font-bold font-mono">{getPlateNumber(event)}</div>
                          <div className="text-sm text-gray-600">{getDriverName(event)}</div>
                          <div className="text-xs text-gray-500">{event.partnerCompany?.name}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium text-gray-700">{event.servicePackage?.name}</div>
                          <div className="text-xs text-gray-500">
                            Érk: {formatTime(event.createdAt)}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAction(event.id, 'authorize')}
                            disabled={actionLoading === event.id}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
                          >
                            {actionLoading === event.id ? '...' : 'Jóváhagy'}
                          </button>
                          <button
                            onClick={() => {
                              const reason = prompt('Elutasítás oka:');
                              if (reason) handleAction(event.id, 'reject', reason);
                            }}
                            disabled={actionLoading === event.id}
                            className="px-4 py-2 bg-red-100 text-red-600 rounded-lg font-medium hover:bg-red-200 disabled:opacity-50"
                          >
                            Elutasít
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {queue && queue.total === 0 && (
              <div className="bg-white rounded-xl shadow-sm p-8 text-center">
                <div className="text-gray-400 mb-2">
                  <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="text-lg text-gray-600 font-medium">Nincs várakozó mosás</div>
                <div className="text-sm text-gray-400 mt-1">
                  Az új mosások automatikusan megjelennek
                </div>
              </div>
            )}
          </>
        )}

        {/* Manual Mode Info */}
        {isManualMode && (
          <div className="mt-6 bg-green-50 border border-green-200 rounded-xl p-4">
            <h3 className="font-semibold text-green-800 mb-2">Személyzetes üzemmód</h3>
            <ul className="text-sm text-green-700 space-y-1">
              <li>1. A sofőrök QR kóddal regisztrálják magukat a sorba</li>
              <li>2. Te hagyod jóvá és indítod el a mosást</li>
              <li>3. A mosás végén te jelölöd befejezettnek</li>
            </ul>
          </div>
        )}

        {!isManualMode && (
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h3 className="font-semibold text-blue-800 mb-2">Automata üzemmód</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>1. A sofőrök QR kóddal indítják a mosást</li>
              <li>2. A mosás automatikusan elindul jóváhagyás után</li>
              <li>3. A gép automatikusan befejezi a mosást</li>
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}
