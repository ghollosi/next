'use client';

import { useState, useEffect } from 'react';
import { networkAdminApi } from '@/lib/network-admin-api';
import { useSubscription, TrialStatus } from '@/contexts/SubscriptionContext';

interface TrialBannerProps {
  onStatusChange?: (status: TrialStatus) => void;
}

export default function TrialBanner({ onStatusChange }: TrialBannerProps) {
  const [status, setStatus] = useState<TrialStatus | null>(null);
  const [timeDisplay, setTimeDisplay] = useState<string>('');
  const { setTrialStatus: setContextTrialStatus } = useSubscription();

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const data = await networkAdminApi.getTrialStatus();
        setStatus(data);
        // Update context
        setContextTrialStatus(data);
        // Call parent callback
        if (onStatusChange) {
          onStatusChange(data);
        }
      } catch (err) {
        console.error('Failed to fetch trial status:', err);
      }
    };

    fetchStatus();
  }, [onStatusChange, setContextTrialStatus]);

  // Update countdown every minute (or every second on last day)
  useEffect(() => {
    if (!status || status.subscriptionStatus !== 'TRIAL' || !status.trialEndsAt) {
      return;
    }

    const updateDisplay = () => {
      const now = new Date();
      const endDate = new Date(status.trialEndsAt!);
      const diff = endDate.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeDisplay('Lejárt');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (days > 0) {
        setTimeDisplay(`${days} nap`);
      } else if (hours > 0) {
        setTimeDisplay(`${hours} óra ${minutes} perc`);
      } else {
        setTimeDisplay(`${minutes} perc`);
      }
    };

    updateDisplay();

    // On last day, update every minute
    const isLastDay = status.daysRemaining !== undefined && status.daysRemaining <= 1;
    const interval = setInterval(updateDisplay, isLastDay ? 60000 : 60000 * 5);

    return () => clearInterval(interval);
  }, [status]);

  // Don't show banner for active subscriptions
  if (!status || status.subscriptionStatus === 'ACTIVE') {
    return null;
  }

  // Fully locked state (after grace period)
  if (status.isFullyLocked) {
    return (
      <div className="bg-red-600 text-white py-3 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="font-medium">A próbaidőszak lejárt!</span>
          </div>
          <div className="text-sm">
            Kérjük vegye fel a kapcsolatot a platform adminisztrátorral.
          </div>
        </div>
      </div>
    );
  }

  // Grace period state (5 days after trial expiry - read only)
  if (status.isGracePeriod) {
    return (
      <div className="bg-orange-600 text-white py-3 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium">A próbaidőszak lejárt - csak megtekintés mód</span>
          </div>
          <div className="text-sm">
            Még {status.daysRemaining} napig megtekintheti az adatokat. Fizessen elő a folytatáshoz!
          </div>
        </div>
      </div>
    );
  }

  // Trial is about to expire (3 days or less)
  if (status.daysRemaining !== undefined && status.daysRemaining <= 3) {
    return (
      <div className="bg-red-600 text-white py-3 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium">A próbaidőszak hamarosan lejár!</span>
          </div>
          <div className="text-sm flex items-center gap-4">
            <span className="font-mono bg-red-700 px-2 py-1 rounded">
              {timeDisplay}
            </span>
            <a
              href="/network-admin/settings?tab=subscription"
              className="bg-white text-red-600 px-3 py-1 rounded font-medium hover:bg-red-50 transition-colors"
            >
              Előfizetés
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Normal trial state (more than 3 days remaining)
  if (status.subscriptionStatus === 'TRIAL') {
    return (
      <div className="bg-blue-600 text-white py-2 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Próbaidőszak - {status.daysRemaining} nap van hátra</span>
          </div>
          <a
            href="/network-admin/settings?tab=subscription"
            className="text-sm bg-white/20 hover:bg-white/30 px-3 py-1 rounded transition-colors"
          >
            Előfizetés
          </a>
        </div>
      </div>
    );
  }

  return null;
}
