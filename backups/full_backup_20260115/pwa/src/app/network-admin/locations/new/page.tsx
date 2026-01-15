'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { networkAdminApi } from '@/lib/network-admin-api';

interface DayHours {
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

interface OpeningHours {
  monday: DayHours;
  tuesday: DayHours;
  wednesday: DayHours;
  thursday: DayHours;
  friday: DayHours;
  saturday: DayHours;
  sunday: DayHours;
}

interface LocationFormData {
  name: string;
  address: string;
  city: string;
  postalCode: string;
  latitude: string;
  longitude: string;
  phone: string;
  email: string;
  openingHours: OpeningHours;
  operationType: 'OWN' | 'SUBCONTRACTOR';
}

const DAYS = [
  { key: 'monday', label: 'Hetfo' },
  { key: 'tuesday', label: 'Kedd' },
  { key: 'wednesday', label: 'Szerda' },
  { key: 'thursday', label: 'Csutortok' },
  { key: 'friday', label: 'Pentek' },
  { key: 'saturday', label: 'Szombat' },
  { key: 'sunday', label: 'Vasarnap' },
] as const;

const defaultDayHours: DayHours = {
  isOpen: true,
  openTime: '06:00',
  closeTime: '22:00',
};

const defaultOpeningHours: OpeningHours = {
  monday: { ...defaultDayHours },
  tuesday: { ...defaultDayHours },
  wednesday: { ...defaultDayHours },
  thursday: { ...defaultDayHours },
  friday: { ...defaultDayHours },
  saturday: { isOpen: true, openTime: '07:00', closeTime: '18:00' },
  sunday: { isOpen: false, openTime: '08:00', closeTime: '14:00' },
};

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
    openingHours: defaultOpeningHours,
    operationType: 'OWN',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDayToggle = (day: keyof OpeningHours) => {
    setFormData((prev) => ({
      ...prev,
      openingHours: {
        ...prev.openingHours,
        [day]: {
          ...prev.openingHours[day],
          isOpen: !prev.openingHours[day].isOpen,
        },
      },
    }));
  };

  const handleTimeChange = (day: keyof OpeningHours, field: 'openTime' | 'closeTime', value: string) => {
    setFormData((prev) => ({
      ...prev,
      openingHours: {
        ...prev.openingHours,
        [day]: {
          ...prev.openingHours[day],
          [field]: value,
        },
      },
    }));
  };

  const copyToAllDays = (sourceDay: keyof OpeningHours) => {
    const sourceHours = formData.openingHours[sourceDay];
    setFormData((prev) => ({
      ...prev,
      openingHours: {
        monday: { ...sourceHours },
        tuesday: { ...sourceHours },
        wednesday: { ...sourceHours },
        thursday: { ...sourceHours },
        friday: { ...sourceHours },
        saturday: { ...sourceHours },
        sunday: { ...sourceHours },
      },
    }));
  };

  const copyToWeekdays = (sourceDay: keyof OpeningHours) => {
    const sourceHours = formData.openingHours[sourceDay];
    setFormData((prev) => ({
      ...prev,
      openingHours: {
        ...prev.openingHours,
        monday: { ...sourceHours },
        tuesday: { ...sourceHours },
        wednesday: { ...sourceHours },
        thursday: { ...sourceHours },
        friday: { ...sourceHours },
      },
    }));
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
        openingHours: formData.openingHours,
        operationType: formData.operationType,
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Üzemeltetés típusa *
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="operationType"
                  value="OWN"
                  checked={formData.operationType === 'OWN'}
                  onChange={(e) => setFormData((prev) => ({ ...prev, operationType: e.target.value as 'OWN' | 'SUBCONTRACTOR' }))}
                  className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                />
                <span className="text-gray-900">Saját üzemeltetés</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="operationType"
                  value="SUBCONTRACTOR"
                  checked={formData.operationType === 'SUBCONTRACTOR'}
                  onChange={(e) => setFormData((prev) => ({ ...prev, operationType: e.target.value as 'OWN' | 'SUBCONTRACTOR' }))}
                  className="w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                />
                <span className="text-gray-900">Alvállalkozó</span>
              </label>
            </div>
          </div>
        </div>

        {/* Opening Hours */}
        <div className="space-y-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Nyitvatartas</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => copyToWeekdays('monday')}
                className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
              >
                Hetfo masolasa hetkoznapokra
              </button>
              <button
                type="button"
                onClick={() => copyToAllDays('monday')}
                className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
              >
                Hetfo masolasa mindenhova
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {DAYS.map(({ key, label }) => (
              <div key={key} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                <div className="w-24">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.openingHours[key].isOpen}
                      onChange={() => handleDayToggle(key)}
                      className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                    />
                    <span className={`text-sm font-medium ${formData.openingHours[key].isOpen ? 'text-gray-900' : 'text-gray-400'}`}>
                      {label}
                    </span>
                  </label>
                </div>

                {formData.openingHours[key].isOpen ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="time"
                      value={formData.openingHours[key].openTime}
                      onChange={(e) => handleTimeChange(key, 'openTime', e.target.value)}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-primary-500 focus:ring-0 focus:outline-none"
                    />
                    <span className="text-gray-400">-</span>
                    <input
                      type="time"
                      value={formData.openingHours[key].closeTime}
                      onChange={(e) => handleTimeChange(key, 'closeTime', e.target.value)}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-primary-500 focus:ring-0 focus:outline-none"
                    />
                  </div>
                ) : (
                  <span className="text-sm text-gray-400 italic">Zarva</span>
                )}
              </div>
            ))}
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
