'use client';

import { useState } from 'react';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function DriverForgotPinPage() {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handlePhoneChange = (value: string) => {
    // Allow digits, +, spaces, and dashes
    const cleaned = value.replace(/[^\d\s\-+]/g, '');
    setPhone(cleaned);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/pwa/request-pin-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.replace(/[\s\-]/g, '') }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Hiba tortent');
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba tortent');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-600 to-blue-800 flex flex-col">
      {/* Header */}
      <div className="px-6 pt-12 pb-8 text-center">
        <div className="w-20 h-20 bg-white rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg">
          <svg className="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Elfelejtett PIN kod</h1>
        <p className="text-blue-200">Kerj segitseget a PIN visszaallitashoz</p>
      </div>

      {/* Form */}
      <div className="flex-1 bg-white rounded-t-3xl px-6 pt-8 pb-6">
        {success ? (
          <div className="text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Keres elkuldve!</h2>
            <p className="text-gray-600 mb-6">
              Ha a telefonszam regisztralva van a rendszerben, a PIN visszaallitasi kerelmet
              tovabbitottuk a ceged adminisztratoranak. Hamarosan felveszi veled a kapcsolatot.
            </p>
            <Link
              href="/login"
              className="inline-block px-8 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
            >
              Vissza a bejelentkezeshez
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-2">Hogyan mukodik?</h2>
              <div className="bg-blue-50 rounded-xl p-4 space-y-2 text-sm text-gray-600">
                <p>1. Add meg a regisztralt telefonszamod</p>
                <p>2. A kerelmet tovabbitjuk a ceged adminisztratoranak</p>
                <p>3. Az admin felveszi veled a kapcsolatot es beallitja az uj PIN kododat</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Telefonszam
                </label>
                <input
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  placeholder="+36 30 123 4567"
                  className="w-full px-4 py-4 text-xl text-center tracking-wide font-mono border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-0 focus:outline-none"
                  autoComplete="tel"
                />
                <p className="text-xs text-gray-500 mt-1 text-center">
                  A regisztraciokor megadott telefonszam
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-center">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || phone.replace(/[\s\-+]/g, '').length < 9}
                className="w-full bg-blue-600 text-white py-4 px-6 rounded-xl text-lg font-semibold
                           disabled:bg-gray-300 disabled:cursor-not-allowed
                           hover:bg-blue-700 active:bg-blue-800 transition-colors"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Kuldes...
                  </span>
                ) : (
                  'PIN visszaallitas kerese'
                )}
              </button>
            </form>

            <div className="mt-8 text-center">
              <Link href="/login" className="text-gray-500 hover:text-gray-700 text-sm">
                Vissza a bejelentkezeshez
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
