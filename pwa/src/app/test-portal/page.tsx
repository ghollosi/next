'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Language } from './types';
import { t } from './i18n';
import { validateTesterLogin, setTesterSession, getTesterSession, getTesterByEmail } from './storage';

export default function TestPortalLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [lang, setLang] = useState<Language>('hu');

  useEffect(() => {
    // Check if already logged in
    const session = getTesterSession();
    if (session) {
      router.replace('/test-portal/dashboard');
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const tester = validateTesterLogin(email, password);

      if (!tester) {
        setError(t('login.invalidCredentials', lang));
        setIsLoading(false);
        return;
      }

      setTesterSession(tester);
      router.push('/test-portal/dashboard');
    } catch (err: any) {
      setError(err.message || t('common.error', lang));
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const tester = getTesterByEmail(email);

      if (!tester) {
        // Don't reveal if email exists or not for security
        setSuccess(lang === 'hu'
          ? 'Ha ez az email regisztrálva van, hamarosan kapsz egy új jelszót.'
          : 'If this email is registered, you will receive a new password shortly.'
        );
        setIsLoading(false);
        return;
      }

      // Request password reset via API
      const response = await fetch('/api/test-portal/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        setSuccess(lang === 'hu'
          ? 'Jelszó visszaállítási kérelem elküldve! Az admin hamarosan elküldi az új jelszavadat.'
          : 'Password reset request sent! The admin will send your new password shortly.'
        );
      } else {
        setSuccess(lang === 'hu'
          ? 'Ha ez az email regisztrálva van, hamarosan kapsz egy új jelszót.'
          : 'If this email is registered, you will receive a new password shortly.'
        );
      }
    } catch {
      setSuccess(lang === 'hu'
        ? 'Ha ez az email regisztrálva van, hamarosan kapsz egy új jelszót.'
        : 'If this email is registered, you will receive a new password shortly.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 flex items-center justify-center p-4">
      {/* Language Switcher */}
      <div className="absolute top-4 right-4 flex gap-2">
        <button
          onClick={() => setLang('hu')}
          className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
            lang === 'hu'
              ? 'bg-white text-primary-700'
              : 'bg-white/20 text-white hover:bg-white/30'
          }`}
        >
          Magyar
        </button>
        <button
          onClick={() => setLang('en')}
          className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
            lang === 'en'
              ? 'bg-white text-primary-700'
              : 'bg-white/20 text-white hover:bg-white/30'
          }`}
        >
          English
        </button>
      </div>

      <div className="w-full max-w-md">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-white rounded-2xl shadow-xl mx-auto mb-4 flex items-center justify-center">
            <svg
              className="w-12 h-12 text-primary-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            {t('login.title', lang)}
          </h1>
          <p className="text-primary-200">
            {t('login.subtitle', lang)}
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Welcome Message */}
          <div className="bg-primary-50 rounded-xl p-4 mb-6">
            <p className="text-primary-700 text-sm text-center">
              {t('login.welcomeMessage', lang)}
            </p>
          </div>

          {showForgotPassword ? (
            /* Forgot Password Form */
            <form onSubmit={handleForgotPassword} className="space-y-5">
              <h3 className="text-lg font-semibold text-gray-800 text-center mb-4">
                {lang === 'hu' ? 'Elfelejtett jelszó' : 'Forgot Password'}
              </h3>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm text-center">
                  {error}
                </div>
              )}

              {success && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-600 text-sm text-center">
                  {success}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('login.email', lang)}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl
                           focus:border-primary-500 focus:ring-4 focus:ring-primary-100
                           transition-all"
                  placeholder="tester@example.com"
                  required
                />
              </div>

              <p className="text-sm text-gray-600 text-center">
                {lang === 'hu'
                  ? 'Add meg az email címedet és az admin elküld egy új jelszót.'
                  : 'Enter your email and the admin will send you a new password.'}
              </p>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 bg-gradient-to-r from-primary-500 to-primary-700
                         text-white font-semibold rounded-xl shadow-lg
                         hover:from-primary-600 hover:to-primary-800
                         active:scale-[0.98] transition-all
                         disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading
                  ? (lang === 'hu' ? 'Küldés...' : 'Sending...')
                  : (lang === 'hu' ? 'Kérelem küldése' : 'Send Request')}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(false);
                  setError('');
                  setSuccess('');
                }}
                className="w-full py-2 text-gray-600 hover:text-gray-800 text-sm"
              >
                ← {lang === 'hu' ? 'Vissza a bejelentkezéshez' : 'Back to login'}
              </button>
            </form>
          ) : (
            /* Login Form */
            <form onSubmit={handleLogin} className="space-y-5">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm text-center">
                  {error}
                </div>
              )}

              {success && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-600 text-sm text-center">
                  {success}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('login.email', lang)}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl
                           focus:border-primary-500 focus:ring-4 focus:ring-primary-100
                           transition-all"
                  placeholder="tester@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('login.password', lang)}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl
                           focus:border-primary-500 focus:ring-4 focus:ring-primary-100
                           transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(true);
                    setError('');
                    setSuccess('');
                  }}
                  className="mt-2 text-sm text-primary-600 hover:text-primary-800"
                >
                  {lang === 'hu' ? 'Elfelejtett jelszó?' : 'Forgot password?'}
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 bg-gradient-to-r from-primary-500 to-primary-700
                         text-white font-semibold rounded-xl shadow-lg
                         hover:from-primary-600 hover:to-primary-800
                         active:scale-[0.98] transition-all
                         disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    {t('common.loading', lang)}
                  </span>
                ) : (
                  t('login.loginButton', lang)
                )}
              </button>
            </form>
          )}

          {/* Admin Link */}
          <div className="mt-6 text-center">
            <a
              href="/test-portal/admin"
              className="text-sm text-gray-500 hover:text-primary-600 transition-colors"
            >
              Admin Panel →
            </a>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-primary-200 text-sm mt-6">
          vSys Wash Platform © 2024
        </p>
      </div>
    </div>
  );
}
