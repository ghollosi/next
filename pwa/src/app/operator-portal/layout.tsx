'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import EmiChatWidget from '@/components/EmiChatWidget';

interface OperatorInfo {
  locationId: string;
  locationName: string;
  locationCode: string;
  washMode: string;
  networkName: string;
  networkId?: string;
  operationType?: string;
}

export default function OperatorPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [operatorInfo, setOperatorInfo] = useState<OperatorInfo | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    // Skip auth check on login, forgot-pin, and reset-pin pages
    if (pathname === '/operator-portal/login' ||
        pathname === '/operator-portal' ||
        pathname === '/operator-portal/forgot-pin' ||
        pathname.startsWith('/operator-portal/reset-pin')) {
      return;
    }

    const session = localStorage.getItem('operator_session');
    const info = localStorage.getItem('operator_info');

    if (!session || !info) {
      router.replace('/operator-portal/login');
      return;
    }

    setSessionId(session);
    try {
      setOperatorInfo(JSON.parse(info));
    } catch {
      router.replace('/operator-portal/login');
    }
  }, [pathname, router]);

  // Don't show Émi on login-related pages
  const showEmi = pathname !== '/operator-portal/login' &&
                  pathname !== '/operator-portal' &&
                  pathname !== '/operator-portal/forgot-pin' &&
                  !pathname.startsWith('/operator-portal/reset-pin') &&
                  operatorInfo;

  return (
    <>
      {children}

      {/* Émi Chat Widget - Operator context */}
      {showEmi && operatorInfo && (
        <EmiChatWidget
          userRole="operator"
          userId={operatorInfo.locationId}
          locationId={operatorInfo.locationId}
          networkId={operatorInfo.networkId}
          token={sessionId || undefined}
          language="hu"
          position="bottom-right"
          primaryColor="#16a34a" // Green - Operator color
        />
      )}
    </>
  );
}
