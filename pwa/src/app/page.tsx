'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { isLoggedIn, savePendingLocation, getPendingLocation } from '@/lib/session';
import Link from 'next/link';
import Image from 'next/image';

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showLanding, setShowLanding] = useState(false);

  useEffect(() => {
    // QR kód flow: ha van location paraméter, mentjük el és továbbítunk
    const locationCode = searchParams.get('location');
    if (locationCode) {
      savePendingLocation(locationCode);
      if (isLoggedIn()) {
        router.replace(`/wash/new?location=${locationCode}`);
        return;
      } else {
        router.replace('/login');
        return;
      }
    }

    // Ha már be van jelentkezve sofőrként, dashboard-ra megyünk
    if (isLoggedIn()) {
      const pendingLocation = getPendingLocation();
      if (pendingLocation) {
        router.replace(`/wash/new?location=${pendingLocation}`);
      } else {
        router.replace('/dashboard');
      }
      return;
    }

    // Különben megjelenítjük a landing page-t
    setShowLanding(true);
  }, [router, searchParams]);

  if (!showLanding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-blue-800">
        <div className="text-white text-xl animate-pulse">Betöltés...</div>
      </div>
    );
  }

  const portals = [
    {
      name: 'Platform Admin',
      description: 'Platform tulajdonos belépés - Hálózatok és adminok kezelése',
      href: '/platform-admin',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      color: 'from-purple-500 to-purple-700',
    },
    {
      name: 'Network Admin',
      description: 'Hálózat adminisztrátor - Helyszínek, árak, sofőrök kezelése',
      href: '/network-admin',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      color: 'from-blue-500 to-blue-700',
    },
    {
      name: 'Mosó Operátor',
      description: 'Helyszíni operátor - Mosások indítása, naptár, foglalások',
      href: '/operator-portal/login',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      ),
      color: 'from-green-500 to-green-700',
    },
    {
      name: 'Partner Portál',
      description: 'Fuvarozó partner - Számlák és költségek nyomon követése',
      href: '/partner/login',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      color: 'from-orange-500 to-orange-700',
    },
    {
      name: 'Sofőr / Ügyfél',
      description: 'Sofőr belépés - Mosás indítás, időpontfoglalás, előzmények',
      href: '/login',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
      color: 'from-cyan-500 to-cyan-700',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
      {/* Header */}
      <header className="pt-12 pb-8 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-white rounded-2xl shadow-2xl mb-6 overflow-hidden">
            <Image
              src="/icon-512.png"
              alt="VEMIAX Logo"
              width={80}
              height={80}
              className="object-contain"
              priority
            />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
            VEMIAX
          </h1>
          <p className="text-lg text-blue-300 mb-4">
            www.vemiax.com
          </p>
          <p className="text-xl text-blue-200 max-w-2xl mx-auto">
            Professzionális járműmosó menedzsment rendszer
          </p>
        </div>
      </header>

      {/* Portal Cards */}
      <main className="px-4 pb-12">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-center text-lg text-blue-300 mb-8">Válassz belépési módot:</h2>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {portals.map((portal) => (
              <Link
                key={portal.name}
                href={portal.href}
                className="group relative overflow-hidden rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 p-6 transition-all duration-300 hover:bg-white/20 hover:scale-105 hover:shadow-2xl"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${portal.color} opacity-0 group-hover:opacity-20 transition-opacity duration-300`} />

                <div className={`inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br ${portal.color} text-white mb-4 shadow-lg`}>
                  {portal.icon}
                </div>

                <h3 className="text-xl font-semibold text-white mb-2">
                  {portal.name}
                </h3>

                <p className="text-sm text-blue-200/80">
                  {portal.description}
                </p>

                <div className="absolute bottom-4 right-4 text-white/50 group-hover:text-white/80 transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-white/10">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-blue-300/60 text-sm">
            © {new Date().getFullYear()} VEMIAX. Minden jog fenntartva.
          </p>
          <p className="text-blue-300/40 text-xs mt-2">
            Verzió: 1.1.0-booking-email
          </p>
        </div>
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-blue-800">
        <div className="text-white text-xl animate-pulse">Betöltés...</div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
