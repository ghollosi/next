'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchOperatorApi } from '@/lib/network-admin-api';

type OperationType = 'OWN' | 'SUBCONTRACTOR';

interface Location {
  id: string;
  code: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  operationType: OperationType;
  latitude?: number;
  longitude?: number;
  openingHours?: string;
  isActive: boolean;
  createdAt: string;
}

interface QRCodeData {
  locationId: string;
  locationCode: string;
  locationName: string;
  washUrl: string;
  qrCodeDataUrl: string;
  size: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const DAY_NAMES: Record<string, string> = {
  monday: 'H',
  tuesday: 'K',
  wednesday: 'Sze',
  thursday: 'Cs',
  friday: 'P',
  saturday: 'Szo',
  sunday: 'V',
};

const formatOpeningHours = (openingHoursStr: string): string => {
  try {
    const hours = JSON.parse(openingHoursStr);
    const parts: string[] = [];

    Object.entries(DAY_NAMES).forEach(([day, abbrev]) => {
      const dayData = hours[day];
      if (dayData?.isOpen) {
        parts.push(`${abbrev}: ${dayData.openTime}-${dayData.closeTime}`);
      } else if (dayData) {
        parts.push(`${abbrev}: Zárva`);
      }
    });

    return parts.join(' | ');
  } catch {
    return openingHoursStr;
  }
};

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [qrModal, setQrModal] = useState<QRCodeData | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);

  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async () => {
    try {
      const data = await fetchOperatorApi<Location[]>('/operator/locations');
      setLocations(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load locations');
    } finally {
      setLoading(false);
    }
  };

  const loadQRCode = async (locationId: string) => {
    setLoadingQr(true);
    try {
      const data = await fetchOperatorApi<QRCodeData>(
        `/operator/locations/${locationId}/qr-code-data?size=400`
      );
      setQrModal(data);
    } catch (err: any) {
      alert(err.message || 'Hiba történt');
    } finally {
      setLoadingQr(false);
    }
  };

  const downloadQRCode = async (locationId: string, locationCode: string, format: 'png' | 'svg') => {
    try {
      const data = await fetchOperatorApi<QRCodeData>(
        `/operator/locations/${locationId}/qr-code-data?size=600`
      );

      // For PNG, we can use the data URL directly
      const a = document.createElement('a');
      a.href = data.qrCodeDataUrl;
      a.download = `qr-${locationCode}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      alert(err.message || 'Hiba történt');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Helyszínek</h1>
          <p className="text-gray-500">Mosóállomások kezelése</p>
        </div>
        <Link
          href="/network-admin/locations/new"
          className="px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
        >
          + Uj helyszin
        </Link>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600">
          {error}
        </div>
      )}

      {/* Locations Grid */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-500">
          Betöltés...
        </div>
      ) : locations.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-500">
          Nincsenek helyszínek. Hozd létre az elsőt!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {locations.map((location) => (
            <div
              key={location.id}
              className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {location.name}
                  </h3>
                  <p className="text-sm text-gray-500 font-mono">
                    {location.code}
                  </p>
                </div>
                <div className="flex flex-col gap-1 items-end">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      location.operationType === 'OWN'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-orange-100 text-orange-700'
                    }`}
                  >
                    {location.operationType === 'OWN' ? 'Saját' : 'Alvállalkozó'}
                  </span>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      location.isActive
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {location.isActive ? 'Aktív' : 'Inaktív'}
                  </span>
                </div>
              </div>

              {(location.address || location.city) && (
                <div className="mb-3">
                  <p className="text-sm text-gray-600">
                    {location.address && <span>{location.address}</span>}
                    {location.city && (
                      <span>
                        {location.address ? ', ' : ''}
                        {location.zipCode} {location.city}
                      </span>
                    )}
                  </p>
                </div>
              )}

              {location.openingHours && (
                <div className="mb-3 text-xs text-gray-500">
                  {formatOpeningHours(location.openingHours)}
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2">
                <Link
                  href={`/network-admin/locations/${location.id}`}
                  className="flex-1 py-2 text-center text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                >
                  Részletek
                </Link>
                <button
                  onClick={() => loadQRCode(location.id)}
                  disabled={loadingQr}
                  className="flex-1 py-2 text-center text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition-colors flex items-center justify-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                  QR
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      {!loading && locations.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between text-sm flex-wrap gap-4">
            <span className="text-gray-500">
              Összesen: <strong>{locations.length}</strong> helyszín
            </span>
            <span className="text-blue-600">
              Saját: <strong>{locations.filter(l => l.operationType === 'OWN').length}</strong>
            </span>
            <span className="text-orange-600">
              Alvállalkozó: <strong>{locations.filter(l => l.operationType === 'SUBCONTRACTOR').length}</strong>
            </span>
            <span className="text-green-600">
              Aktív: <strong>{locations.filter(l => l.isActive).length}</strong>
            </span>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {qrModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setQrModal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {qrModal.locationName}
                  </h2>
                  <p className="text-sm text-gray-500 font-mono">
                    {qrModal.locationCode}
                  </p>
                </div>
                <button
                  onClick={() => setQrModal(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* QR Code Image */}
            <div className="p-6 flex flex-col items-center">
              <div className="bg-white p-4 rounded-xl border-2 border-gray-100 shadow-inner">
                <img
                  src={qrModal.qrCodeDataUrl}
                  alt={`QR code for ${qrModal.locationName}`}
                  className="w-64 h-64"
                />
              </div>

              {/* URL Info */}
              <div className="mt-4 w-full">
                <p className="text-xs text-gray-500 text-center mb-2">
                  Mosás indítás URL:
                </p>
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-600 font-mono break-all text-center">
                  {qrModal.washUrl}
                </div>
              </div>
            </div>

            {/* Download Buttons */}
            <div className="p-6 pt-0 flex gap-3">
              <button
                onClick={() => downloadQRCode(qrModal.locationId, qrModal.locationCode, 'png')}
                className="flex-1 py-3 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                PNG
              </button>
              <button
                onClick={() => downloadQRCode(qrModal.locationId, qrModal.locationCode, 'svg')}
                className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                SVG
              </button>
            </div>

            {/* Usage Hint */}
            <div className="px-6 pb-6">
              <div className="bg-blue-50 rounded-xl p-4">
                <p className="text-sm text-blue-700">
                  <strong>Használat:</strong> Nyomtasd ki és helyezd el a mosóhelyen.
                  A sofőrök beolvashatják a telefonjukkal, és azonnal indíthatnak mosást.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
