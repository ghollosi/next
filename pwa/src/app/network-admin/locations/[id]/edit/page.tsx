'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { networkAdminApi, fetchOperatorApi } from '@/lib/network-admin-api';

interface Location {
  id: string;
  code: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  operationType: 'OWN' | 'SUBCONTRACTOR';
  washMode?: string;
  latitude?: number;
  longitude?: number;
  openingHours?: string;
  isActive: boolean;
  createdAt: string;
}

export default function LocationEditPage() {
  const params = useParams();
  const router = useRouter();
  const locationId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [form, setForm] = useState({
    name: '',
    code: '',
    address: '',
    city: '',
    zipCode: '',
    operationType: 'OWN' as 'OWN' | 'SUBCONTRACTOR',
    washMode: 'DRIVER_INITIATED',
    openingHours: '',
    isActive: true,
  });

  useEffect(() => {
    loadLocation();
  }, [locationId]);

  const loadLocation = async () => {
    try {
      const locations = await fetchOperatorApi<Location[]>('/operator/locations');
      const loc = locations.find(l => l.id === locationId);
      if (!loc) {
        setError('Helyszín nem található');
        return;
      }
      setForm({
        name: loc.name || '',
        code: loc.code || '',
        address: loc.address || '',
        city: loc.city || '',
        zipCode: loc.zipCode || '',
        operationType: loc.operationType || 'OWN',
        washMode: loc.washMode || 'DRIVER_INITIATED',
        openingHours: loc.openingHours || '',
        isActive: loc.isActive,
      });
    } catch (err: any) {
      setError(err.message || 'Hiba történt');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setSaving(true);

    try {
      await networkAdminApi.updateLocation(locationId, {
        name: form.name,
        address: form.address || undefined,
        city: form.city || undefined,
        isActive: form.isActive,
      });
      setSuccessMessage('Helyszín sikeresen frissítve!');
      setTimeout(() => {
        router.push(`/network-admin/locations/${locationId}`);
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Hiba történt a mentés során');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Betöltés...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/network-admin/locations/${locationId}`}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Helyszín szerkesztése</h1>
          <p className="text-gray-500 font-mono">{form.code}</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-green-600">
            {successMessage}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Helyszín neve *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-0 focus:outline-none"
              required
            />
          </div>

          {/* Code (read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Helyszín kód
            </label>
            <input
              type="text"
              value={form.code}
              disabled
              className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl bg-gray-50 text-gray-500 font-mono"
            />
            <p className="text-xs text-gray-500 mt-1">A kód nem módosítható</p>
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cím
            </label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="pl. Fő utca 1."
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-0 focus:outline-none"
            />
          </div>

          {/* City */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Irányítószám
              </label>
              <input
                type="text"
                value={form.zipCode}
                onChange={(e) => setForm({ ...form, zipCode: e.target.value })}
                placeholder="1234"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-0 focus:outline-none"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Város
              </label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="Budapest"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-0 focus:outline-none"
              />
            </div>
          </div>

          {/* Operation Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Üzemeltetés típusa
            </label>
            <select
              value={form.operationType}
              onChange={(e) => setForm({ ...form, operationType: e.target.value as 'OWN' | 'SUBCONTRACTOR' })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-0 focus:outline-none"
            >
              <option value="OWN">Saját üzemeltetés</option>
              <option value="SUBCONTRACTOR">Alvállalkozó</option>
            </select>
          </div>

          {/* Wash Mode */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mosás mód
            </label>
            <select
              value={form.washMode}
              onChange={(e) => setForm({ ...form, washMode: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-0 focus:outline-none"
            >
              <option value="DRIVER_INITIATED">Sofőr indítja</option>
              <option value="OPERATOR_INITIATED">Operátor indítja</option>
            </select>
          </div>

          {/* Opening Hours */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nyitvatartás
            </label>
            <input
              type="text"
              value={form.openingHours}
              onChange={(e) => setForm({ ...form, openingHours: e.target.value })}
              placeholder="pl. H-P: 6:00-22:00, Szo-V: 8:00-20:00"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-0 focus:outline-none"
            />
          </div>

          {/* Active Status */}
          <div className="md:col-span-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="font-medium text-gray-700">Aktív helyszín</span>
            </label>
            <p className="text-sm text-gray-500 mt-1 ml-8">
              Inaktív helyszínen nem lehet mosást indítani.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-gray-100">
          <Link
            href={`/network-admin/locations/${locationId}`}
            className="px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
          >
            Mégse
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 transition-colors disabled:bg-gray-300"
          >
            {saving ? 'Mentés...' : 'Mentés'}
          </button>
        </div>
      </form>
    </div>
  );
}
