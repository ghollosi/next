'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { getPlatformToken, getPlatformAdmin, clearPlatformSession } from '@/lib/platform-api';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { SessionTimeoutWarning } from '@/components/SessionTimeoutWarning';

export default function PlatformAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [admin, setAdmin] = useState<{ name: string; email: string; role: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    clearPlatformSession();
    router.push('/platform-admin');
  };

  // SECURITY: Session timeout for automatic logout after inactivity
  // Must be called unconditionally (React hooks rule)
  const isLoggedIn = pathname !== '/platform-admin' && !!admin;
  const { showWarning, timeRemaining, dismissWarning } = useSessionTimeout({
    onTimeout: handleLogout,
    enabled: isLoggedIn,
  });

  useEffect(() => {
    // Skip auth check on login page
    if (pathname === '/platform-admin') {
      return;
    }

    const token = getPlatformToken();
    const adminData = getPlatformAdmin();

    if (!token || !adminData) {
      router.push('/platform-admin');
      return;
    }

    setAdmin(adminData);
  }, [pathname, router]);

  // Don't show layout on login page
  if (pathname === '/platform-admin') {
    return children;
  }

  const navigation = [
    { name: 'Dashboard', href: '/platform-admin/dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', ownerOnly: false },
    { name: 'Hálózatok', href: '/platform-admin/networks', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', ownerOnly: false },
    { name: 'Számlázás', href: '/platform-admin/billing', icon: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z', ownerOnly: true },
    { name: 'Audit napló', href: '/platform-admin/audit-logs', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', ownerOnly: false },
    { name: 'Adminok', href: '/platform-admin/admins', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z', ownerOnly: true },
    { name: 'Beállítások', href: '/platform-admin/settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z', ownerOnly: true },
    { name: 'Dokumentáció', href: '/docs/platform-admin', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253', ownerOnly: false },
  ];

  return (
    <div className="min-h-screen bg-gray-900">
      {/* SECURITY: Session timeout warning */}
      <SessionTimeoutWarning
        show={showWarning}
        timeRemaining={timeRemaining}
        onExtend={dismissWarning}
        onLogout={handleLogout}
      />

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 z-50 h-full w-64 bg-gray-800 transform transition-transform duration-200 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-700">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">VSys Platform</h1>
              <p className="text-xs text-gray-400">Admin Panel</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-1">
            {navigation
              .filter(item => !item.ownerOnly || admin?.role === 'PLATFORM_OWNER')
              .map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                  </svg>
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* User info */}
          {admin && (
            <div className="px-4 py-4 border-t border-gray-700">
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                  {admin.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{admin.name}</p>
                  <p className="text-xs text-gray-400 truncate">{admin.role === 'PLATFORM_OWNER' ? 'Owner' : 'Admin'}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full mt-2 flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Kijelentkezés
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar for mobile */}
        <header className="lg:hidden bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-white">VSys Platform</h1>
          <div className="w-6" />
        </header>

        {/* Page content */}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
