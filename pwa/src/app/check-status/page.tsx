'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import DriverEmiWrapper from '@/components/DriverEmiWrapper';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

function CheckStatusContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const driverIdParam = searchParams.get('driverId');

  const [driverId, setDriverId] = useState(driverIdParam || '');
  const [pin, setPin] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    message: string;
    inviteCode?: string;
    rejectionReason?: string;
  } | null>(null);

  const handleCheck = async () => {
    setError('');
    setResult(null);

    if (pin.length !== 4) {
      setError('Adj meg 4 számjegyű PIN kódot');
      return;
    }

    setChecking(true);

    try {
      const response = await fetch(`${API_URL}/pwa/check-approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId, pin }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Hiba történt');
      }

      const data = await response.json();
      setResult(data);

      // If approved, redirect to login after showing the code
      if (data.status === 'APPROVED' && data.inviteCode) {
        // Save for auto-fill on login
        localStorage.setItem('vsys_invite_code', data.inviteCode);
      }
    } catch (err: any) {
      setError(err.message || 'Hiba történt');
    } finally {
      setChecking(false);
    }
  };

  const handleGoToLogin = () => {
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Státusz ellenőrzése</h1>
          <p className="text-gray-600 mt-1">Add meg a PIN kódodat a státusz lekérdezéséhez</p>
        </div>

        {!result ? (
          <div className="space-y-4">
            {!driverIdParam && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sofőr azonosító
                </label>
                <input
                  type="text"
                  value={driverId}
                  onChange={(e) => setDriverId(e.target.value)}
                  placeholder="uuid..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono text-sm"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                PIN kód
              </label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                maxLength={4}
                placeholder="••••"
                inputMode="numeric"
                className="w-full px-4 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-center text-3xl tracking-widest font-mono"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={handleCheck}
              disabled={checking || pin.length !== 4 || !driverId}
              className="w-full py-3 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {checking ? 'Ellenőrzés...' : 'Ellenőrzés'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Status Result */}
            {result.status === 'PENDING' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
                <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-yellow-800 mb-2">Jóváhagyásra vár</h3>
                <p className="text-yellow-700 text-sm">{result.message}</p>
              </div>
            )}

            {result.status === 'APPROVED' && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-green-800 mb-2">Jóváhagyva!</h3>
                <p className="text-green-700 text-sm mb-4">{result.message}</p>

                {result.inviteCode && (
                  <div className="bg-white rounded-xl p-4 border border-green-300">
                    <p className="text-sm text-gray-600 mb-1">A belépési kódod:</p>
                    <p className="text-3xl font-mono font-bold text-primary-600 tracking-wider">
                      {result.inviteCode}
                    </p>
                  </div>
                )}
              </div>
            )}

            {result.status === 'REJECTED' && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-red-800 mb-2">Elutasítva</h3>
                <p className="text-red-700 text-sm">{result.message}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              {result.status === 'APPROVED' && (
                <button
                  onClick={handleGoToLogin}
                  className="flex-1 py-3 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 transition-colors"
                >
                  Belépés
                </button>
              )}

              <button
                onClick={() => {
                  setResult(null);
                  setPin('');
                }}
                className={`${result.status === 'APPROVED' ? '' : 'flex-1'} py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors px-6`}
              >
                Újra
              </button>
            </div>
          </div>
        )}

        {/* Footer links */}
        <div className="mt-6 text-center space-y-2">
          <Link href="/" className="block text-primary-600 hover:text-primary-700 text-sm font-medium">
            Belépés meglévő fiókkal
          </Link>
          <Link href="/register" className="block text-gray-500 hover:text-gray-700 text-sm">
            Új regisztráció
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function CheckStatusPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Betöltés...</p>
      </div>
    }>
      <CheckStatusContent />
      <DriverEmiWrapper />
    </Suspense>
  );
}
