'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getSession, getDriver, DriverInfo } from '@/lib/session';
import { api, WashEvent } from '@/lib/api';

type WashStatus = 'CREATED' | 'AUTHORIZED' | 'IN_PROGRESS' | 'COMPLETED' | 'LOCKED' | 'REJECTED';

const statusConfig: Record<WashStatus, { label: string; labelHu: string; color: string; bgColor: string }> = {
  CREATED: { label: 'Created', labelHu: 'Várakozik', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  AUTHORIZED: { label: 'Authorized', labelHu: 'Engedélyezve', color: 'text-green-700', bgColor: 'bg-green-100' },
  IN_PROGRESS: { label: 'In Progress', labelHu: 'Folyamatban', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  COMPLETED: { label: 'Completed', labelHu: 'Befejezve', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  LOCKED: { label: 'Locked', labelHu: 'Lezárva', color: 'text-purple-700', bgColor: 'bg-purple-100' },
  REJECTED: { label: 'Rejected', labelHu: 'Elutasítva', color: 'text-red-700', bgColor: 'bg-red-100' },
};

export default function WashDetailPage() {
  const router = useRouter();
  const params = useParams();
  const washId = params.id as string;

  const [driver, setDriver] = useState<DriverInfo | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [washEvent, setWashEvent] = useState<WashEvent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [elapsedTime, setElapsedTime] = useState(0);

  const loadWashEvent = useCallback(async (session: string) => {
    try {
      const event = await api.getWashEvent(session, washId);
      setWashEvent(event);
    } catch (err: any) {
      setError(err.message || 'Failed to load wash event');
    } finally {
      setIsLoading(false);
    }
  }, [washId]);

  useEffect(() => {
    const session = getSession();
    const driverInfo = getDriver();

    if (!session || !driverInfo) {
      router.replace('/login');
      return;
    }

    setSessionId(session);
    setDriver(driverInfo);
    loadWashEvent(session);

    // Auto-refresh every 5 seconds for non-completed statuses
    const interval = setInterval(() => {
      loadWashEvent(session);
    }, 5000);

    return () => clearInterval(interval);
  }, [router, loadWashEvent]);

  // Timer for in-progress washes
  useEffect(() => {
    if (washEvent?.status !== 'IN_PROGRESS' || !washEvent.startedAt) {
      return;
    }

    const startTime = new Date(washEvent.startedAt).getTime();

    const updateElapsed = () => {
      const now = Date.now();
      setElapsedTime(Math.floor((now - startTime) / 1000));
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [washEvent?.status, washEvent?.startedAt]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartWash = async () => {
    if (!sessionId) return;

    setIsActionLoading(true);
    setError('');

    try {
      const updated = await api.startWashEvent(sessionId, washId);
      setWashEvent(updated);
    } catch (err: any) {
      setError(err.message || 'Failed to start wash');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCompleteWash = async () => {
    if (!sessionId) return;

    setIsActionLoading(true);
    setError('');

    try {
      const updated = await api.completeWashEvent(sessionId, washId);
      setWashEvent(updated);
    } catch (err: any) {
      setError(err.message || 'Failed to complete wash');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleGoHome = () => {
    router.push('/dashboard');
  };

  if (!driver || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <svg className="animate-spin w-8 h-8 text-primary-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <div className="text-gray-500">Loading wash details...</div>
        </div>
      </div>
    );
  }

  if (!washEvent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center px-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Wash Not Found</h2>
          <p className="text-gray-500 mb-6">{error || 'This wash event could not be found.'}</p>
          <button
            onClick={handleGoHome}
            className="px-6 py-3 bg-primary-600 text-white font-semibold rounded-xl"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const status = statusConfig[washEvent.status] || statusConfig.CREATED;
  const isManualMode = washEvent.location?.washMode === 'MANUAL';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-primary-600 text-white px-4 py-4 safe-area-top">
        <div className="flex items-center gap-4">
          <button
            onClick={handleGoHome}
            className="p-2 hover:bg-primary-700 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-lg font-semibold">Mosás részletei</h1>
            <p className="text-primary-200 text-sm">#{washId.slice(0, 8)}</p>
          </div>
        </div>
      </header>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* Status Card */}
      <div className="px-4 py-6">
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="text-center">
            <span className={`inline-block px-4 py-2 rounded-full text-sm font-medium ${status.bgColor} ${status.color}`}>
              {status.labelHu}
            </span>

            {/* Manual mode queue info */}
            {isManualMode && (washEvent.status === 'CREATED' || washEvent.status === 'AUTHORIZED') && (
              <div className="mt-6">
                <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-8 h-8 text-yellow-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-lg font-medium text-gray-800">Várakozás a sorban</p>
                <p className="text-sm text-gray-500 mt-1">Az operátor hamarosan indítja a mosást</p>
              </div>
            )}

            {washEvent.status === 'IN_PROGRESS' && (
              <div className="mt-6">
                <div className="text-5xl font-mono font-bold text-primary-600">
                  {formatTime(elapsedTime)}
                </div>
                <p className="text-gray-500 mt-2">Eltelt idő</p>
              </div>
            )}

            {washEvent.status === 'COMPLETED' && washEvent.startedAt && washEvent.completedAt && (
              <div className="mt-6">
                <div className="text-3xl font-mono font-bold text-green-600">
                  {formatTime(
                    Math.floor(
                      (new Date(washEvent.completedAt).getTime() - new Date(washEvent.startedAt).getTime()) / 1000
                    )
                  )}
                </div>
                <p className="text-gray-500 mt-2">Teljes időtartam</p>
              </div>
            )}

            {washEvent.status === 'REJECTED' && (
              <div className="mt-6">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <p className="text-lg font-medium text-gray-800">Mosás elutasítva</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Wash Info */}
      <div className="px-4 flex-1">
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          <h3 className="font-semibold text-gray-800">Mosás adatai</h3>

          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-500">Helyszín</span>
              <span className="font-medium text-gray-800">
                {washEvent.location?.name || washEvent.locationId.slice(0, 8)}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-500">Szolgáltatás</span>
              <span className="font-medium text-gray-800">
                {washEvent.servicePackage?.name || washEvent.servicePackageId.slice(0, 8)}
              </span>
            </div>
            {washEvent.tractorPlateManual && (
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-gray-500">Vontató</span>
                <span className="font-medium text-gray-800 font-mono">
                  {washEvent.tractorPlateManual}
                </span>
              </div>
            )}
            {washEvent.trailerPlateManual && (
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-gray-500">Pótkocsi</span>
                <span className="font-medium text-gray-800 font-mono">
                  {washEvent.trailerPlateManual}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-500">Létrehozva</span>
              <span className="font-medium text-gray-800">
                {new Date(washEvent.createdAt).toLocaleTimeString('hu-HU')}
              </span>
            </div>
            {washEvent.startedAt && (
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <span className="text-gray-500">Indítva</span>
                <span className="font-medium text-gray-800">
                  {new Date(washEvent.startedAt).toLocaleTimeString('hu-HU')}
                </span>
              </div>
            )}
            {washEvent.completedAt && (
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-500">Befejezve</span>
                <span className="font-medium text-gray-800">
                  {new Date(washEvent.completedAt).toLocaleTimeString('hu-HU')}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-4 py-6 space-y-3 safe-area-bottom">
        {/* AUTOMATIC mode: Show start/complete buttons */}
        {!isManualMode && (washEvent.status === 'CREATED' || washEvent.status === 'AUTHORIZED') && (
          <button
            onClick={handleStartWash}
            disabled={isActionLoading}
            className="w-full py-4 bg-gradient-to-r from-green-500 to-green-700
                       text-white font-semibold rounded-xl shadow-lg
                       hover:from-green-600 hover:to-green-800
                       active:scale-[0.98] transition-all
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isActionLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Indítás...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Mosás indítása
              </span>
            )}
          </button>
        )}

        {/* MANUAL mode: Show info message when waiting */}
        {isManualMode && (washEvent.status === 'CREATED' || washEvent.status === 'AUTHORIZED') && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
            <p className="text-blue-700 text-sm">
              Ez egy személyzetes mosó. Az operátor fogja elindítani a mosást amikor sorra kerülsz.
            </p>
          </div>
        )}

        {/* AUTOMATIC mode: Complete button */}
        {!isManualMode && washEvent.status === 'IN_PROGRESS' && (
          <button
            onClick={handleCompleteWash}
            disabled={isActionLoading}
            className="w-full py-4 bg-gradient-to-r from-primary-500 to-primary-700
                       text-white font-semibold rounded-xl shadow-lg
                       hover:from-primary-600 hover:to-primary-800
                       active:scale-[0.98] transition-all
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isActionLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Befejezés...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Mosás befejezése
              </span>
            )}
          </button>
        )}

        {/* MANUAL mode: In progress info */}
        {isManualMode && washEvent.status === 'IN_PROGRESS' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
            <p className="text-yellow-700 text-sm">
              A mosás folyamatban. Az operátor fogja befejezettnek jelölni.
            </p>
          </div>
        )}

        {washEvent.status === 'COMPLETED' && (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Mosás befejezve!</h3>
            <p className="text-gray-500 mb-6">Köszönjük! Indíthatsz új mosást.</p>
            <button
              onClick={handleGoHome}
              className="px-8 py-3 bg-primary-600 text-white font-semibold rounded-xl
                         hover:bg-primary-700 active:scale-[0.98] transition-all"
            >
              Vissza a főoldalra
            </button>
          </div>
        )}

        {washEvent.status === 'REJECTED' && (
          <div className="text-center">
            <button
              onClick={handleGoHome}
              className="px-8 py-3 bg-primary-600 text-white font-semibold rounded-xl
                         hover:bg-primary-700 active:scale-[0.98] transition-all"
            >
              Vissza a főoldalra
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
