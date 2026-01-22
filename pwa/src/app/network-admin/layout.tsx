'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { getNetworkAdminToken, getNetworkAdmin, clearNetworkAdminSession } from '@/lib/network-admin-api';
import TrialBanner from '@/components/TrialBanner';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { SessionTimeoutWarning } from '@/components/SessionTimeoutWarning';
import EmiChatWidget from '@/components/EmiChatWidget';

// Platform View storage key
const PLATFORM_VIEW_KEY = 'vsys_platform_view';

function getPlatformViewData(): { networkId: string; networkName: string } | null {
  if (typeof window === 'undefined') return null;
  const stored = sessionStorage.getItem(PLATFORM_VIEW_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export default function NetworkAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(true);
  const [admin, setAdmin] = useState<{
    name: string;
    email: string;
    role: string;
    networkName: string;
  } | null>(null);
  const [isPlatformView, setIsPlatformView] = useState(false);
  const [platformViewNetwork, setPlatformViewNetwork] = useState<string | null>(null);

  const handleLogout = () => {
    clearNetworkAdminSession();
    router.push('/network-admin');
  };

  const handleExitPlatformView = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(PLATFORM_VIEW_KEY);
    }
    router.push('/platform-admin/networks');
  };

  // SECURITY: Session timeout for automatic logout after inactivity
  // Must be called unconditionally (React hooks rule)
  const isLoggedIn = !isLoading && !!admin;
  const { showWarning, timeRemaining, dismissWarning } = useSessionTimeout({
    onTimeout: handleLogout,
    enabled: isLoggedIn,
  });

  useEffect(() => {
    // Skip auth check on login and register pages
    if (pathname === '/network-admin' || pathname === '/network-admin/register') {
      setIsLoading(false);
      return;
    }

    // Check for Platform View mode first
    const platformViewData = getPlatformViewData();
    if (platformViewData) {
      // Also verify that we have a valid Platform Admin token
      const platformToken = localStorage.getItem('vsys_platform_token');
      if (!platformToken) {
        // No Platform Admin token - clear Platform View data and redirect
        sessionStorage.removeItem('vsys_platform_view');
        router.push('/platform-admin');
        return;
      }
      setIsPlatformView(true);
      setPlatformViewNetwork(platformViewData.networkName);
      setAdmin({
        name: 'Platform Admin',
        email: '',
        role: 'platform_view',
        networkName: platformViewData.networkName,
      });
      setIsLoading(false);
      return;
    }

    const token = getNetworkAdminToken();
    const adminData = getNetworkAdmin();

    if (!token || !adminData) {
      router.push('/network-admin');
      return;
    }

    setAdmin(adminData);
    setIsLoading(false);
  }, [pathname, router]);

  // Don't show layout on login and register pages
  if (pathname === '/network-admin' || pathname === '/network-admin/register') {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-gray-500">Betöltés...</div>
      </div>
    );
  }

  const navItems = [
    { href: '/network-admin/dashboard', label: 'Dashboard', icon: '📊' },
    { href: '/network-admin/bookings', label: 'Foglalások', icon: '📅' },
    { href: '/network-admin/wash-events', label: 'Mosások', icon: '🚿' },
    { href: '/network-admin/locations', label: 'Helyszínek', icon: '📍' },
    { href: '/network-admin/drivers', label: 'Sofőrök', icon: '👤' },
    { href: '/network-admin/partners', label: 'Partner cégek', icon: '🏢' },
    { href: '/network-admin/invoices', label: 'Számlák', icon: '🧾' },
    { href: '/network-admin/reports', label: 'Riportok', icon: '📈' },
    { href: '/network-admin/delete-requests', label: 'Törlési kérelmek', icon: '🗑️' },
    { href: '/network-admin/prices', label: 'Árlista', icon: '💰' },
    { href: '/network-admin/audit-logs', label: 'Audit napló', icon: '📋' },
    { href: '/network-admin/subscription', label: 'Előfizetés', icon: '💳' },
    { href: '/network-admin/settings', label: 'Beállítások', icon: '⚙️' },
    { href: '/docs/network-admin?from=network', label: 'Dokumentáció', icon: '📚' },
  ];

  // Filter nav items for Platform View - hide sensitive items
  const filteredNavItems = isPlatformView
    ? navItems.filter(item => !['Beállítások', 'Előfizetés'].includes(item.label))
    : navItems;

  return (
    <div className={`min-h-screen ${isPlatformView ? 'bg-indigo-50' : 'bg-gray-100'}`}>
      {/* Platform View Banner */}
      {isPlatformView && (
        <div className="bg-indigo-600 text-white py-2 px-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <span className="font-medium">Platform Admin megtekintes mod</span>
              <span className="text-indigo-200">|</span>
              <span className="text-indigo-100">{platformViewNetwork}</span>
              <span className="ml-2 px-2 py-0.5 bg-indigo-500 rounded text-xs">Csak olvasas</span>
            </div>
            <button
              onClick={handleExitPlatformView}
              className="flex items-center gap-2 px-3 py-1 bg-indigo-500 hover:bg-indigo-400 rounded-lg text-sm transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Kilepes
            </button>
          </div>
        </div>
      )}

      {/* SECURITY: Session timeout warning - only for real admins */}
      {!isPlatformView && (
        <SessionTimeoutWarning
          show={showWarning}
          timeRemaining={timeRemaining}
          onExtend={dismissWarning}
          onLogout={handleLogout}
        />
      )}

      {/* Trial Banner - only for real admins */}
      {!isPlatformView && <TrialBanner />}

      {/* Top Navigation - Header Bar */}
      <nav className={`shadow-sm border-b ${isPlatformView ? 'bg-indigo-100 border-indigo-200' : 'bg-white border-gray-200'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex-shrink-0 flex items-center">
              <span className={`text-xl font-bold ${isPlatformView ? 'text-indigo-700' : 'text-primary-600'}`}>
                {admin?.networkName || 'Network'} Admin
              </span>
            </div>
            <div className="flex items-center gap-4">
              {admin && !isPlatformView && (
                <span className="text-sm text-gray-500 hidden md:block">
                  {admin.name}
                </span>
              )}
              {!isPlatformView && (
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
                >
                  Kijelentkezés
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Navigation Menu - Second Row */}
      <div className={`border-b ${isPlatformView ? 'bg-indigo-100 border-indigo-200' : 'bg-white border-gray-200'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1 py-2 overflow-x-auto">
            {filteredNavItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex-shrink-0 inline-flex items-center px-3 py-2 text-sm font-medium rounded-md whitespace-nowrap
                    ${isActive
                      ? isPlatformView
                        ? 'bg-indigo-200 text-indigo-800'
                        : 'bg-primary-100 text-primary-700'
                      : isPlatformView
                        ? 'text-indigo-700 hover:text-indigo-900 hover:bg-indigo-50'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                >
                  <span className="mr-2">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {children}
      </main>

      {/* Émi Chat Widget - Network Admin context */}
      {admin && !isPlatformView && (
        <EmiChatWidget
          userRole="network_admin"
          userId={admin.email}
          networkId={getPlatformViewData()?.networkId || undefined}
          token={getNetworkAdminToken() || undefined}
          language="hu"
          position="bottom-right"
          primaryColor="#6366f1" // Indigo - Network Admin color
        />
      )}
    </div>
  );
}
