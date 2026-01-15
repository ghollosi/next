'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const NETWORK_ID = 'cf808392-6283-4487-9fbd-e72951ca5bf8';

interface PartnerCompany {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

export default function NewDriverPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [partners, setPartners] = useState<PartnerCompany[]>([]);
  const [loadingPartners, setLoadingPartners] = useState(true);

  // Form state
  const [partnerCompanyId, setPartnerCompanyId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  // Result state (for showing invite code after creation)
  const [createdDriver, setCreatedDriver] = useState<{
    id: string;
    firstName: string;
    lastName: string;
    invite: { inviteCode: string };
  } | null>(null);

  useEffect(() => {
    loadPartners();
  }, []);

  const loadPartners = async () => {
    try {
      const response = await fetch(`${API_URL}/operator/partner-companies?activeOnly=true`, {
        headers: { 'x-network-id': NETWORK_ID },
      });

      if (response.ok) {
        const data = await response.json();
        setPartners(data);
      }
    } catch (err) {
      console.error('Failed to load partners:', err);
    } finally {
      setLoadingPartners(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate PIN
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      setError('A PIN kód pontosan 4 számjegyből kell álljon');
      return;
    }

    if (pin !== confirmPin) {
      setError('A PIN kódok nem egyeznek');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/operator/drivers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-network-id': NETWORK_ID,
        },
        body: JSON.stringify({
          partnerCompanyId,
          firstName,
          lastName,
          phone: phone || undefined,
          email: email || undefined,
          pin,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Nem sikerült létrehozni a sofőrt');
      }

      const driver = await response.json();
      setCreatedDriver(driver);
    } catch (err: any) {
      setError(err.message || 'Hiba történt');
    } finally {
      setSubmitting(false);
    }
  };

  // Show success screen with invite code
  if (createdDriver) {
    return (
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Sofőr létrehozva!
          </h1>
          <p className="text-gray-600 mb-6">
            {createdDriver.lastName} {createdDriver.firstName} sikeresen regisztrálva.
          </p>

          <div className="bg-primary-50 rounded-xl p-6 mb-6">
            <p className="text-sm text-primary-700 mb-2">Meghívó kód:</p>
            <p className="text-4xl font-mono font-bold text-primary-600 tracking-wider">
              {createdDriver.invite.inviteCode}
            </p>
            <p className="text-xs text-primary-600 mt-2">
              A sofőr ezzel a kóddal és a beállított PIN-nel tud belépni az appba.
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              href="/admin/drivers"
              className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl text-center hover:bg-gray-200 transition-colors"
            >
              Vissza a listához
            </Link>
            <button
              onClick={() => {
                setCreatedDriver(null);
                setFirstName('');
                setLastName('');
                setPhone('');
                setEmail('');
                setPin('');
                setConfirmPin('');
              }}
              className="flex-1 py-3 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 transition-colors"
            >
              Új sofőr
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/admin/drivers"
          className="text-primary-600 hover:text-primary-700 text-sm font-medium"
        >
          &larr; Vissza a sofőrökhöz
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Új sofőr</h1>
        <p className="text-gray-500">Új sofőr regisztrálása a rendszerbe</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Partner Selection */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">
            Partner cég
          </h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Melyik céghez tartozik? *
            </label>
            {loadingPartners ? (
              <p className="text-gray-500 py-3">Partnerek betöltése...</p>
            ) : partners.length === 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <p className="text-yellow-700 text-sm">
                  Nincs aktív partner cég. Először{' '}
                  <Link href="/admin/partners/new" className="underline font-medium">
                    hozz létre egyet
                  </Link>
                  .
                </p>
              </div>
            ) : (
              <select
                value={partnerCompanyId}
                onChange={(e) => setPartnerCompanyId(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Válassz céget...</option>
                {partners.map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {partner.name} ({partner.code})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Basic Info */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">
            Személyes adatok
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vezetéknév *
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                placeholder="Kovács"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Keresztnév *
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                placeholder="János"
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="sofor@example.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
        </div>

        {/* PIN Setup */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">
            Belépési PIN kód
          </h2>
          <p className="text-sm text-gray-600">
            A sofőr ezzel a 4 számjegyű PIN kóddal fog tudni belépni az appba.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                PIN kód *
              </label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                required
                maxLength={4}
                placeholder="••••"
                inputMode="numeric"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-center text-2xl tracking-widest font-mono"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                PIN megerősítés *
              </label>
              <input
                type="password"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                required
                maxLength={4}
                placeholder="••••"
                inputMode="numeric"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-center text-2xl tracking-widest font-mono"
              />
            </div>
          </div>

          {pin && confirmPin && pin !== confirmPin && (
            <p className="text-red-600 text-sm">A PIN kódok nem egyeznek!</p>
          )}
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
            href="/admin/drivers"
            className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl text-center hover:bg-gray-200 transition-colors"
          >
            Mégse
          </Link>
          <button
            type="submit"
            disabled={submitting || !partnerCompanyId || !firstName || !lastName || !pin || !confirmPin || pin !== confirmPin}
            className="flex-1 py-3 bg-primary-600 text-white font-medium rounded-xl
                       hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors"
          >
            {submitting ? 'Létrehozás...' : 'Sofőr létrehozása'}
          </button>
        </div>
      </form>
    </div>
  );
}
