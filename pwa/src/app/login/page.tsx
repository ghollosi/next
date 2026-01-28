'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  unifiedLogin,
  selectRole,
  getRedirectUrl,
  getRoleDisplayName,
  getTempToken,
  getAvailableRoles,
  FoundUser,
} from '@/lib/unified-auth';

// Role icons as SVG components
const RoleIcons: Record<string, React.ReactNode> = {
  platform_admin: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  network_admin: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  operator: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  partner: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  driver: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
    </svg>
  ),
};

function RoleSelectorModal({
  roles,
  onSelect,
  onClose,
  loading,
}: {
  roles: FoundUser[];
  onSelect: (role: FoundUser) => void;
  onClose: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">Válassz fiókot</h2>
          <p className="text-gray-500 text-sm mt-1">
            Több fiókot is találtunk ezzel az email címmel
          </p>
        </div>

        <div className="p-4 max-h-96 overflow-y-auto">
          <div className="space-y-2">
            {roles.map((role, index) => (
              <button
                key={`${role.role}-${role.id}-${index}`}
                onClick={() => onSelect(role)}
                disabled={loading}
                className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-100
                         hover:border-blue-500 hover:bg-blue-50 transition-all
                         disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                  {RoleIcons[role.role] || RoleIcons.driver}
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-gray-900">
                    {getRoleDisplayName(role.role)}
                  </div>
                  <div className="text-sm text-gray-500">
                    {role.name}
                    {role.networkName && (
                      <span className="text-gray-400"> - {role.networkName}</span>
                    )}
                    {role.locationName && (
                      <span className="text-gray-400"> ({role.locationName})</span>
                    )}
                    {role.partnerName && role.role === 'driver' && (
                      <span className="text-gray-400"> - {role.partnerName}</span>
                    )}
                  </div>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-gray-100">
          <button
            onClick={onClose}
            disabled={loading}
            className="w-full py-3 text-gray-600 hover:text-gray-800 font-medium transition-colors"
          >
            Mégsem
          </button>
        </div>
      </div>
    </div>
  );
}

function UnifiedLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showRoleSelector, setShowRoleSelector] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<FoundUser[]>([]);
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);

  // Check for URL params (redirects from old login pages, verification, etc.)
  useEffect(() => {
    const redirect = searchParams.get('redirect');
    const verified = searchParams.get('verified');
    const errorMsg = searchParams.get('error');
    const infoMsg = searchParams.get('message');

    if (verified === 'true') {
      setMessage({
        type: 'success',
        text: infoMsg || 'Email cím sikeresen megerősítve! Most már bejelentkezhetsz.',
      });
    } else if (verified === 'false') {
      setMessage({
        type: 'error',
        text: errorMsg || 'A megerősítő link érvénytelen vagy lejárt.',
      });
    } else if (redirect) {
      setMessage({
        type: 'info',
        text: 'Kérjük, jelentkezz be a folytatáshoz.',
      });
    }

    // Check for pending role selection from previous attempt
    const savedRoles = getAvailableRoles();
    const savedToken = getTempToken();
    if (savedRoles && savedToken) {
      setAvailableRoles(savedRoles);
      setTempToken(savedToken);
      setShowRoleSelector(true);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await unifiedLogin(email, password);

      if (response.multipleRoles && response.availableRoles) {
        // Multiple roles found - show selector
        setAvailableRoles(response.availableRoles);
        setTempToken(response.tempToken || null);
        setShowRoleSelector(true);
      } else if (response.redirectUrl) {
        // Single role - redirect immediately
        router.push(response.redirectUrl);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bejelentkezés sikertelen');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleSelect = async (role: FoundUser) => {
    if (!tempToken) {
      // No temp token - try to login again with this specific role
      setError('A munkamenet lejárt. Kérjük, jelentkezz be újra.');
      setShowRoleSelector(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await selectRole(role.role, role.id, tempToken);
      router.push(response.redirectUrl || getRedirectUrl(role.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Szerepkör kiválasztása sikertelen');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseRoleSelector = () => {
    setShowRoleSelector(false);
    setAvailableRoles([]);
    setTempToken(null);
    // Clear session storage
    sessionStorage.removeItem('unified_temp_token');
    sessionStorage.removeItem('unified_available_roles');
  };

  const isSubmitDisabled = () => {
    if (loading) return true;
    if (!email.includes('@') || email.length < 5) return true;
    if (password.length < 1) return true;
    return false;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo and title */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <svg className="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">VSys Wash</h1>
          <p className="text-blue-200">Bejelentkezés</p>
        </div>

        {/* Login form */}
        <div className="bg-white rounded-2xl p-6 shadow-2xl">
          {/* Messages */}
          {message && (
            <div className={`mb-6 rounded-xl px-4 py-3 ${
              message.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-800'
                : message.type === 'info'
                  ? 'bg-blue-50 border border-blue-200 text-blue-800'
                  : 'bg-red-50 border border-red-200 text-red-800'
            }`}>
              <p className="text-sm font-medium">{message.text}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
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
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-0 focus:outline-none transition-colors"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Jelszó
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-0 focus:outline-none transition-colors"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitDisabled()}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-xl font-semibold
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

          {/* Help links */}
          <div className="mt-6 pt-6 border-t border-gray-100 text-center space-y-3">
            <Link href="/forgot-password" className="text-sm text-blue-600 hover:text-blue-800 block">
              Elfelejtetted a jelszavad?
            </Link>
            <div className="text-sm text-gray-500">
              Nincs még fiókod?{' '}
              <Link href="/register" className="text-blue-600 hover:text-blue-800 font-medium">
                Regisztráció
              </Link>
            </div>
          </div>
        </div>

        {/* Portal links */}
        <div className="mt-6 text-center">
          <p className="text-blue-200 text-sm mb-3">Portálok:</p>
          <div className="flex flex-wrap justify-center gap-3 text-sm">
            <Link href="/network-admin/register" className="text-white/80 hover:text-white underline">
              Network regisztráció
            </Link>
            <span className="text-white/50">•</span>
            <Link href="https://www.vemiax.com" className="text-white/80 hover:text-white underline">
              Főoldal
            </Link>
          </div>
        </div>

        <p className="text-center text-blue-300/60 text-xs mt-6">
          VSys Wash - Unified Login
        </p>
      </div>

      {/* Role Selector Modal */}
      {showRoleSelector && availableRoles.length > 0 && (
        <RoleSelectorModal
          roles={availableRoles}
          onSelect={handleRoleSelect}
          onClose={handleCloseRoleSelector}
          loading={loading}
        />
      )}
    </div>
  );
}

export default function UnifiedLoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex items-center justify-center">
        <div className="text-white">Betöltés...</div>
      </div>
    }>
      <UnifiedLoginContent />
    </Suspense>
  );
}
