'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { getNetworkAdminToken, getNetworkAdmin, clearNetworkAdminSession } from '@/lib/network-admin-api';
import TrialBanner from '@/components/TrialBanner';

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

  useEffect(() => {
    // Skip auth check on login and register pages
    if (pathname === '/network-admin' || pathname === '/network-admin/register') {
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
    { href: '/network-admin/wash-events', label: 'Mosások', icon: '🚿' },
    { href: '/network-admin/locations', label: 'Helyszínek', icon: '📍' },
    { href: '/network-admin/drivers', label: 'Sofőrök', icon: '👤' },
    { href: '/network-admin/partners', label: 'Partner cégek', icon: '🏢' },
    { href: '/network-admin/delete-requests', label: 'Törlési kérelmek', icon: '🗑️' },
    { href: '/network-admin/prices', label: 'Árlista', icon: '💰' },
    { href: '/network-admin/audit-logs', label: 'Audit napló', icon: '📋' },
    { href: '/network-admin/subscription', label: 'Előfizetés', icon: '💳' },
    { href: '/network-admin/settings', label: 'Beállítások', icon: '⚙️' },
  ];

  const handleLogout = () => {
    clearNetworkAdminSession();
    router.push('/network-admin');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Trial Banner */}
      <TrialBanner />

      {/* Top Navigation - Header Bar */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex-shrink-0 flex items-center">
              <span className="text-xl font-bold text-primary-600">
                {admin?.networkName || 'Network'} Admin
              </span>
            </div>
            <div className="flex items-center gap-4">
              {admin && (
                <span className="text-sm text-gray-500 hidden md:block">
                  {admin.name}
                </span>
              )}
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                Kijelentkezés
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Navigation Menu - Second Row */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1 py-2 overflow-x-auto">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex-shrink-0 inline-flex items-center px-3 py-2 text-sm font-medium rounded-md whitespace-nowrap
                    ${isActive
                      ? 'bg-primary-100 text-primary-700'
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
    </div>
  );
}
