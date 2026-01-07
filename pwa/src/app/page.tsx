'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { isLoggedIn, savePendingLocation, getPendingLocation } from '@/lib/session';

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // QR kód flow: ha van location paraméter, mentjük el
    const locationCode = searchParams.get('location');
    if (locationCode) {
      savePendingLocation(locationCode);
    }

    if (isLoggedIn()) {
      // Ha be van jelentkezve és van pending location, egyből a mosásra visszük
      const pendingLocation = locationCode || getPendingLocation();
      if (pendingLocation) {
        router.replace(`/wash/new?location=${pendingLocation}`);
      } else {
        router.replace('/dashboard');
      }
    } else {
      router.replace('/login');
    }
    setChecking(false);
  }, [router, searchParams]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary-600">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return null;
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-primary-600">
        <div className="text-white text-xl">Loading...</div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
