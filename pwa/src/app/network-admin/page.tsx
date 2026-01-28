'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { networkAdminApi, saveNetworkAdminSession } from '@/lib/network-admin-api';

function NetworkAdminLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailNotVerified, setEmailNotVerified] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState('');

  // Check for verification status from URL params
  useEffect(() => {
    const verified = searchParams.get('verified');
    const message = searchParams.get('message');
    const errorParam = searchParams.get('error');

    if (verified === 'true' && message) {
      setVerificationMessage(decodeURIComponent(message));
    } else if (verified === 'false' && errorParam) {
      setError(decodeURIComponent(errorParam));
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setEmailNotVerified(false);
    setResendSuccess(false);
    setVerificationMessage('');

    try {
      const response = await networkAdminApi.login(email, password);
      saveNetworkAdminSession(response.accessToken, {
        id: response.adminId,
        name: response.name,
        email: response.email,
        role: response.role,
        networkId: response.networkId,
        networkName: response.networkName,
        networkSlug: response.networkSlug,
      });
      router.push('/network-admin/dashboard');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Bejelentkezés sikertelen';
      if (errorMessage.includes('EMAIL_NOT_VERIFIED')) {
        setEmailNotVerified(true);
        setError('Az email cím nincs megerősítve. Kérlek kattints a megerősítő linkre az emailedben, vagy kérj újat.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email) {
      setError('Kérlek add meg az email címet.');
      return;
    }

    setResendLoading(true);
    setError('');
    setResendSuccess(false);

    try {
      await networkAdminApi.resendVerificationEmail(email);
      setResendSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nem sikerült újraküldeni az emailt');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo and title */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Network Admin</h1>
          <p className="text-gray-400 mt-1">Jelentkezz be a hálózatodba</p>
        </div>

        {/* Login form */}
        <div className="bg-gray-800 rounded-2xl p-6 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Email cím
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="admin@example.com"
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Jelszó
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {verificationMessage && (
              <div className="bg-green-900/50 border border-green-500 rounded-lg px-4 py-3 text-green-300 text-sm">
                {verificationMessage}
              </div>
            )}

            {resendSuccess && (
              <div className="bg-green-900/50 border border-green-500 rounded-lg px-4 py-3 text-green-300 text-sm">
                Megerősítő email elküldve! Kérlek ellenőrizd a postafiókod.
              </div>
            )}

            {error && (
              <div className="bg-red-900/50 border border-red-500 rounded-lg px-4 py-3 text-red-300 text-sm">
                {error}
              </div>
            )}

            {emailNotVerified && (
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={resendLoading}
                className="w-full py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
              >
                {resendLoading ? 'Küldés...' : 'Megerősítő email újraküldése'}
              </button>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {loading ? 'Bejelentkezés...' : 'Bejelentkezés'}
            </button>
          </form>
        </div>

        <div className="text-center mt-6 space-y-2">
          <p className="text-gray-500 text-sm">
            <Link href="/network-admin/forgot-password" className="text-blue-400 hover:text-blue-300">
              Elfelejtett jelszó?
            </Link>
          </p>
          <p className="text-gray-500 text-sm">
            Nincs még fiókja?{' '}
            <Link href="/network-admin/register" className="text-blue-400 hover:text-blue-300">
              Regisztráljon és próbálja ki ingyen!
            </Link>
          </p>
          <p className="text-gray-600 text-xs">
            VSys Network Admin Panel
          </p>
        </div>
      </div>
    </div>
  );
}

export default function NetworkAdminLoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Betöltés...</div>
      </div>
    }>
      <NetworkAdminLoginContent />
    </Suspense>
  );
}
