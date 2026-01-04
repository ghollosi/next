'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const NETWORK_ID = 'cf808392-6283-4487-9fbd-e72951ca5bf8';

export default function EditDriverPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [partnerCompanyName, setPartnerCompanyName] = useState('');

  // PIN change
  const [showPinChange, setShowPinChange] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [pinChanging, setPinChanging] = useState(false);
  const [pinSuccess, setPinSuccess] = useState(false);

  useEffect(() => {
    loadDriver();
  }, [params.id]);

  const loadDriver = async () => {
    try {
      const response = await fetch(`${API_URL}/operator/drivers/${params.id}`, {
        headers: { 'x-network-id': NETWORK_ID },
      });

      if (response.ok) {
        const data = await response.json();
        setFirstName(data.firstName || '');
        setLastName(data.lastName || '');
        setPhone(data.phone || '');
        setEmail(data.email || '');
        setPartnerCompanyName(data.partnerCompany?.name || '');
      } else {
        throw new Error('Nem sikerült betölteni a sofőrt');
      }
    } catch (err: any) {
      setError(err.message || 'Hiba történt');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/operator/drivers/${params.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-network-id': NETWORK_ID,
        },
        body: JSON.stringify({
          firstName,
          lastName,
          phone: phone || undefined,
          email: email || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Nem sikerült menteni a változtatásokat');
      }

      router.push(`/admin/drivers/${params.id}`);
    } catch (err: any) {
      setError(err.message || 'Hiba történt');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePinChange = async () => {
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      setError('A PIN kód pontosan 4 számjegyből kell álljon');
      return;
    }

    if (newPin !== confirmNewPin) {
      setError('A PIN kódok nem egyeznek');
      return;
    }

    setPinChanging(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/operator/drivers/${params.id}/pin`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-network-id': NETWORK_ID,
        },
        body: JSON.stringify({ pin: newPin }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Nem sikerült módosítani a PIN-t');
      }

      setPinSuccess(true);
      setNewPin('');
      setConfirmNewPin('');
      setTimeout(() => {
        setShowPinChange(false);
        setPinSuccess(false);
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Hiba történt');
    } finally {
      setPinChanging(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-500">Betöltés...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/admin/drivers/${params.id}`}
          className="text-primary-600 hover:text-primary-700 text-sm font-medium"
        >
          &larr; Vissza a sofőrhöz
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Sofőr szerkesztése</h1>
        <p className="text-gray-500">{partnerCompanyName}</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
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
          </div>
        </div>

        {/* PIN Change */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <h2 className="text-lg font-semibold text-gray-900">
              PIN kód
            </h2>
            <button
              type="button"
              onClick={() => setShowPinChange(!showPinChange)}
              className="text-primary-600 hover:text-primary-700 text-sm font-medium"
            >
              {showPinChange ? 'Mégsem' : 'PIN módosítása'}
            </button>
          </div>

          {showPinChange ? (
            <div className="space-y-4">
              {pinSuccess ? (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                  <p className="text-green-700 font-medium">PIN sikeresen módosítva!</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Új PIN kód
                      </label>
                      <input
                        type="password"
                        value={newPin}
                        onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        maxLength={4}
                        placeholder="••••"
                        inputMode="numeric"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-center text-2xl tracking-widest font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Megerősítés
                      </label>
                      <input
                        type="password"
                        value={confirmNewPin}
                        onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        maxLength={4}
                        placeholder="••••"
                        inputMode="numeric"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-center text-2xl tracking-widest font-mono"
                      />
                    </div>
                  </div>

                  {newPin && confirmNewPin && newPin !== confirmNewPin && (
                    <p className="text-red-600 text-sm">A PIN kódok nem egyeznek!</p>
                  )}

                  <button
                    type="button"
                    onClick={handlePinChange}
                    disabled={pinChanging || !newPin || !confirmNewPin || newPin !== confirmNewPin}
                    className="w-full py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
                  >
                    {pinChanging ? 'Mentés...' : 'PIN módosítása'}
                  </button>
                </>
              )}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">
              A PIN kód titkosítva van tárolva. Új PIN beállításához kattints a "PIN módosítása" gombra.
            </p>
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
            href={`/admin/drivers/${params.id}`}
            className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl text-center hover:bg-gray-200 transition-colors"
          >
            Mégse
          </Link>
          <button
            type="submit"
            disabled={submitting || !firstName || !lastName}
            className="flex-1 py-3 bg-primary-600 text-white font-medium rounded-xl
                       hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors"
          >
            {submitting ? 'Mentés...' : 'Változtatások mentése'}
          </button>
        </div>
      </form>
    </div>
  );
}
