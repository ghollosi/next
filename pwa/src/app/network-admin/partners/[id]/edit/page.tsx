'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetchOperatorApi, networkAdminApi } from '@/lib/network-admin-api';
import { AddressInput, AddressData } from '@/components/address';

type BillingType = 'CONTRACT' | 'CASH';
type BillingCycle = 'MONTHLY' | 'WEEKLY';

export default function NetworkAdminEditPartnerPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
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
  const [addressData, setAddressData] = useState<AddressData>({
    postalCode: '',
    city: '',
    street: '',
    country: 'HU',
  });
  const [taxNumber, setTaxNumber] = useState('');
  const [euVatNumber, setEuVatNumber] = useState('');
  const [paymentDueDays, setPaymentDueDays] = useState<number>(8);
  const [pin, setPin] = useState('');
  const [hasPin, setHasPin] = useState(false);

  // VIES validation state
  const [viesValidating, setViesValidating] = useState(false);
  const [viesResult, setViesResult] = useState<{
    valid: boolean;
    name?: string;
    address?: string;
    error?: string;
  } | null>(null);

  useEffect(() => {
    loadPartner();
  }, [params.id]);

  const loadPartner = async () => {
    try {
      const data = await fetchOperatorApi<any>(`/operator/partner-companies/${params.id}`);
      setName(data.name || '');
      setCode(data.code || '');
      setContactName(data.contactName || '');
      setEmail(data.email || '');
      setPhone(data.phone || '');
      setBillingType(data.billingType || 'CONTRACT');
      setBillingCycle(data.billingCycle || 'MONTHLY');
      setBillingName(data.billingName || '');
      setAddressData({
        postalCode: data.billingZipCode || '',
        city: data.billingCity || '',
        street: data.billingAddress || '',
        country: data.billingCountry || 'HU',
      });
      setTaxNumber(data.taxNumber || '');
      setEuVatNumber(data.euVatNumber || '');
      setPaymentDueDays(data.paymentDueDays ?? 8);
      setHasPin(!!data.pinHash);
    } catch (err: any) {
      setError(err.message || 'Hiba tortent');
    } finally {
      setLoading(false);
    }
  };

  const handleViesValidation = async () => {
    if (!euVatNumber) return;

    setViesValidating(true);
    setViesResult(null);

    try {
      const result = await networkAdminApi.validateVatNumber(euVatNumber);
      setViesResult(result);
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

      const body: Record<string, any> = {
        name,
        contactName: contactName || undefined,
        email: email || undefined,
        phone: phone || undefined,
        billingType,
        billingName: billingName || undefined,
        billingAddress: billingAddress || undefined,
        billingCity: addressData.city || undefined,
        billingZipCode: addressData.postalCode || undefined,
        billingCountry: addressData.country,
        taxNumber: taxNumber || undefined,
        euVatNumber: euVatNumber || undefined,
        paymentDueDays,
      };

      // Add PIN if provided
      if (pin && pin.length >= 4) {
        body.pin = pin;
      }

      // Billing cycle only for CONTRACT
      if (billingType === 'CONTRACT') {
        body.billingCycle = billingCycle;
      } else {
        body.billingCycle = null;
      }

      await fetchOperatorApi(`/operator/partner-companies/${params.id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });

      router.push(`/network-admin/partners/${params.id}`);
    } catch (err: any) {
      setError(err.message || 'Hiba tortent');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-500">Betoltes...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/network-admin/partners/${params.id}`}
          className="text-primary-600 hover:text-primary-700 text-sm font-medium"
        >
          &larr; Vissza a partnerhez
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Partner szerkesztese</h1>
        <p className="text-gray-500 font-mono">{code}</p>
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
                Ceg neve *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rovid kod
              </label>
              <input
                type="text"
                value={code}
                disabled
                className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-500 font-mono"
              />
              <p className="mt-1 text-xs text-gray-500">A kod nem modosithato</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kapcsolattarto
              </label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
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
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
        </div>

        {/* Partner Portal PIN */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">
            Partner Portal hozzaferes
          </h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              PIN kod {hasPin ? '(mar van beallitva)' : '(nincs beallitva)'}
            </label>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder={hasPin ? 'Uj PIN beallitasa (uresen hagyva marad a regi)' : 'Adj meg egy 4+ karakteres PIN-t'}
              minLength={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              A partner ezzel a PIN koddal es a partner koddal ({code}) tud bejelentkezni a Partner Portalba.
            </p>
          </div>
        </div>

        {/* Billing Type */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">
            Szamlazasi tipus
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
                <p className="font-semibold text-gray-900">Szerzodeses</p>
                <p className="text-sm text-gray-500">Gyujtoszamlazas</p>
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
                <p className="font-semibold text-gray-900">Keszpenzes</p>
                <p className="text-sm text-gray-500">Helyben szamlazas</p>
              </div>
            </label>
          </div>

          {billingType === 'CONTRACT' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Szamlazasi ciklus
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
            </div>
          )}
        </div>

        {/* Billing Info */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">
            Szamlazasi adatok
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Szamlazasi nev
              </label>
              <input
                type="text"
                value={billingName}
                onChange={(e) => setBillingName(e.target.value)}
                placeholder="Ha elter a cegnevtol"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            {/* Address Input Component */}
            <AddressInput
              value={addressData}
              onChange={setAddressData}
              defaultCountry="HU"
              showCountry={true}
              required={false}
            />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Adoszam
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
                  Fizetesi hatarido (nap)
                </label>
                <input
                  type="number"
                  value={paymentDueDays}
                onChange={(e) => setPaymentDueDays(parseInt(e.target.value) || 0)}
                min={0}
                max={90}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              </div>
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
                  placeholder="HU12345678"
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

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-4">
          <Link
            href={`/network-admin/partners/${params.id}`}
            className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl text-center hover:bg-gray-200 transition-colors"
          >
            Megse
          </Link>
          <button
            type="submit"
            disabled={submitting || !name}
            className="flex-1 py-3 bg-primary-600 text-white font-medium rounded-xl
                       hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors"
          >
            {submitting ? 'Mentes...' : 'Valtoztatasok mentese'}
          </button>
        </div>
      </form>
    </div>
  );
}
