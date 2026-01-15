'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface PartnerCompany {
  id: string;
  code: string;
  name: string;
}

interface Vehicle {
  id: string;
  type: 'TRACTOR' | 'TRAILER';
  plateNumber: string;
  plateState?: string;
}

interface PendingDriver {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  partnerCompany?: PartnerCompany;
  vehicles?: Vehicle[];
  createdAt: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const NETWORK_ID = 'cf808392-6283-4487-9fbd-e72951ca5bf8';
const USER_ID = 'admin-user'; // Placeholder for admin user ID

export default function DriverApprovalsPage() {
  const [drivers, setDrivers] = useState<PendingDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{
    driverId: string;
    name: string;
  } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    loadPendingDrivers();
  }, []);

  const loadPendingDrivers = async () => {
    try {
      const response = await fetch(`${API_URL}/operator/drivers/pending-approval`, {
        headers: {
          'x-network-id': NETWORK_ID,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDrivers(data);
      } else {
        throw new Error('Nem sikerült betölteni a jóváhagyásra váró sofőröket');
      }
    } catch (err: any) {
      setError(err.message || 'Hiba történt');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (driverId: string) => {
    setProcessingId(driverId);
    try {
      const response = await fetch(`${API_URL}/operator/drivers/${driverId}/approve`, {
        method: 'POST',
        headers: {
          'x-network-id': NETWORK_ID,
          'x-user-id': USER_ID,
        },
      });

      if (response.ok) {
        // Remove from list
        setDrivers(drivers.filter((d) => d.id !== driverId));
      } else {
        throw new Error('Nem sikerült jóváhagyni');
      }
    } catch (err: any) {
      setError(err.message || 'Hiba történt');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectModal || !rejectReason.trim()) return;

    setProcessingId(rejectModal.driverId);
    try {
      const response = await fetch(
        `${API_URL}/operator/drivers/${rejectModal.driverId}/reject`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-network-id': NETWORK_ID,
            'x-user-id': USER_ID,
          },
          body: JSON.stringify({ reason: rejectReason }),
        }
      );

      if (response.ok) {
        setDrivers(drivers.filter((d) => d.id !== rejectModal.driverId));
        setRejectModal(null);
        setRejectReason('');
      } else {
        throw new Error('Nem sikerült elutasítani');
      }
    } catch (err: any) {
      setError(err.message || 'Hiba történt');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/admin/drivers"
            className="text-primary-600 hover:text-primary-700 text-sm font-medium"
          >
            &larr; Vissza a sofőrökhöz
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">
            Jóváhagyásra váró sofőrök
          </h1>
          <p className="text-gray-500">
            Önregisztrált sofőrök, akik jóváhagyásra várnak
          </p>
        </div>
        {drivers.length > 0 && (
          <span className="px-3 py-1 bg-yellow-100 text-yellow-700 font-medium rounded-full">
            {drivers.length} várakozik
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600">
          {error}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-500">
          Betöltés...
        </div>
      ) : drivers.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-gray-600">Nincs jóváhagyásra váró sofőr.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {drivers.map((driver) => (
            <div
              key={driver.id}
              className="bg-white rounded-xl shadow-sm p-6"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-700 font-semibold">
                    {driver.firstName.charAt(0)}
                    {driver.lastName.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {driver.lastName} {driver.firstName}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {driver.partnerCompany?.name || 'Nincs cég'}
                    </p>
                    <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-600">
                      {driver.phone && (
                        <span>Tel: {driver.phone}</span>
                      )}
                      {driver.email && (
                        <span>Email: {driver.email}</span>
                      )}
                      <span>
                        Regisztrálva: {new Date(driver.createdAt).toLocaleDateString('hu-HU')}
                      </span>
                    </div>

                    {/* Vehicles */}
                    {driver.vehicles && driver.vehicles.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {driver.vehicles.map((vehicle) => (
                          <span
                            key={vehicle.id}
                            className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                              vehicle.type === 'TRACTOR'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-purple-100 text-purple-700'
                            }`}
                          >
                            {vehicle.type === 'TRACTOR' ? 'Vontató' : 'Pótkocsi'}:{' '}
                            {vehicle.plateNumber}
                            {vehicle.plateState && ` (${vehicle.plateState})`}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(driver.id)}
                    disabled={processingId === driver.id}
                    className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {processingId === driver.id ? '...' : 'Jóváhagy'}
                  </button>
                  <button
                    onClick={() =>
                      setRejectModal({
                        driverId: driver.id,
                        name: `${driver.lastName} ${driver.firstName}`,
                      })
                    }
                    disabled={processingId === driver.id}
                    className="px-4 py-2 bg-red-100 text-red-700 font-medium rounded-lg hover:bg-red-200 disabled:opacity-50 transition-colors"
                  >
                    Elutasít
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Sofőr elutasítása
            </h3>
            <p className="text-gray-600 mb-4">
              Biztosan elutasítod <strong>{rejectModal.name}</strong> regisztrációját?
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Elutasítás oka *
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                placeholder="Add meg az elutasítás okát..."
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setRejectModal(null);
                  setRejectReason('');
                }}
                className="flex-1 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                Mégse
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim() || processingId === rejectModal.driverId}
                className="flex-1 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {processingId === rejectModal.driverId ? 'Elutasítás...' : 'Elutasítás'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
