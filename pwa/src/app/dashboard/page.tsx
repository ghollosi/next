'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, getDriver, clearSession, DriverInfo } from '@/lib/session';

export default function DashboardPage() {
  const router = useRouter();
  const [driver, setDriver] = useState<DriverInfo | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    const session = getSession();
    const driverInfo = getDriver();

    if (!session || !driverInfo) {
      router.replace('/login');
      return;
    }

    setSessionId(session);
    setDriver(driverInfo);
  }, [router]);

  const handleLogout = () => {
    clearSession();
    router.replace('/login');
  };

  const handleStartWash = () => {
    router.push('/wash/new');
  };

  if (!driver) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-primary-600 text-white px-4 py-4 safe-area-top">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">VSys Wash</h1>
            <p className="text-primary-200 text-sm">
              {driver.isPrivateCustomer ? 'Privat ugyfel' : driver.partnerCompanyName}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 hover:bg-primary-700 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </header>

      {/* Welcome Card */}
      <div className="px-4 py-6">
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
              <span className="text-2xl font-bold text-primary-600">
                {driver.firstName[0]}{driver.lastName[0]}
              </span>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-800">
                Hello, {driver.firstName}!
              </h2>
              <p className="text-gray-500">Ready to start a wash?</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Action */}
      <div className="flex-1 px-4 flex flex-col">
        <button
          onClick={handleStartWash}
          className="flex-1 max-h-64 bg-gradient-to-br from-primary-500 to-primary-700
                     rounded-2xl shadow-lg flex flex-col items-center justify-center gap-4
                     hover:from-primary-600 hover:to-primary-800 active:scale-[0.98] transition-all"
        >
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <span className="text-2xl font-bold text-white">Start New Wash</span>
          <span className="text-primary-200">Tap to begin</span>
        </button>

        {/* Quick Actions */}
        <div className="grid grid-cols-4 gap-3 mt-6 mb-6">
          <button
            onClick={() => router.push('/wash/scan')}
            className="bg-white rounded-xl shadow-sm p-4 flex flex-col items-center gap-2
                       hover:bg-gray-50 active:bg-gray-100 transition-colors"
          >
            <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-gray-700">QR Scan</span>
          </button>

          <button
            onClick={() => router.push('/booking')}
            className="bg-white rounded-xl shadow-sm p-4 flex flex-col items-center gap-2
                       hover:bg-gray-50 active:bg-gray-100 transition-colors"
          >
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-gray-700">Foglalás</span>
          </button>

          <button
            onClick={() => router.push('/vehicles')}
            className="bg-white rounded-xl shadow-sm p-4 flex flex-col items-center gap-2
                       hover:bg-gray-50 active:bg-gray-100 transition-colors"
          >
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
            <span className="text-sm font-medium text-gray-700">Jármuvek</span>
          </button>

          <button
            onClick={() => router.push('/wash/history')}
            className="bg-white rounded-xl shadow-sm p-4 flex flex-col items-center gap-2
                       hover:bg-gray-50 active:bg-gray-100 transition-colors"
          >
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-gray-700">Elozmények</span>
          </button>
        </div>

        {/* Help Button */}
        <button
          onClick={() => router.push('/docs/driver')}
          className="w-full bg-white rounded-xl shadow-sm p-4 flex items-center gap-4
                     hover:bg-gray-50 active:bg-gray-100 transition-colors mb-3"
        >
          <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div className="flex-1 text-left">
            <span className="font-medium text-gray-900">Sugo</span>
            <p className="text-sm text-gray-500">Hasznalati utmutato</p>
          </div>
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Settings Button */}
        <button
          onClick={() => router.push('/settings')}
          className="w-full bg-white rounded-xl shadow-sm p-4 flex items-center gap-4
                     hover:bg-gray-50 active:bg-gray-100 transition-colors mb-6"
        >
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div className="flex-1 text-left">
            <span className="font-medium text-gray-900">Beallitasok</span>
            <p className="text-sm text-gray-500">Profil, szamlazasi adatok</p>
          </div>
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Bottom Safe Area */}
      <div className="safe-area-bottom" />
    </div>
  );
}
