'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { saveSession } from '@/lib/session';

export default function LoginPage() {
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.activate(inviteCode.toUpperCase(), pin);

      saveSession(response.sessionId, {
        driverId: response.driverId,
        networkId: response.networkId,
        partnerCompanyId: response.partnerCompanyId,
        firstName: response.firstName,
        lastName: response.lastName,
        partnerCompanyName: response.partnerCompanyName,
      });

      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePinChange = (value: string) => {
    // Only allow digits and max 4 characters
    const cleaned = value.replace(/\D/g, '').slice(0, 4);
    setPin(cleaned);
  };

  const handleInviteChange = (value: string) => {
    // Only allow alphanumeric and max 6 characters
    const cleaned = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6);
    setInviteCode(cleaned);
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
        <p className="text-primary-200">Truck Wash Management</p>
      </div>

      {/* Login Form */}
      <div className="flex-1 bg-white rounded-t-3xl px-6 pt-8 pb-6 safe-area-bottom">
        <h2 className="text-2xl font-semibold text-gray-800 mb-6 text-center">
          Driver Login
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Invite Code Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Invite Code
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
              6-character code from your company
            </p>
          </div>

          {/* PIN Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              PIN
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
              4-digit PIN
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
            disabled={inviteCode.length !== 6 || pin.length !== 4 || loading}
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
                Logging in...
              </span>
            ) : (
              'Login'
            )}
          </button>
        </form>

        {/* Help Text */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            Don&apos;t have a code? Contact your dispatcher.
          </p>
        </div>
      </div>
    </div>
  );
}
