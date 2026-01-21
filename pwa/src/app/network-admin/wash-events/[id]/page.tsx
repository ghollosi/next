'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { fetchOperatorApi } from '@/lib/network-admin-api';

interface WashEventService {
  id: string;
  servicePackageId: string;
  vehicleType: string;
  unitPrice: string;
  quantity: number;
  totalPrice: string;
  vehicleRole?: string;
  plateNumber?: string;
  servicePackage?: {
    id: string;
    name: string;
    code: string;
  };
}

interface WashEvent {
  id: string;
  status: string;
  entryMode: string;
  tractorPlateManual?: string;
  trailerPlateManual?: string;
  vehicleType?: string;
  totalPrice?: string;
  finalPrice?: string;
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
  services?: WashEventService[];
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

const statusColors: Record<string, string> = {
  CREATED: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  AUTHORIZED: 'bg-blue-100 text-blue-700 border-blue-200',
  IN_PROGRESS: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  COMPLETED: 'bg-green-100 text-green-700 border-green-200',
  LOCKED: 'bg-gray-100 text-gray-700 border-gray-200',
  REJECTED: 'bg-red-100 text-red-700 border-red-200',
};

const statusLabels: Record<string, string> = {
  CREATED: 'Letrehozva',
  AUTHORIZED: 'Engedelyezve',
  IN_PROGRESS: 'Folyamatban',
  COMPLETED: 'Befejezve',
  LOCKED: 'Lezarva',
  REJECTED: 'Elutasitva',
};

const vehicleTypeLabels: Record<string, string> = {
  SEMI_TRUCK: 'Nyerges szerelveny',
  GRAIN_CARRIER: 'Gabonaszallito',
  TRAILER_ONLY: 'Csak potkocsi',
  CONTAINER_CARRIER: 'Kontener szallito',
  TRACTOR: 'Traktor',
  TRUCK_1_5T: 'Tehergepjarmu 1,5t-ig',
  TRUCK_3_5T: 'Tehergepjarmu 3,5t-ig',
  TRUCK_7_5T: 'Tehergepjarmu 7,5t-ig',
  TRUCK_12T: 'Tehergepjarmu 12t-ig',
  TRUCK_12T_PLUS: 'Tehergepjarmu 12t felett',
  TANK_SOLO: 'Tartalyauto (szolo)',
  TANK_12T: 'Tartalyauto 12t-ig',
  TANK_TRUCK: 'Tartalyauto',
  TANK_SEMI_TRAILER: 'Tartalyfelpotkocsi',
  CAR: 'Szemelygepkocsi',
  BUS: 'Autobusz',
};

export default function WashEventDetailsPage() {
  const params = useParams();
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
      const data = await fetchOperatorApi<WashEvent>(`/operator/wash-events/${eventId}`);
      setEvent(data);
    } catch (err: any) {
      setError(err.message || 'Nem sikerult betolteni a mosasi esemenyt');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (action: string, body?: object) => {
    setActionLoading(true);
    try {
      await fetchOperatorApi(`/operator/wash-events/${eventId}/${action}`, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      });
      await loadEvent();
    } catch (err: any) {
      alert(err.message || 'Muvelet sikertelen');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    const reason = prompt('Kerjuk, adja meg az elutasitas okat:');
    if (reason && reason.trim()) {
      await updateStatus('reject', { reason: reason.trim() });
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('hu-HU');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-500">Betoltes...</p>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-600 mb-4">{error || 'Mosasi esemeny nem talalhato'}</p>
          <Link
            href="/network-admin/wash-events"
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            Vissza a listahoz
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
            href="/network-admin/wash-events"
            className="text-gray-500 hover:text-gray-700 text-sm mb-2 inline-block"
          >
            &larr; Vissza a listahoz
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Mosasi esemeny</h1>
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
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Jarmu adatok</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Vontato rendszam</p>
                <p className="text-lg font-mono font-medium text-gray-900">
                  {event.tractorPlateManual || '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Potkocsi rendszam</p>
                <p className="text-lg font-mono font-medium text-gray-900">
                  {event.trailerPlateManual || '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Jarmu tipus</p>
                <p className="text-gray-900">
                  {event.vehicleType ? vehicleTypeLabels[event.vehicleType] || event.vehicleType : '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Beviteli mod</p>
                <p className="text-gray-900">
                  {event.entryMode === 'QR_DRIVER' ? 'Sofor (QR)' : 'Manualis (Operator)'}
                </p>
              </div>
            </div>
          </div>

          {/* Location & Service */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Helyszin es partner</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Helyszin</p>
                <p className="text-gray-900 font-medium">{event.location?.name || '-'}</p>
                <p className="text-sm text-gray-500 font-mono">{event.location?.code}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Partner</p>
                <p className="text-gray-900">{event.partnerCompany?.name || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Sofor</p>
                <p className="text-gray-900">{event.driver?.name || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Vegosszeg</p>
                <p className="text-gray-900 font-semibold">
                  {event.totalPrice ? `${parseFloat(event.totalPrice).toLocaleString('hu-HU')} Ft` : '-'}
                </p>
              </div>
            </div>
          </div>

          {/* Services */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Szolgaltatasok
              {event.services && event.services.length > 0 && (
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({event.services.length} db)
                </span>
              )}
            </h2>
            {event.services && event.services.length > 0 ? (
              <div className="space-y-3">
                {event.services.map((svc) => (
                  <div key={svc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{svc.servicePackage?.name || 'Szolgaltatas'}</p>
                      <p className="text-sm text-gray-500">
                        {vehicleTypeLabels[svc.vehicleType] || svc.vehicleType}
                        {svc.vehicleRole && ` (${svc.vehicleRole === 'TRACTOR' ? 'Vontato' : 'Potkocsi'})`}
                        {svc.plateNumber && ` - ${svc.plateNumber}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">
                        {parseFloat(svc.totalPrice).toLocaleString('hu-HU')} Ft
                      </p>
                      {svc.quantity > 1 && (
                        <p className="text-sm text-gray-500">{svc.quantity} x {parseFloat(svc.unitPrice).toLocaleString('hu-HU')} Ft</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : event.servicePackage ? (
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="font-medium text-gray-900">{event.servicePackage.name}</p>
                <p className="text-sm text-gray-500 font-mono">{event.servicePackage.code}</p>
              </div>
            ) : (
              <p className="text-gray-500">Nincs szolgaltatas rogzitve</p>
            )}
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Idopontok</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-500">Letrehozva</span>
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
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Megjegyzesek</h2>
              <p className="text-gray-700 whitespace-pre-wrap">{event.notes}</p>
            </div>
          )}
        </div>

        {/* Actions Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Muveletek</h2>

            {event.status === 'CREATED' && (
              <>
                <button
                  onClick={() => updateStatus('authorize')}
                  disabled={actionLoading}
                  className="w-full py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {actionLoading ? 'Feldolgozas...' : 'Engedelyezes'}
                </button>
                <button
                  onClick={handleReject}
                  disabled={actionLoading}
                  className="w-full py-3 bg-red-100 text-red-700 font-medium rounded-xl hover:bg-red-200 disabled:opacity-50 transition-colors"
                >
                  Elutasitas
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
                  {actionLoading ? 'Feldolgozas...' : 'Mosas inditasa'}
                </button>
                <button
                  onClick={handleReject}
                  disabled={actionLoading}
                  className="w-full py-3 bg-red-100 text-red-700 font-medium rounded-xl hover:bg-red-200 disabled:opacity-50 transition-colors"
                >
                  Elutasitas
                </button>
              </>
            )}

            {event.status === 'IN_PROGRESS' && (
              <button
                onClick={() => updateStatus('complete')}
                disabled={actionLoading}
                className="w-full py-3 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {actionLoading ? 'Feldolgozas...' : 'Mosas befejezese'}
              </button>
            )}

            {event.status === 'COMPLETED' && (
              <button
                onClick={() => updateStatus('lock')}
                disabled={actionLoading}
                className="w-full py-3 bg-gray-600 text-white font-medium rounded-xl hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                {actionLoading ? 'Feldolgozas...' : 'Lezaras'}
              </button>
            )}

            {(event.status === 'LOCKED' || event.status === 'REJECTED') && (
              <p className="text-sm text-gray-500 text-center py-4">
                Ez az esemeny mar {event.status === 'LOCKED' ? 'le van zarva' : 'el lett utasitva'}.
              </p>
            )}

            <hr className="my-4" />

            <Link
              href="/network-admin/wash-events"
              className="block w-full py-3 text-center bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
            >
              Vissza a listahoz
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
