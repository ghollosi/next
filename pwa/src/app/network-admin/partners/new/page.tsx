'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { networkAdminApi } from '@/lib/network-admin-api';
import { AddressInput, AddressData } from '@/components/address';

export default function NewPartnerPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [taxNumber, setTaxNumber] = useState('');
  const [addressData, setAddressData] = useState<AddressData>({
    postalCode: '',
    city: '',
    street: '',
    country: 'HU',
  });
  const [euVatNumber, setEuVatNumber] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  // VIES validation state
  const [viesValidating, setViesValidating] = useState(false);
  const [viesResult, setViesResult] = useState<{
    valid: boolean;
    name?: string;
    address?: string;
    error?: string;
  } | null>(null);

  const handleViesValidation = async () => {
    if (!euVatNumber) return;

    setViesValidating(true);
    setViesResult(null);

    try {
      const result = await networkAdminApi.validateVatNumber(euVatNumber);
      setViesResult(result);

      // If valid, optionally auto-fill name if empty
      if (result.valid && result.name && !name) {
        setName(result.name);
      }
    } catch (err: any) {
      setViesResult({
        valid: false,
        error: err.message || 'VIES validacio sikertelen',
      });
    } finally {
      setViesValidating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      // Build billing address from components
      const billingAddress = addressData.street
        ? `${addressData.postalCode} ${addressData.city}, ${addressData.street}`
        : addressData.city
        ? `${addressData.postalCode} ${addressData.city}`
        : '';

      await networkAdminApi.createPartnerCompany({
        name,
        taxNumber,
        billingAddress: billingAddress || undefined,
        billingCity: addressData.city || undefined,
        billingZipCode: addressData.postalCode || undefined,
        billingCountry: addressData.country,
        euVatNumber: euVatNumber || undefined,
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
                EU kozossegi adoszam
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={euVatNumber}
                  onChange={(e) => {
                    setEuVatNumber(e.target.value.toUpperCase());
                    setViesResult(null);
                  }}
                  placeholder="pl. HU12345678"
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono"
                />
                <button
                  type="button"
                  onClick={handleViesValidation}
                  disabled={!euVatNumber || viesValidating}
                  className="px-4 py-3 bg-blue-600 text-white font-medium rounded-xl
                             hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                             transition-colors whitespace-nowrap"
                >
                  {viesValidating ? 'Ellenorzes...' : 'VIES ellenorzes'}
                </button>
              </div>

              {/* VIES Result */}
              {viesResult && (
                <div className={`mt-2 p-3 rounded-lg text-sm ${
                  viesResult.valid
                    ? 'bg-green-50 border border-green-200 text-green-700'
                    : 'bg-red-50 border border-red-200 text-red-700'
                }`}>
                  {viesResult.valid ? (
                    <div>
                      <div className="font-semibold flex items-center gap-2">
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Ervenyes EU adoszam
                      </div>
                      {viesResult.name && <div className="mt-1">Cegnev: {viesResult.name}</div>}
                      {viesResult.address && <div>Cim: {viesResult.address}</div>}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      {viesResult.error || 'Ervenytelen EU adoszam'}
                    </div>
                  )}
                </div>
              )}

              <p className="mt-1 text-xs text-gray-500">
                Kulfoldi EU-s partnerek esetén kotelezo megadni a kozossegi adoszamot az afamentes szamlazashoz.
              </p>
            </div>
          </div>
        </div>

        {/* Billing Address */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">
            Szamlazasi cim
          </h2>

          <AddressInput
            value={addressData}
            onChange={setAddressData}
            defaultCountry="HU"
            showCountry={true}
            required={false}
          />
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
          <strong>EU szamlazas:</strong> Ha a partner mas EU-s orszagban mukodik, az ervenyes kozossegi adoszam
          megadasaval afamentes szamlat allithatunk ki. A rendszer automatikusan ellenorzi a VIES adatbazisban
          a szamla kiallitasa elott.
        </p>
      </div>
    </div>
  );
}
