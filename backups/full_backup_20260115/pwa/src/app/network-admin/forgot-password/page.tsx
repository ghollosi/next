'use client';

import { useState } from 'react';
import Link from 'next/link';
import { networkAdminApi } from '@/lib/network-admin-api';

export default function ForgotPasswordPage() {
  const [slug, setSlug] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      await networkAdminApi.forgotPassword(email, slug);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba történt');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo and title */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Elfelejtett jelszó</h1>
          <p className="text-gray-400 mt-1">Add meg az email címed a jelszó visszaállításhoz</p>
        </div>

        {/* Form */}
        <div className="bg-gray-800 rounded-2xl p-6 shadow-xl">
          {success ? (
            <div className="text-center">
              <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Email elküldve!</h2>
              <p className="text-gray-400 mb-6">
                Ha a megadott email cím létezik a rendszerben, elküldtük a jelszó visszaállító linket.
                Kérjük, ellenőrizd a postafiókod (és a spam mappát is).
              </p>
              <Link
                href="/network-admin"
                className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Vissza a bejelentkezéshez
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Hálózat azonosító
                </label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase())}
                  required
                  placeholder="pl. wash-center"
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

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

              {error && (
                <div className="bg-red-900/50 border border-red-500 rounded-lg px-4 py-3 text-red-300 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {loading ? 'Küldés...' : 'Jelszó visszaállítás kérése'}
              </button>
            </form>
          )}
        </div>

        <div className="text-center mt-6">
          <Link href="/network-admin" className="text-gray-500 hover:text-gray-400 text-sm">
            Vissza a bejelentkezéshez
          </Link>
        </div>
      </div>
    </div>
  );
}
