'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { networkAdminApi } from '@/lib/network-admin-api';

interface Booking {
  id: string;
  bookingCode: string;
  networkId: string;
  locationId: string;
  driverId?: string;
  scheduledStart: string;
  scheduledEnd: string;
  vehicleType: string;
  plateNumber?: string;
  servicePackageId: string;
  serviceDurationMinutes: number;
  servicePrice: number;
  currency: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  status: string;
  paymentStatus: string;
  paymentProvider?: string;
  prepaidAmount: number;
  totalPaid: number;
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationReason?: string;
  cancellationFeeApplied?: number;
  washEventId?: string;
  createdAt: string;
  updatedAt: string;
  notes?: string;
  location?: {
    id: string;
    name: string;
    code: string;
    city?: string;
  };
  servicePackage?: {
    id: string;
    name: string;
    code: string;
  };
  driver?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  washEvent?: {
    id: string;
    status: string;
  };
}

const statusLabels: Record<string, string> = {
  PENDING: 'Függőben',
  CONFIRMED: 'Megerősítve',
  IN_PROGRESS: 'Folyamatban',
  COMPLETED: 'Befejezve',
  CANCELLED: 'Lemondva',
  NO_SHOW: 'Nem jelent meg',
  REFUNDED: 'Visszatérítve',
};

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-purple-100 text-purple-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
  NO_SHOW: 'bg-red-100 text-red-800',
  REFUNDED: 'bg-orange-100 text-orange-800',
};

const vehicleTypeLabels: Record<string, string> = {
  SEMI_TRUCK: 'Nyerges szerelvény',
  GRAIN_CARRIER: 'Gabonaszállító',
  TRAILER_ONLY: 'Pótkocsi',
  TRUCK_3_5T: 'Tehergépjármű 3,5t-ig',
  TRUCK_7_5T: 'Tehergépjármű 7,5t-ig',
  TRUCK_12T: 'Tehergépjármű 12t-ig',
  CAR: 'Személygépkocsi',
};

export default function BookingDetailPage() {
  const router = useRouter();
  const params = useParams();
  const bookingId = params.id as string;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    loadBooking();
  }, [bookingId]);

  async function loadBooking() {
    try {
      setLoading(true);
      const data = await networkAdminApi.getBooking(bookingId);
      setBooking(data);
    } catch (err: any) {
      setError(err.message || 'Hiba a foglalás betöltésekor');
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(action: string) {
    if (!booking) return;

    try {
      setActionLoading(action);
      setError('');

      switch (action) {
        case 'confirm':
          await networkAdminApi.confirmBooking(booking.id);
          break;
        case 'start':
          await networkAdminApi.startBooking(booking.id);
          break;
        case 'complete':
          await networkAdminApi.completeBooking(booking.id);
          break;
        case 'noshow':
          await networkAdminApi.markNoShow(booking.id);
          break;
      }

      await loadBooking();
    } catch (err: any) {
      setError(err.message || 'Hiba a művelet végrehajtásakor');
    } finally {
      setActionLoading('');
    }
  }

  async function handleCancel() {
    if (!booking || !cancelReason.trim()) return;

    try {
      setActionLoading('cancel');
      await networkAdminApi.cancelBooking(booking.id, cancelReason);
      setShowCancelModal(false);
      setCancelReason('');
      await loadBooking();
    } catch (err: any) {
      setError(err.message || 'Hiba a lemondás során');
    } finally {
      setActionLoading('');
    }
  }

  function formatDateTime(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleString('hu-HU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatPrice(price: number, currency: string = 'HUF') {
    return new Intl.NumberFormat('hu-HU', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
    }).format(price);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Foglalás nem található</p>
        <Link href="/network-admin/bookings" className="text-primary-600 hover:underline mt-2 inline-block">
          Vissza a foglalásokhoz
        </Link>
      </div>
    );
  }

  const canConfirm = booking.status === 'PENDING';
  const canStart = booking.status === 'CONFIRMED';
  const canComplete = booking.status === 'IN_PROGRESS';
  const canCancel = ['PENDING', 'CONFIRMED'].includes(booking.status);
  const canMarkNoShow = ['PENDING', 'CONFIRMED'].includes(booking.status);

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/network-admin/bookings"
          className="text-primary-600 hover:text-primary-700 text-sm font-medium"
        >
          &larr; Vissza a foglalásokhoz
        </Link>
        <div className="mt-2 flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900">
            Foglalás: {booking.bookingCode}
          </h1>
          <span className={`px-3 py-1 text-sm font-medium rounded-full ${statusColors[booking.status] || 'bg-gray-100 text-gray-800'}`}>
            {statusLabels[booking.status] || booking.status}
          </span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Időpont és szolgáltatás */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 border-b pb-2 mb-4">
              Foglalás részletei
            </h2>

            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-gray-500">Időpont</dt>
                <dd className="font-medium text-gray-900">
                  {formatDateTime(booking.scheduledStart)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Időtartam</dt>
                <dd className="font-medium text-gray-900">
                  {booking.serviceDurationMinutes} perc
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Helyszín</dt>
                <dd className="font-medium text-gray-900">
                  {booking.location?.name || '-'}
                  {booking.location?.city && (
                    <span className="text-gray-500 font-normal"> - {booking.location.city}</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Szolgáltatás</dt>
                <dd className="font-medium text-gray-900">
                  {booking.servicePackage?.name || '-'}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Járműtípus</dt>
                <dd className="font-medium text-gray-900">
                  {vehicleTypeLabels[booking.vehicleType] || booking.vehicleType}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Rendszám</dt>
                <dd className="font-medium text-gray-900 font-mono">
                  {booking.plateNumber || '-'}
                </dd>
              </div>
            </dl>
          </div>

          {/* Ügyfél adatok */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 border-b pb-2 mb-4">
              Ügyfél adatok
            </h2>

            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-gray-500">Név</dt>
                <dd className="font-medium text-gray-900">
                  {booking.customerName || booking.driver
                    ? `${booking.driver?.firstName || ''} ${booking.driver?.lastName || ''}`.trim() || booking.customerName
                    : '-'}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Telefon</dt>
                <dd className="font-medium text-gray-900">
                  {booking.customerPhone || '-'}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-sm text-gray-500">Email</dt>
                <dd className="font-medium text-gray-900">
                  {booking.customerEmail || '-'}
                </dd>
              </div>
              {booking.notes && (
                <div className="col-span-2">
                  <dt className="text-sm text-gray-500">Megjegyzés</dt>
                  <dd className="font-medium text-gray-900">
                    {booking.notes}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Lemondás info */}
          {booking.status === 'CANCELLED' && (
            <div className="bg-red-50 rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-red-900 border-b border-red-200 pb-2 mb-4">
                Lemondás adatai
              </h2>

              <dl className="space-y-2">
                <div>
                  <dt className="text-sm text-red-600">Lemondva</dt>
                  <dd className="font-medium text-red-900">
                    {booking.cancelledAt ? formatDateTime(booking.cancelledAt) : '-'}
                  </dd>
                </div>
                {booking.cancellationReason && (
                  <div>
                    <dt className="text-sm text-red-600">Indok</dt>
                    <dd className="font-medium text-red-900">
                      {booking.cancellationReason}
                    </dd>
                  </div>
                )}
                {booking.cancellationFeeApplied && booking.cancellationFeeApplied > 0 && (
                  <div>
                    <dt className="text-sm text-red-600">Lemondási díj</dt>
                    <dd className="font-medium text-red-900">
                      {formatPrice(booking.cancellationFeeApplied, booking.currency)}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Ár és fizetés */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 border-b pb-2 mb-4">
              Fizetési adatok
            </h2>

            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-gray-500">Szolgáltatás ára</dt>
                <dd className="font-semibold text-gray-900">
                  {formatPrice(booking.servicePrice, booking.currency)}
                </dd>
              </div>
              {booking.prepaidAmount > 0 && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Előleg</dt>
                  <dd className="text-green-600">
                    {formatPrice(booking.prepaidAmount, booking.currency)}
                  </dd>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t">
                <dt className="text-gray-500">Fizetendő</dt>
                <dd className="font-semibold text-lg text-gray-900">
                  {formatPrice(booking.servicePrice - (booking.totalPaid || 0), booking.currency)}
                </dd>
              </div>
            </dl>
          </div>

          {/* Műveletek */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 border-b pb-2 mb-4">
              Műveletek
            </h2>

            <div className="space-y-3">
              {canConfirm && (
                <button
                  onClick={() => handleAction('confirm')}
                  disabled={!!actionLoading}
                  className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {actionLoading === 'confirm' ? 'Megerősítés...' : 'Megerősítés'}
                </button>
              )}

              {canStart && (
                <button
                  onClick={() => handleAction('start')}
                  disabled={!!actionLoading}
                  className="w-full px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                >
                  {actionLoading === 'start' ? 'Indítás...' : 'Mosás indítása'}
                </button>
              )}

              {canComplete && (
                <button
                  onClick={() => handleAction('complete')}
                  disabled={!!actionLoading}
                  className="w-full px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {actionLoading === 'complete' ? 'Befejezés...' : 'Mosás befejezése'}
                </button>
              )}

              {canMarkNoShow && (
                <button
                  onClick={() => handleAction('noshow')}
                  disabled={!!actionLoading}
                  className="w-full px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {actionLoading === 'noshow' ? '...' : 'Nem jelent meg'}
                </button>
              )}

              {canCancel && (
                <button
                  onClick={() => setShowCancelModal(true)}
                  disabled={!!actionLoading}
                  className="w-full px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  Lemondás
                </button>
              )}
            </div>
          </div>

          {/* Meta info */}
          <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-500">
            <p>Létrehozva: {formatDateTime(booking.createdAt)}</p>
            <p>Módosítva: {formatDateTime(booking.updatedAt)}</p>
          </div>
        </div>
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Foglalás lemondása
            </h3>
            <p className="text-gray-600 mb-4">
              Biztosan le szeretnéd mondani ezt a foglalást?
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lemondás indoka *
              </label>
              <textarea
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Pl.: Ügyfél kérésére..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200"
              >
                Mégse
              </button>
              <button
                onClick={handleCancel}
                disabled={!cancelReason.trim() || actionLoading === 'cancel'}
                className="flex-1 px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading === 'cancel' ? 'Lemondás...' : 'Lemondás'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
