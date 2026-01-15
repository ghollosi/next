'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { saveSession, getPendingLocation, clearPendingLocation } from '@/lib/session';

type LoginMethod = 'phone' | 'invite';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('phone');
  const [phone, setPhone] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [pin, setPin] = useState('');
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
      let response;

      if (loginMethod === 'phone') {
        response = await api.loginByPhone(phone, pin);
      } else {
        response = await api.activate(inviteCode.toUpperCase(), pin);
      }

      saveSession(response.sessionId, {
        driverId: response.driverId,
        networkId: response.networkId,
        partnerCompanyId: response.partnerCompanyId,
        firstName: response.firstName,
        lastName: response.lastName,
        partnerCompanyName: response.partnerCompanyName,
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

  const handlePinChange = (value: string) => {
    // Only allow digits and max 4 characters
    const cleaned = value.replace(/\D/g, '').slice(0, 4);
    setPin(cleaned);
  };

  const handlePhoneChange = (value: string) => {
    // Allow digits, +, spaces, and dashes
    const cleaned = value.replace(/[^\d\s\-+]/g, '');
    setPhone(cleaned);
  };

  const handleInviteChange = (value: string) => {
    // Only allow alphanumeric and max 6 characters
    const cleaned = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6);
    setInviteCode(cleaned);
  };

  const isSubmitDisabled = () => {
    if (loading) return true;
    if (pin.length !== 4) return true;
    if (loginMethod === 'phone') {
      return phone.replace(/[\s\-+]/g, '').length < 9;
    } else {
      return inviteCode.length !== 6;
    }
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

        {/* Login Method Toggle */}
        <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
          <button
            type="button"
            onClick={() => { setLoginMethod('phone'); setError(''); }}
            className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-colors ${
              loginMethod === 'phone'
                ? 'bg-white text-primary-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Telefonszám
          </button>
          <button
            type="button"
            onClick={() => { setLoginMethod('invite'); setError(''); }}
            className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-colors ${
              loginMethod === 'invite'
                ? 'bg-white text-primary-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Meghívó kód
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Phone Input (shown when phone method selected) */}
          {loginMethod === 'phone' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Telefonszám
              </label>
              <input
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="+36 30 123 4567"
                className="w-full px-4 py-4 text-xl text-center tracking-wide font-mono border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-0 focus:outline-none"
                autoComplete="tel"
              />
              <p className="text-xs text-gray-500 mt-1 text-center">
                A regisztrációkor megadott telefonszám
              </p>
            </div>
          )}

          {/* Invite Code Input (shown when invite method selected) */}
          {loginMethod === 'invite' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Meghívó kód
              </label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => handleInviteChange(e.target.value)}
                placeholder="ABC123"
                className="w-full px-4 py-4 text-2xl text-center tracking-[0.5em] font-mono border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-0 focus:outline-none uppercase"
                maxLength={6}
                autoComplete="off"
                autoCapitalize="characters"
              />
              <p className="text-xs text-gray-500 mt-1 text-center">
                6 karakteres kód a cégedtől
              </p>
            </div>
          )}

          {/* PIN Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              PIN kód
            </label>
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => handlePinChange(e.target.value)}
              placeholder="••••"
              className="w-full px-4 py-4 text-2xl text-center tracking-[0.75em] font-mono border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-0 focus:outline-none"
              maxLength={4}
              autoComplete="off"
            />
            <p className="text-xs text-gray-500 mt-1 text-center">
              4 számjegyű PIN
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
          <a href="/forgot-pin" className="text-sm text-primary-600 hover:underline block">
            Elfelejtetted a PIN kódod?
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
