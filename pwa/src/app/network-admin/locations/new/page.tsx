'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { networkAdminApi } from '@/lib/network-admin-api';

interface LocationFormData {
  name: string;
  address: string;
  city: string;
  postalCode: string;
  latitude: string;
  longitude: string;
  phone: string;
  email: string;
}

export default function NewLocationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState<LocationFormData>({
    name: '',
    address: '',
    city: '',
    postalCode: '',
    latitude: '',
    longitude: '',
    phone: '',
    email: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const data: any = {
        name: formData.name,
        address: formData.address,
        city: formData.city,
      };

      if (formData.postalCode) {
        data.postalCode = formData.postalCode;
      }
      if (formData.latitude) {
        data.latitude = parseFloat(formData.latitude);
      }
      if (formData.longitude) {
        data.longitude = parseFloat(formData.longitude);
      }
      if (formData.phone) {
        data.phone = formData.phone;
      }
      if (formData.email) {
        data.email = formData.email;
      }

      await networkAdminApi.createLocation(data);
      router.push('/network-admin/locations');
    } catch (err: any) {
      setError(err.message || 'Hiba tortent a helyszin letrehozasakor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/network-admin/locations"
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Uj helyszin</h1>
          <p className="text-gray-500">Hozz letre egy uj mosoallomast</p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600">
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 space-y-6">
        {/* Basic Info */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Alapadatok</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Helyszin neve *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="pl. Budapest Mosoda"
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-primary-500 focus:ring-0 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cim *
            </label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              required
              placeholder="pl. Fo utca 1."
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-primary-500 focus:ring-0 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Varos *
              </label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                required
                placeholder="pl. Budapest"
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-primary-500 focus:ring-0 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Iranyitoszam
              </label>
              <input
                type="text"
                name="postalCode"
                value={formData.postalCode}
                onChange={handleChange}
                placeholder="pl. 1234"
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-primary-500 focus:ring-0 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Coordinates */}
        <div className="space-y-4 pt-4 border-t border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Koordinatak (opcionalis)</h2>
          <p className="text-sm text-gray-500">GPS koordinatak a terkepen valo megjeleniteshez</p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Szelesseg (latitude)
              </label>
              <input
                type="number"
                step="any"
                name="latitude"
                value={formData.latitude}
                onChange={handleChange}
                placeholder="pl. 47.4979"
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-primary-500 focus:ring-0 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hosszusag (longitude)
              </label>
              <input
                type="number"
                step="any"
                name="longitude"
                value={formData.longitude}
                onChange={handleChange}
                placeholder="pl. 19.0402"
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-primary-500 focus:ring-0 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="space-y-4 pt-4 border-t border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Kapcsolat (opcionalis)</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Telefonszam
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="pl. +36 1 234 5678"
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-primary-500 focus:ring-0 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="pl. info@mosoda.hu"
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-primary-500 focus:ring-0 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="pt-4 border-t border-gray-100 flex gap-4">
          <Link
            href="/network-admin/locations"
            className="flex-1 py-3 text-center bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            Megse
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Letrehozas...' : 'Helyszin letrehozasa'}
          </button>
        </div>
      </form>

      {/* Info Box */}
      <div className="bg-blue-50 rounded-xl p-4">
        <p className="text-sm text-blue-700">
          <strong>Megjegyzes:</strong> A helyszin kod automatikusan generalodik a nev alapjan.
          A letrehozas utan hozzaadhatsz operatorokat es QR kodot generalhatsz.
        </p>
      </div>
    </div>
  );
}
