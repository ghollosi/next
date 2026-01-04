'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, getDriver, DriverInfo } from '@/lib/session';
import { api, WashEvent } from '@/lib/api';

type WashStatus = 'CREATED' | 'AUTHORIZED' | 'IN_PROGRESS' | 'COMPLETED' | 'LOCKED' | 'REJECTED';

const statusConfig: Record<WashStatus, { label: string; color: string; bgColor: string }> = {
  CREATED: { label: 'Created', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  AUTHORIZED: { label: 'Authorized', color: 'text-green-700', bgColor: 'bg-green-100' },
  IN_PROGRESS: { label: 'In Progress', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  COMPLETED: { label: 'Completed', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  LOCKED: { label: 'Locked', color: 'text-red-700', bgColor: 'bg-red-100' },
  REJECTED: { label: 'Rejected', color: 'text-red-700', bgColor: 'bg-red-100' },
};

export default function WashHistoryPage() {
  const router = useRouter();
  const [driver, setDriver] = useState<DriverInfo | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [washEvents, setWashEvents] = useState<WashEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const session = getSession();
    const driverInfo = getDriver();

    if (!session || !driverInfo) {
      router.replace('/login');
      return;
    }

    setSessionId(session);
    setDriver(driverInfo);
    loadHistory(session);
  }, [router]);

  const loadHistory = async (session: string) => {
    try {
      const events = await api.getWashHistory(session);
      setWashEvents(events);
    } catch (err: any) {
      setError(err.message || 'Failed to load history');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  const handleSelectWash = (washId: string) => {
    router.push(`/wash/${washId}`);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const calculateDuration = (start?: string, end?: string) => {
    if (!start || !end) return null;
    const seconds = Math.floor(
      (new Date(end).getTime() - new Date(start).getTime()) / 1000
    );
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!driver) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-primary-600 text-white px-4 py-4 safe-area-top">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="p-2 hover:bg-primary-700 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-lg font-semibold">Wash History</h1>
            <p className="text-primary-200 text-sm">{washEvents.length} washes</p>
          </div>
        </div>
      </header>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 px-4 py-6 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <svg className="animate-spin w-8 h-8 text-primary-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        ) : washEvents.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">No Wash History</h3>
            <p className="text-gray-500">You haven't completed any washes yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {washEvents.map((event) => {
              const status = statusConfig[event.status] || statusConfig.CREATED;
              const duration = calculateDuration(event.startedAt, event.completedAt);

              return (
                <button
                  key={event.id}
                  onClick={() => handleSelectWash(event.id)}
                  className="w-full bg-white rounded-xl shadow-sm p-4 text-left
                             hover:bg-gray-50 active:bg-gray-100 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.bgColor} ${status.color}`}>
                          {status.label}
                        </span>
                        {duration && (
                          <span className="text-xs text-gray-500">
                            {duration}
                          </span>
                        )}
                      </div>
                      <p className="font-medium text-gray-800">
                        {event.location?.name || 'Unknown Location'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {event.servicePackage?.name || 'Service'} • {formatDate(event.createdAt)}
                      </p>
                      {event.tractorPlateManual && (
                        <p className="text-xs text-gray-400 font-mono mt-1">
                          🚛 {event.tractorPlateManual}
                          {event.trailerPlateManual && ` + ${event.trailerPlateManual}`}
                        </p>
                      )}
                    </div>
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Safe Area */}
      <div className="safe-area-bottom" />
    </div>
  );
}
