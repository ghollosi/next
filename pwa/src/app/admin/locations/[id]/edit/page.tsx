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
  operationType?: 'OWN' | 'SUBCONTRACTOR';
}

interface ServicePackage {
  id: string;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const NETWORK_ID = 'cf808392-6283-4487-9fbd-e72951ca5bf8';

export default function LocationEditPage() {
  const params = useParams();
  const router = useRouter();
  const locationId = params.id as string;

  const [location, setLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form fields
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [country, setCountry] = useState('HU');
  const [timezone, setTimezone] = useState('Europe/Budapest');
  const [isActive, setIsActive] = useState(true);
  const [operationType, setOperationType] = useState<'OWN' | 'SUBCONTRACTOR'>('OWN');

  // Services
  const [allServices, setAllServices] = useState<ServicePackage[]>([]);
  const [enabledServiceIds, setEnabledServiceIds] = useState<string[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);

  useEffect(() => {
    if (locationId) {
      loadLocation();
      loadAllServices();
      loadLocationServices();
    }
  }, [locationId]);

  const loadLocation = async () => {
    try {
      const response = await fetch(`${API_URL}/operator/locations/${locationId}`, {
        headers: { 'x-network-id': NETWORK_ID },
      });

      if (response.ok) {
        const loc = await response.json();
        setLocation(loc);
        setName(loc.name || '');
        setCode(loc.code || '');
        setAddress(loc.address || '');
        setCity(loc.city || '');
        setZipCode(loc.zipCode || '');
        setCountry(loc.country || 'HU');
        setTimezone(loc.timezone || 'Europe/Budapest');
        setIsActive(loc.isActive);
        setOperationType(loc.operationType || 'OWN');
      } else {
        throw new Error('Nem sikerült betölteni a helyszínt');
      }
    } catch (err: any) {
      setError(err.message || 'Hiba történt');
    } finally {
      setLoading(false);
    }
  };

  const loadAllServices = async () => {
    try {
      const response = await fetch(`${API_URL}/operator/service-packages`, {
        headers: { 'x-network-id': NETWORK_ID },
      });

      if (response.ok) {
        const data = await response.json();
        setAllServices(data);
      }
    } catch (err) {
      console.error('Failed to load services:', err);
    }
  };

  const loadLocationServices = async () => {
    setLoadingServices(true);
    try {
      const response = await fetch(`${API_URL}/operator/locations/${locationId}/services`, {
        headers: { 'x-network-id': NETWORK_ID },
      });

      if (response.ok) {
        const data = await response.json();
        setEnabledServiceIds(data.map((s: ServicePackage) => s.id));
      }
    } catch (err) {
      console.error('Failed to load location services:', err);
    } finally {
      setLoadingServices(false);
    }
  };

  const toggleService = (serviceId: string) => {
    setEnabledServiceIds((prev) =>
      prev.includes(serviceId)
        ? prev.filter((id) => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      // Update location details
      const locationResponse = await fetch(`${API_URL}/operator/locations/${locationId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-network-id': NETWORK_ID,
        },
        body: JSON.stringify({
          name,
          address,
          city,
          zipCode,
          country,
          timezone,
          isActive,
          operationType,
        }),
      });

      if (!locationResponse.ok) {
        throw new Error('Nem sikerült menteni a helyszín adatait');
      }

      // Update services
      const servicesResponse = await fetch(`${API_URL}/operator/locations/${locationId}/services`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-network-id': NETWORK_ID,
        },
        body: JSON.stringify({
          servicePackageIds: enabledServiceIds,
        }),
      });

      if (!servicesResponse.ok) {
        throw new Error('Nem sikerült menteni a szolgáltatásokat');
      }

      setSuccess('Helyszín sikeresen mentve!');
      setTimeout(() => {
        router.push(`/admin/locations/${locationId}`);
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Hiba történt');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-500">Betöltés...</p>
      </div>
    );
  }

  if (!location) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-600 mb-4">{error || 'Helyszín nem található'}</p>
          <Link href="/admin/locations" className="text-primary-600 hover:text-primary-700 font-medium">
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
            href={`/admin/locations/${locationId}`}
            className="text-gray-500 hover:text-gray-700 text-sm mb-2 inline-block"
          >
            &larr; Vissza a helyszínhez
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Helyszín szerkesztése</h1>
          <p className="text-gray-500 font-mono">{location.code}</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-green-600">{success}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">Alapadatok</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kód</label>
              <input
                type="text"
                value={code}
                disabled
                className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-gray-50 text-gray-500 font-mono"
              />
              <p className="text-xs text-gray-400 mt-1">A kód nem módosítható</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Név *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Üzemeltetés típusa</label>
              <select
                value={operationType}
                onChange={(e) => setOperationType(e.target.value as 'OWN' | 'SUBCONTRACTOR')}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="OWN">Saját üzemeltetés</option>
                <option value="SUBCONTRACTOR">Alvállalkozó</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-gray-700">Aktív helyszín</span>
              </label>
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">Cím adatok</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Utca, házszám</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Irányítószám</label>
              <input
                type="text"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Város</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ország</label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="HU">Magyarország</option>
                <option value="AT">Ausztria</option>
                <option value="SK">Szlovákia</option>
                <option value="RO">Románia</option>
                <option value="DE">Németország</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Időzóna</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="Europe/Budapest">Europe/Budapest</option>
                <option value="Europe/Vienna">Europe/Vienna</option>
                <option value="Europe/Berlin">Europe/Berlin</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
          </div>
        </div>

        {/* Services */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">Elérhető szolgáltatások</h2>
          <p className="text-sm text-gray-500">
            Válaszd ki, mely szolgáltatások érhetőek el ezen a helyszínen.
          </p>

          {loadingServices ? (
            <p className="text-gray-500">Szolgáltatások betöltése...</p>
          ) : allServices.length === 0 ? (
            <p className="text-gray-500">Nincsenek szolgáltatások a rendszerben.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {allServices.map((service) => (
                <label
                  key={service.id}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    enabledServiceIds.includes(service.id)
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={enabledServiceIds.includes(service.id)}
                    onChange={() => toggleService(service.id)}
                    className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div>
                    <p className="font-medium text-gray-900">{service.name}</p>
                    <p className="text-xs text-gray-500 font-mono">{service.code}</p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-4">
          <Link
            href={`/admin/locations/${locationId}`}
            className="px-6 py-3 text-gray-700 font-medium hover:text-gray-900 transition-colors"
          >
            Mégse
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Mentés...' : 'Mentés'}
          </button>
        </div>
      </form>
    </div>
  );
}
