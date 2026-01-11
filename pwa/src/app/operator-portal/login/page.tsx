'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API_URL = 'https://api.vemiax.com';

export default function OperatorLoginPage() {
  const router = useRouter();
  const [locationCode, setLocationCode] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/operator-portal/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ locationCode: locationCode.toUpperCase(), pin }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Bejelentkezés sikertelen');
      }

      const data = await response.json();

      // Save session
      localStorage.setItem('operator_session', data.sessionId);
      localStorage.setItem('operator_info', JSON.stringify({
        locationId: data.locationId,
        locationName: data.locationName,
        locationCode: data.locationCode,
        washMode: data.washMode,
        networkName: data.networkName,
      }));

      router.push('/operator-portal/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bejelentkezés sikertelen');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-600 to-green-800 flex flex-col">
      {/* Header */}
      <div className="px-6 pt-12 pb-8 text-center">
        <div className="w-20 h-20 bg-white rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg">
          <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Operátor Portál</h1>
        <p className="text-green-200">VSys Wash Management</p>
      </div>

      {/* Login Form */}
      <div className="flex-1 bg-white rounded-t-3xl px-6 pt-8 pb-6">
        <h2 className="text-2xl font-semibold text-gray-800 mb-6 text-center">
          Mosó Bejelentkezés
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Location Code Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Helyszín kód
            </label>
            <input
              type="text"
              value={locationCode}
              onChange={(e) => setLocationCode(e.target.value.toUpperCase())}
              placeholder="BP01"
              className="w-full px-4 py-4 text-xl text-center tracking-wider font-mono border-2 border-gray-200 rounded-xl focus:border-green-500 focus:ring-0 focus:outline-none uppercase"
              autoComplete="off"
              autoCapitalize="characters"
            />
            <p className="text-xs text-gray-500 mt-1 text-center">
              A mosó állomás kódja
            </p>
          </div>

          {/* PIN Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              PIN kód
            </label>
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="••••"
              className="w-full px-4 py-4 text-2xl text-center tracking-[0.75em] font-mono border-2 border-gray-200 rounded-xl focus:border-green-500 focus:ring-0 focus:outline-none"
              maxLength={4}
              autoComplete="off"
            />
            <p className="text-xs text-gray-500 mt-1 text-center">
              4 számjegyű PIN (demo: 1234)
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-center">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!locationCode || pin.length !== 4 || loading}
            className="w-full bg-green-600 text-white py-4 px-6 rounded-xl text-lg font-semibold
                       disabled:bg-gray-300 disabled:cursor-not-allowed
                       hover:bg-green-700 active:bg-green-800 transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Bejelentkezés...
              </span>
            ) : (
              'Bejelentkezés'
            )}
          </button>
        </form>

        {/* Help Text */}
        <div className="mt-8 text-center space-y-2">
          <p className="text-sm text-gray-500">
            Operátori hozzáféréshez fordulj az adminisztrátorhoz!
          </p>
          <a href="/login" className="text-sm text-green-600 hover:underline">
            Sofőr bejelentkezés
          </a>
        </div>
      </div>
    </div>
  );
}
