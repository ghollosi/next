'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Location {
  id: string;
  code: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  email?: string;
  isActive: boolean;
  createdAt: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const NETWORK_ID = 'cf808392-6283-4487-9fbd-e72951ca5bf8';

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async () => {
    try {
      const response = await fetch(`${API_URL}/operator/locations`, {
        headers: { 'x-network-id': NETWORK_ID },
      });

      if (response.ok) {
        const data = await response.json();
        setLocations(data);
      } else {
        throw new Error('Failed to load locations');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load locations');
    } finally {
      setLoading(false);
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
        <button
          className="px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
          onClick={() => alert('Új helyszín létrehozása - hamarosan')}
        >
          + Új helyszín
        </button>
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

              {(location.address || location.city) && (
                <div className="mb-4">
                  <p className="text-sm text-gray-600">
                    {location.address && <span>{location.address}</span>}
                    {location.city && (
                      <span>
                        {location.address ? ', ' : ''}
                        {location.postalCode} {location.city}
                      </span>
                    )}
                  </p>
                </div>
              )}

              {(location.phone || location.email) && (
                <div className="text-sm text-gray-500 space-y-1">
                  {location.phone && (
                    <p>📞 {location.phone}</p>
                  )}
                  {location.email && (
                    <p>✉️ {location.email}</p>
                  )}
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2">
                <Link
                  href={`/admin/locations/${location.id}`}
                  className="flex-1 py-2 text-center text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                >
                  Részletek
                </Link>
                <button
                  onClick={() => alert('Szerkesztés - hamarosan')}
                  className="flex-1 py-2 text-center text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  Szerkesztés
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      {!loading && locations.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">
              Összesen: <strong>{locations.length}</strong> helyszín
            </span>
            <span className="text-gray-500">
              Aktív: <strong>{locations.filter(l => l.isActive).length}</strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
