'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PartnerIndexPage() {
  const router = useRouter();

  useEffect(() => {
    // Check if user has an active session
    const session = localStorage.getItem('partner_session');
    const partnerInfo = localStorage.getItem('partner_info');

    if (session && partnerInfo) {
      // If logged in, redirect to dashboard
      router.replace('/partner/dashboard');
    } else {
      // If not logged in, redirect to login
      router.replace('/partner/login');
    }
  }, [router]);

  // Show loading state while checking session
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-600 to-blue-800 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-white text-lg">Betöltés...</p>
      </div>
    </div>
  );
}
