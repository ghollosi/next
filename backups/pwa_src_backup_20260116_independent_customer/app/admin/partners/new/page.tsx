'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const NETWORK_ID = 'cf808392-6283-4487-9fbd-e72951ca5bf8';

type BillingType = 'CONTRACT' | 'CASH';
type BillingCycle = 'MONTHLY' | 'WEEKLY';

export default function NewPartnerPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [billingType, setBillingType] = useState<BillingType>('CONTRACT');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('MONTHLY');
  const [billingName, setBillingName] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [billingCity, setBillingCity] = useState('');
  const [billingZipCode, setBillingZipCode] = useState('');
  const [taxNumber, setTaxNumber] = useState('');
  const [euVatNumber, setEuVatNumber] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const body: Record<string, any> = {
        name,
        code: code.toUpperCase(),
        contactName: contactName || undefined,
        email: email || undefined,
        phone: phone || undefined,
        billingType,
        billingName: billingName || undefined,
        billingAddress: billingAddress || undefined,
        billingCity: billingCity || undefined,
        billingZipCode: billingZipCode || undefined,
        taxNumber: taxNumber || undefined,
        euVatNumber: euVatNumber || undefined,
      };

      // Billing cycle only for CONTRACT
      if (billingType === 'CONTRACT') {
        body.billingCycle = billingCycle;
      }

      const response = await fetch(`${API_URL}/operator/partner-companies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-network-id': NETWORK_ID,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Nem sikerült létrehozni a partnert');
      }

      router.push('/admin/partners');
    } catch (err: any) {
      setError(err.message || 'Hiba történt');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/admin/partners"
          className="text-primary-600 hover:text-primary-700 text-sm font-medium"
        >
          &larr; Vissza a partnerekhez
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Új partner</h1>
        <p className="text-gray-500">Új partner cég felvétele a rendszerbe</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">
            Alapadatok
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cég neve *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Példa Kft."
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rövid kód *
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                required
                placeholder="PELDA"
                maxLength={20}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono uppercase"
              />
              <p className="mt-1 text-xs text-gray-500">
                Egyedi azonosító, max. 20 karakter
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kapcsolattartó
              </label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Kiss János"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="info@example.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Telefon
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+36 30 123 4567"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
        </div>

        {/* Billing Type */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">
            Számlázási típus
          </h2>

          <div className="flex gap-4">
            <label
              className={`flex-1 px-4 py-4 border-2 rounded-xl cursor-pointer transition-colors ${
                billingType === 'CONTRACT'
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="billingType"
                value="CONTRACT"
                checked={billingType === 'CONTRACT'}
                onChange={(e) => setBillingType(e.target.value as BillingType)}
                className="sr-only"
              />
              <div className="text-center">
                <div className="text-2xl mb-1">📄</div>
                <p className="font-semibold text-gray-900">Szerződéses</p>
                <p className="text-sm text-gray-500">Gyűjtőszámlázás</p>
              </div>
            </label>

            <label
              className={`flex-1 px-4 py-4 border-2 rounded-xl cursor-pointer transition-colors ${
                billingType === 'CASH'
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="billingType"
                value="CASH"
                checked={billingType === 'CASH'}
                onChange={(e) => setBillingType(e.target.value as BillingType)}
                className="sr-only"
              />
              <div className="text-center">
                <div className="text-2xl mb-1">💵</div>
                <p className="font-semibold text-gray-900">Készpénzes</p>
                <p className="text-sm text-gray-500">Helyben számlázás</p>
              </div>
            </label>
          </div>

          {billingType === 'CONTRACT' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Számlázási ciklus
              </label>
              <div className="flex gap-4">
                <label
                  className={`flex-1 px-4 py-3 border rounded-xl cursor-pointer text-center transition-colors ${
                    billingCycle === 'MONTHLY'
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="billingCycle"
                    value="MONTHLY"
                    checked={billingCycle === 'MONTHLY'}
                    onChange={(e) => setBillingCycle(e.target.value as BillingCycle)}
                    className="sr-only"
                  />
                  Havi
                </label>
                <label
                  className={`flex-1 px-4 py-3 border rounded-xl cursor-pointer text-center transition-colors ${
                    billingCycle === 'WEEKLY'
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="billingCycle"
                    value="WEEKLY"
                    checked={billingCycle === 'WEEKLY'}
                    onChange={(e) => setBillingCycle(e.target.value as BillingCycle)}
                    className="sr-only"
                  />
                  Heti
                </label>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                {billingCycle === 'MONTHLY'
                  ? 'A számla minden hónap végén kerül kiállításra az adott hónap összes mosásáról.'
                  : 'A számla minden hét végén kerül kiállításra az adott hét összes mosásáról.'}
              </p>
            </div>
          )}
        </div>

        {/* Billing Info */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">
            Számlázási adatok
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Számlázási név
              </label>
              <input
                type="text"
                value={billingName}
                onChange={(e) => setBillingName(e.target.value)}
                placeholder="Ha eltér a cégnévtől"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Számlázási cím
              </label>
              <input
                type="text"
                value={billingAddress}
                onChange={(e) => setBillingAddress(e.target.value)}
                placeholder="Példa utca 123."
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Irányítószám
              </label>
              <input
                type="text"
                value={billingZipCode}
                onChange={(e) => setBillingZipCode(e.target.value)}
                placeholder="1234"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Város
              </label>
              <input
                type="text"
                value={billingCity}
                onChange={(e) => setBillingCity(e.target.value)}
                placeholder="Budapest"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Adószám
              </label>
              <input
                type="text"
                value={taxNumber}
                onChange={(e) => setTaxNumber(e.target.value)}
                placeholder="12345678-1-23"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                EU adószám
              </label>
              <input
                type="text"
                value={euVatNumber}
                onChange={(e) => setEuVatNumber(e.target.value)}
                placeholder="HU12345678"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono"
              />
              <p className="mt-1 text-xs text-gray-500">
                Közösségi adószám (ha van)
              </p>
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
            href="/admin/partners"
            className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl text-center hover:bg-gray-200 transition-colors"
          >
            Mégse
          </Link>
          <button
            type="submit"
            disabled={submitting || !name || !code}
            className="flex-1 py-3 bg-primary-600 text-white font-medium rounded-xl
                       hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors"
          >
            {submitting ? 'Létrehozás...' : 'Partner létrehozása'}
          </button>
        </div>
      </form>
    </div>
  );
}
