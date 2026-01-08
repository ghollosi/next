'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export default function PartnerLoginPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/partner-portal/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: code.toUpperCase(), pin }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Bejelentkezés sikertelen');
      }

      const data = await response.json();

      // Save session
      localStorage.setItem('partner_session', data.sessionId);
      localStorage.setItem('partner_info', JSON.stringify({
        partnerId: data.partnerId,
        partnerName: data.partnerName,
        partnerCode: data.partnerCode,
      }));

      router.push('/partner/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bejelentkezés sikertelen');
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
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Partner Portál</h1>
        <p className="text-blue-200">VSys Wash Management</p>
      </div>

      {/* Login Form */}
      <div className="flex-1 bg-white rounded-t-3xl px-6 pt-8 pb-6">
        <h2 className="text-2xl font-semibold text-gray-800 mb-6 text-center">
          Partner Bejelentkezés
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Partner Code Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Partner kód
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="HUNGATRANS"
              className="w-full px-4 py-4 text-xl text-center tracking-wider font-mono border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-0 focus:outline-none uppercase"
              autoComplete="off"
              autoCapitalize="characters"
            />
            <p className="text-xs text-gray-500 mt-1 text-center">
              A cég azonosító kódja
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
              className="w-full px-4 py-4 text-2xl text-center tracking-[0.75em] font-mono border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-0 focus:outline-none"
              maxLength={4}
              autoComplete="off"
            />
            <p className="text-xs text-gray-500 mt-1 text-center">
              4 számjegyű PIN kód
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
            disabled={!code || pin.length !== 4 || loading}
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
            Nincs hozzáférésed? Keresd az üzemeltetőt!
          </p>
          <a href="/login" className="text-sm text-blue-600 hover:underline">
            Sofőr bejelentkezés →
          </a>
        </div>
      </div>
    </div>
  );
}
