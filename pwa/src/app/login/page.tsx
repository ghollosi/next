'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { saveSession, getPendingLocation, clearPendingLocation } from '@/lib/session';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  // Check for verification callback from email link
  useEffect(() => {
    const verified = searchParams.get('verified');
    const errorMsg = searchParams.get('error');

    if (verified === 'true') {
      setVerificationMessage({
        type: 'success',
        text: 'Email cím sikeresen megerősítve! Most már bejelentkezhetsz.',
      });
    } else if (verified === 'false') {
      setVerificationMessage({
        type: 'error',
        text: errorMsg || 'A megerősítő link érvénytelen vagy lejárt.',
      });
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.login(email, password);

      saveSession(response.sessionId, {
        driverId: response.driverId,
        networkId: response.networkId,
        partnerCompanyId: response.partnerCompanyId || null,
        firstName: response.firstName,
        lastName: response.lastName,
        partnerCompanyName: response.partnerCompanyName || null,
        isPrivateCustomer: response.isPrivateCustomer || !response.partnerCompanyId,
        billingName: response.billingName,
        billingAddress: response.billingAddress,
        billingCity: response.billingCity,
        billingZipCode: response.billingZipCode,
        billingCountry: response.billingCountry,
        billingTaxNumber: response.billingTaxNumber,
      });

      // QR kód flow: ha van pending location, oda irányítunk
      const pendingLocation = getPendingLocation();
      if (pendingLocation) {
        clearPendingLocation();
        router.push(`/wash/new?location=${pendingLocation}`);
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bejelentkezés sikertelen');
    } finally {
      setLoading(false);
    }
  };

  const isSubmitDisabled = () => {
    if (loading) return true;
    if (!email.includes('@') || email.length < 5) return true;
    if (password.length < 8) return true;
    return false;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-600 to-primary-800 flex flex-col">
      {/* Header */}
      <div className="safe-area-top px-6 pt-12 pb-8 text-center">
        <div className="w-20 h-20 bg-white rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg">
          <svg className="w-12 h-12 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">VSys Wash</h1>
        <p className="text-primary-200">Sofőr Bejelentkezés</p>
      </div>

      {/* Login Form */}
      <div className="flex-1 bg-white rounded-t-3xl px-6 pt-6 pb-6 safe-area-bottom">
        {/* Verification Message */}
        {verificationMessage && (
          <div className={`mb-6 rounded-xl px-4 py-3 ${
            verificationMessage.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            <p className="text-sm font-medium">{verificationMessage.text}</p>
          </div>
        )}

        <h2 className="text-xl font-semibold text-gray-800 mb-6 text-center">
          Bejelentkezés
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email cím
            </label>
            <input
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value.trim())}
              placeholder="pelda@email.com"
              className="w-full px-4 py-4 text-lg border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-0 focus:outline-none"
              autoComplete="email"
            />
          </div>

          {/* Password Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Jelszó
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-4 text-lg border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-0 focus:outline-none"
              autoComplete="current-password"
            />
            <p className="text-xs text-gray-500 mt-1 text-center">
              Minimum 8 karakter
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-danger-500/10 border border-danger-500/20 rounded-xl px-4 py-3 text-danger-600 text-center">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitDisabled()}
            className="w-full bg-primary-600 text-white py-4 px-6 rounded-xl text-lg font-semibold
                       disabled:bg-gray-300 disabled:cursor-not-allowed
                       hover:bg-primary-700 active:bg-primary-800 transition-colors
                       touch-button"
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
        <div className="mt-8 text-center space-y-3">
          <a href="/forgot-password" className="text-sm text-primary-600 hover:underline block">
            Elfelejtetted a jelszavad?
          </a>
          <div className="pt-2 border-t border-gray-100">
            <p className="text-sm text-gray-500 pt-3">
              Nincs még fiókod? Kérd a diszpécsereddel!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-primary-600 to-primary-800 flex items-center justify-center">
        <p className="text-white">Betöltés...</p>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
