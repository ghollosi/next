'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import EmiChatWidget from '@/components/EmiChatWidget';

interface PartnerInfo {
  partnerId: string;
  partnerName: string;
  partnerCode: string;
  networkId?: string;
}

export default function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [partnerInfo, setPartnerInfo] = useState<PartnerInfo | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    // Skip auth check on login, forgot-pin, and reset-pin pages
    if (pathname === '/partner/login' ||
        pathname === '/partner' ||
        pathname === '/partner/forgot-pin' ||
        pathname.startsWith('/partner/reset-pin')) {
      return;
    }

    const session = localStorage.getItem('partner_session');
    const info = localStorage.getItem('partner_info');

    if (!session || !info) {
      router.replace('/partner/login');
      return;
    }

    setSessionId(session);
    try {
      setPartnerInfo(JSON.parse(info));
    } catch {
      router.replace('/partner/login');
    }
  }, [pathname, router]);

  // Don't show Émi on login-related pages
  const showEmi = pathname !== '/partner/login' &&
                  pathname !== '/partner' &&
                  pathname !== '/partner/forgot-pin' &&
                  !pathname.startsWith('/partner/reset-pin') &&
                  partnerInfo;

  return (
    <>
      {children}

      {/* Émi Chat Widget - Partner Admin context */}
      {showEmi && partnerInfo && (
        <EmiChatWidget
          userRole="partner_admin"
          userId={partnerInfo.partnerId}
          partnerId={partnerInfo.partnerId}
          networkId={partnerInfo.networkId}
          token={sessionId || undefined}
          language="hu"
          position="bottom-right"
          primaryColor="#2563eb" // Blue - Partner color
        />
      )}
    </>
  );
}
