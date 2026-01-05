'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface WashEvent {
  id: string;
  status: string;
  entryMode: string;
  tractorPlateManual?: string;
  trailerPlateManual?: string;
  vehicleType?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  notes?: string;
  location?: {
    id: string;
    name: string;
    code: string;
    address?: string;
    city?: string;
  };
  servicePackage?: {
    id: string;
    name: string;
    code: string;
  };
  partnerCompany?: {
    id: string;
    name: string;
  };
  driver?: {
    id: string;
    name: string;
    phone?: string;
  };
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const NETWORK_ID = 'cf808392-6283-4487-9fbd-e72951ca5bf8';

const statusColors: Record<string, string> = {
  CREATED: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  AUTHORIZED: 'bg-blue-100 text-blue-700 border-blue-200',
  IN_PROGRESS: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  COMPLETED: 'bg-green-100 text-green-700 border-green-200',
  LOCKED: 'bg-gray-100 text-gray-700 border-gray-200',
  REJECTED: 'bg-red-100 text-red-700 border-red-200',
};

const statusLabels: Record<string, string> = {
  CREATED: 'Létrehozva',
  AUTHORIZED: 'Engedélyezve',
  IN_PROGRESS: 'Folyamatban',
  COMPLETED: 'Befejezve',
  LOCKED: 'Lezárva',
  REJECTED: 'Elutasítva',
};

const vehicleTypeLabels: Record<string, string> = {
  SEMI_TRUCK: 'Nyerges szerelvény',
  GRAIN_CARRIER: 'Gabonaszállító',
  TRAILER_ONLY: 'Csak pótkocsi',
  CONTAINER_CARRIER: 'Konténer szállító',
  TRACTOR: 'Traktor',
  TRUCK_1_5T: 'Tehergépjármű 1,5t-ig',
  TRUCK_3_5T: 'Tehergépjármű 3,5t-ig',
  TRUCK_7_5T: 'Tehergépjármű 7,5t-ig',
  TRUCK_12T: 'Tehergépjármű 12t-ig',
  TRUCK_12T_PLUS: 'Tehergépjármű 12t felett',
  TANK_SOLO: 'Tartályautó (szóló)',
  TANK_12T: 'Tartályautó 12t-ig',
  TANK_TRUCK: 'Tartályautó',
  TANK_SEMI_TRAILER: 'Tartályfélpótkocsi',
  CAR: 'Személygépkocsi',
  BUS: 'Autóbusz',
};

export default function WashEventDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;

  const [event, setEvent] = useState<WashEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (eventId) {
      loadEvent();
    }
  }, [eventId]);

  const loadEvent = async () => {
    try {
      const response = await fetch(`${API_URL}/operator/wash-events/${eventId}`, {
        headers: { 'x-network-id': NETWORK_ID },
      });

      if (response.ok) {
        const data = await response.json();
        setEvent(data);
      } else {
        throw new Error('Nem sikerült betölteni a mosási eseményt');
      }
    } catch (err: any) {
      setError(err.message || 'Hiba történt');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (action: string) => {
    setActionLoading(true);
    try {
      const response = await fetch(`${API_URL}/operator/wash-events/${eventId}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-network-id': NETWORK_ID,
          'x-user-id': 'admin-user',
        },
      });

      if (response.ok) {
        await loadEvent();
      } else {
        const data = await response.json();
        throw new Error(data.message || 'Művelet sikertelen');
      }
    } catch (err: any) {
      alert(err.message || 'Hiba történt');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('hu-HU');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-500">Betöltés...</p>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-600 mb-4">{error || 'Mosási esemény nem található'}</p>
          <Link
            href="/admin/wash-events"
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            Vissza a listához
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/admin/wash-events"
            className="text-gray-500 hover:text-gray-700 text-sm mb-2 inline-block"
          >
            &larr; Vissza a listához
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Mosási esemény</h1>
          <p className="text-gray-500 font-mono">#{event.id.slice(0, 8)}</p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`px-4 py-2 text-sm font-medium rounded-full border ${
              statusColors[event.status] || 'bg-gray-100 text-gray-700'
            }`}
          >
            {statusLabels[event.status] || event.status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Vehicle Info */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Jármű adatok</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Vontató rendszám</p>
                <p className="text-lg font-mono font-medium text-gray-900">
                  {event.tractorPlateManual || '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Pótkocsi rendszám</p>
                <p className="text-lg font-mono font-medium text-gray-900">
                  {event.trailerPlateManual || '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Jármű típus</p>
                <p className="text-gray-900">
                  {event.vehicleType ? vehicleTypeLabels[event.vehicleType] || event.vehicleType : '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Beviteli mód</p>
                <p className="text-gray-900">
                  {event.entryMode === 'QR_DRIVER' ? 'Sofőr (QR)' : 'Manuális (Operátor)'}
                </p>
              </div>
            </div>
          </div>

          {/* Location & Service */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Helyszín és szolgáltatás</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Helyszín</p>
                <p className="text-gray-900 font-medium">{event.location?.name || '-'}</p>
                <p className="text-sm text-gray-500 font-mono">{event.location?.code}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Szolgáltatás</p>
                <p className="text-gray-900 font-medium">{event.servicePackage?.name || '-'}</p>
                <p className="text-sm text-gray-500 font-mono">{event.servicePackage?.code}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Partner</p>
                <p className="text-gray-900">{event.partnerCompany?.name || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Sofőr</p>
                <p className="text-gray-900">{event.driver?.name || '-'}</p>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Időpontok</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-500">Létrehozva</span>
                <span className="font-medium">{formatDate(event.createdAt)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-500">Elkezdve</span>
                <span className="font-medium">{formatDate(event.startedAt)}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-500">Befejezve</span>
                <span className="font-medium">{formatDate(event.completedAt)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {event.notes && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Megjegyzések</h2>
              <p className="text-gray-700 whitespace-pre-wrap">{event.notes}</p>
            </div>
          )}
        </div>

        {/* Actions Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Műveletek</h2>

            {event.status === 'CREATED' && (
              <>
                <button
                  onClick={() => updateStatus('authorize')}
                  disabled={actionLoading}
                  className="w-full py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {actionLoading ? 'Feldolgozás...' : 'Engedélyezés'}
                </button>
                <button
                  onClick={() => updateStatus('reject')}
                  disabled={actionLoading}
                  className="w-full py-3 bg-red-100 text-red-700 font-medium rounded-xl hover:bg-red-200 disabled:opacity-50 transition-colors"
                >
                  Elutasítás
                </button>
              </>
            )}

            {event.status === 'AUTHORIZED' && (
              <>
                <button
                  onClick={() => updateStatus('start')}
                  disabled={actionLoading}
                  className="w-full py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {actionLoading ? 'Feldolgozás...' : 'Mosás indítása'}
                </button>
                <button
                  onClick={() => updateStatus('reject')}
                  disabled={actionLoading}
                  className="w-full py-3 bg-red-100 text-red-700 font-medium rounded-xl hover:bg-red-200 disabled:opacity-50 transition-colors"
                >
                  Elutasítás
                </button>
              </>
            )}

            {event.status === 'IN_PROGRESS' && (
              <button
                onClick={() => updateStatus('complete')}
                disabled={actionLoading}
                className="w-full py-3 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {actionLoading ? 'Feldolgozás...' : 'Mosás befejezése'}
              </button>
            )}

            {event.status === 'COMPLETED' && (
              <button
                onClick={() => updateStatus('lock')}
                disabled={actionLoading}
                className="w-full py-3 bg-gray-600 text-white font-medium rounded-xl hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                {actionLoading ? 'Feldolgozás...' : 'Lezárás'}
              </button>
            )}

            {(event.status === 'LOCKED' || event.status === 'REJECTED') && (
              <p className="text-sm text-gray-500 text-center py-4">
                Ez az esemény már {event.status === 'LOCKED' ? 'le van zárva' : 'el lett utasítva'}.
              </p>
            )}

            <hr className="my-4" />

            <Link
              href="/admin/wash-events"
              className="block w-full py-3 text-center bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
            >
              Vissza a listához
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
