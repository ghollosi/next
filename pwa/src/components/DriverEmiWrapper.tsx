'use client';

import { useEffect, useState } from 'react';
import { getSession, getDriver, DriverInfo } from '@/lib/session';
import EmiChatWidget from '@/components/EmiChatWidget';

export default function DriverEmiWrapper() {
  const [driver, setDriver] = useState<DriverInfo | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const session = getSession();
    const driverInfo = getDriver();

    if (session && driverInfo) {
      setSessionId(session);
      setDriver(driverInfo);
    }
    setLoaded(true);
  }, []);

  if (!loaded) return null;

  // Authenticated driver
  if (driver && sessionId) {
    return (
      <EmiChatWidget
        userRole="driver"
        userId={driver.driverId}
        networkId={driver.networkId}
        token={sessionId}
        language="hu"
        position="bottom-right"
        primaryColor="#3b82f6"
      />
    );
  }

  // Guest mode (not logged in)
  return (
    <EmiChatWidget
      language="hu"
      position="bottom-right"
      primaryColor="#3b82f6"
    />
  );
}
