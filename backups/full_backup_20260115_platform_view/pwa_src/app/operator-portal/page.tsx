'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OperatorPortalRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/operator-portal/login');
  }, [router]);

  return (
    <div className="min-h-screen bg-green-600 flex items-center justify-center">
      <div className="text-white text-lg">Átirányítás...</div>
    </div>
  );
}
