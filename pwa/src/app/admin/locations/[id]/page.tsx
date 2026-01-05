'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Location {
  id: string;
  code: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  timezone?: string;
  phone?: string;
  email?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ServicePackage {
  id: string;
  code: string;
  name: string;
  description?: string;
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
const NETWORK_ID = 'cf808392-6283-4487-9fbd-e72951ca5bf8';

export default function LocationDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const locationId = params.id as string;

  const [location, setLocation] = useState<Location | null>(null);
  const [services, setServices] = useState<ServicePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [qrData, setQrData] = useState<QRCodeData | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);

  useEffect(() => {
    if (locationId) {
      loadLocation();
      loadServices();
      loadQRCode();
    }
  }, [locationId]);

  const loadLocation = async () => {
    try {
      // Note: We need to get location by ID, but current API only has findActive
      // For now, we'll get all locations and filter
      const response = await fetch(`${API_URL}/operator/locations`, {
        headers: { 'x-network-id': NETWORK_ID },
      });

      if (response.ok) {
        const locations = await response.json();
        const loc = locations.find((l: Location) => l.id === locationId);
        if (loc) {
          setLocation(loc);
        } else {
          setError('Helyszín nem található');
        }
      } else {
        throw new Error('Nem sikerült betölteni a helyszínt');
      }
    } catch (err: any) {
      setError(err.message || 'Hiba történt');
    } finally {
      setLoading(false);
    }
  };

  const loadServices = async () => {
    try {
      const response = await fetch(
        `${API_URL}/operator/locations/${locationId}/services`,
        { headers: { 'x-network-id': NETWORK_ID } }
      );

      if (response.ok) {
        const data = await response.json();
        setServices(data);
      }
    } catch (err) {
      console.error('Failed to load services:', err);
    }
  };

  const loadQRCode = async () => {
    setLoadingQr(true);
    try {
      const response = await fetch(
        `${API_URL}/operator/locations/${locationId}/qr-code-data?size=300`,
        { headers: { 'x-network-id': NETWORK_ID } }
      );

      if (response.ok) {
        const data = await response.json();
        setQrData(data);
      }
    } catch (err) {
      console.error('Failed to load QR code:', err);
    } finally {
      setLoadingQr(false);
    }
  };

  const downloadQRCode = async (format: 'png' | 'svg') => {
    if (!location) return;
    try {
      const response = await fetch(
        `${API_URL}/operator/locations/${locationId}/qr-code?format=${format}&size=600`,
        { headers: { 'x-network-id': NETWORK_ID } }
      );

      if (!response.ok) throw new Error('Letöltés sikertelen');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qr-${location.code}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'Hiba történt');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-500">Betöltés...</p>
      </div>
    );
  }

  if (error || !location) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-600 mb-4">{error || 'Helyszín nem található'}</p>
          <Link
            href="/admin/locations"
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            Vissza a helyszínekhez
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
            href="/admin/locations"
            className="text-gray-500 hover:text-gray-700 text-sm mb-2 inline-block"
          >
            &larr; Vissza a helyszínekhez
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{location.name}</h1>
          <p className="text-gray-500 font-mono">{location.code}</p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`px-3 py-1 text-sm font-medium rounded-full ${
              location.isActive
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            {location.isActive ? 'Aktív' : 'Inaktív'}
          </span>
          <Link
            href={`/admin/locations/${locationId}/edit`}
            className="px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
          >
            Szerkesztés
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Details Card */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Helyszín adatai
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Cím</p>
                <p className="text-gray-900">
                  {location.address || '-'}
                  {location.city && (
                    <>
                      <br />
                      {location.zipCode} {location.city}
                      {location.state && `, ${location.state}`}
                    </>
                  )}
                  {location.country && location.country !== 'US' && (
                    <>, {location.country}</>
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Időzóna</p>
                <p className="text-gray-900">{location.timezone || 'UTC'}</p>
              </div>
              {location.phone && (
                <div>
                  <p className="text-sm text-gray-500">Telefon</p>
                  <p className="text-gray-900">{location.phone}</p>
                </div>
              )}
              {location.email && (
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="text-gray-900">{location.email}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-500">Létrehozva</p>
                <p className="text-gray-900">
                  {new Date(location.createdAt).toLocaleDateString('hu-HU')}
                </p>
              </div>
            </div>
          </div>

          {/* Services Card */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Elérhető szolgáltatások
            </h2>
            {services.length === 0 ? (
              <p className="text-gray-500 text-sm">
                Nincsenek szolgáltatások beállítva ehhez a helyszínhez.
              </p>
            ) : (
              <div className="space-y-3">
                {services.map((service) => (
                  <div
                    key={service.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{service.name}</p>
                      <p className="text-sm text-gray-500 font-mono">
                        {service.code}
                      </p>
                    </div>
                    {service.description && (
                      <p className="text-sm text-gray-500 max-w-xs text-right">
                        {service.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* QR Code Card */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              QR kód
            </h2>

            {loadingQr ? (
              <div className="flex items-center justify-center h-64">
                <p className="text-gray-500">Betöltés...</p>
              </div>
            ) : qrData ? (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <div className="bg-white p-3 rounded-xl border-2 border-gray-100 shadow-inner">
                    <img
                      src={qrData.qrCodeDataUrl}
                      alt={`QR code for ${location.name}`}
                      className="w-48 h-48"
                    />
                  </div>
                </div>

                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-1">Mosás indítás URL:</p>
                  <p className="text-xs text-gray-600 font-mono break-all bg-gray-50 rounded p-2">
                    {qrData.washUrl}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => downloadQRCode('png')}
                    className="flex-1 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    PNG
                  </button>
                  <button
                    onClick={() => downloadQRCode('svg')}
                    className="flex-1 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    SVG
                  </button>
                </div>

                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-xs text-blue-700">
                    Nyomtasd ki és helyezd el a mosóhelyen. A sofőrök
                    beolvashatják a telefonjukkal.
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-sm text-center">
                Nem sikerült betölteni a QR kódot.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
