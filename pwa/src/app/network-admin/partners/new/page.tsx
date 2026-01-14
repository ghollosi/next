'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { networkAdminApi } from '@/lib/network-admin-api';

export default function NewPartnerPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form state - matching backend DTO
  const [name, setName] = useState('');
  const [taxNumber, setTaxNumber] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await networkAdminApi.createPartnerCompany({
        name,
        taxNumber,
        billingAddress: billingAddress || undefined,
        contactEmail: contactEmail || undefined,
        contactPhone: contactPhone || undefined,
      });
      router.push('/network-admin/partners');
    } catch (err: any) {
      setError(err.message || 'Hiba tortent a partner letrehozasakor');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/network-admin/partners"
          className="text-primary-600 hover:text-primary-700 text-sm font-medium"
        >
          &larr; Vissza a partnerekhez
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Uj partner ceg</h1>
        <p className="text-gray-500">Hozz letre egy uj fuvarozo ceget</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">
            Cegadatok
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ceg neve *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="pl. Trans Kft."
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Adoszam *
              </label>
              <input
                type="text"
                value={taxNumber}
                onChange={(e) => setTaxNumber(e.target.value)}
                required
                placeholder="12345678-1-23"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Szamlazasi cim
              </label>
              <input
                type="text"
                value={billingAddress}
                onChange={(e) => setBillingAddress(e.target.value)}
                placeholder="pl. 1234 Budapest, Fo utca 1."
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
        </div>

        {/* Contact Info */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">
            Kapcsolattartas
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="pl. info@trans.hu"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Telefon
              </label>
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="pl. +36 30 123 4567"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-4">
          <Link
            href="/network-admin/partners"
            className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl text-center hover:bg-gray-200 transition-colors"
          >
            Megse
          </Link>
          <button
            type="submit"
            disabled={submitting || !name || !taxNumber}
            className="flex-1 py-3 bg-primary-600 text-white font-medium rounded-xl
                       hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors"
          >
            {submitting ? 'Letrehozas...' : 'Partner letrehozasa'}
          </button>
        </div>
      </form>

      {/* Info Box */}
      <div className="bg-blue-50 rounded-xl p-4 mt-6">
        <p className="text-sm text-blue-700">
          <strong>Megjegyzes:</strong> A partner kod automatikusan generalodik a cegnev alapjan.
          A letrehozas utan hozzaadhatsz soforokat a partnerhez.
        </p>
      </div>
    </div>
  );
}
