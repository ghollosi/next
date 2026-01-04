'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isLoggedIn } from '@/lib/session';

export default function Home() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (isLoggedIn()) {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
    setChecking(false);
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary-600">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return null;
}
