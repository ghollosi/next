'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetchOperatorApi } from '@/lib/network-admin-api';

interface PartnerCompany {
  id: string;
  code: string;
  name: string;
}

export default function NewDriverPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [partners, setPartners] = useState<PartnerCompany[]>([]);

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    partnerCompanyId: '',
    pin: '',
  });

  useEffect(() => {
    loadPartners();
  }, []);

  const loadPartners = async () => {
    try {
      const data = await fetchOperatorApi<PartnerCompany[]>('/operator/partner-companies');
      setPartners(data);
    } catch (err) {
      console.error('Failed to load partners:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    // Validation
    if (!form.firstName || !form.lastName) {
      setError('A vezetéknév és keresztnév megadása kötelező');
      setSaving(false);
      return;
    }

    if (!form.email && !form.phone) {
      setError('Legalább egy elérhetőséget (email vagy telefon) meg kell adni');
      setSaving(false);
      return;
    }

    if (!form.pin || form.pin.length < 4) {
      setError('A PIN kód legalább 4 karakter hosszú kell legyen');
      setSaving(false);
      return;
    }

    try {
      await fetchOperatorApi('/operator/drivers', {
        method: 'POST',
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          phone: form.phone || undefined,
          email: form.email || undefined,
          partnerCompanyId: form.partnerCompanyId || undefined,
          pin: form.pin,
        }),
      });
      router.push('/network-admin/drivers');
    } catch (err: any) {
      setError(err.message || 'Hiba a sofőr létrehozásakor');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/network-admin/drivers"
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Új sofőr</h1>
          <p className="text-gray-500">Hozz létre egy új sofőrt</p>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600">
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Last Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vezetéknév <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-primary-500 focus:ring-0 focus:outline-none"
              placeholder="pl. Kovács"
              required
            />
          </div>

          {/* First Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Keresztnév <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-primary-500 focus:ring-0 focus:outline-none"
              placeholder="pl. János"
              required
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Telefonszám
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-primary-500 focus:ring-0 focus:outline-none"
              placeholder="pl. +36301234567"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email cím
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-primary-500 focus:ring-0 focus:outline-none"
              placeholder="pl. kovacs.janos@example.com"
            />
          </div>

          {/* Partner Company */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Partner cég
            </label>
            <select
              value={form.partnerCompanyId}
              onChange={(e) => setForm({ ...form, partnerCompanyId: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-primary-500 focus:ring-0 focus:outline-none"
            >
              <option value="">Nincs hozzárendelve (privát ügyfél)</option>
              {partners.map((partner) => (
                <option key={partner.id} value={partner.id}>
                  {partner.name} ({partner.code})
                </option>
              ))}
            </select>
          </div>

          {/* PIN */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              PIN kód <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={form.pin}
              onChange={(e) => setForm({ ...form, pin: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-primary-500 focus:ring-0 focus:outline-none"
              placeholder="Minimum 4 karakter"
              minLength={4}
              required
            />
            <p className="mt-1 text-sm text-gray-500">
              A sofőr ezzel a PIN kóddal tud majd bejelentkezni
            </p>
          </div>
        </div>

        {/* Info */}
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-sm text-blue-700">
            <strong>Megjegyzés:</strong> Legalább egy elérhetőséget (email vagy telefon) meg kell adni.
            A sofőr automatikusan jóváhagyott státuszt kap.
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <Link
            href="/network-admin/drivers"
            className="px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            Mégse
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Mentés...' : 'Sofőr létrehozása'}
          </button>
        </div>
      </form>
    </div>
  );
}
