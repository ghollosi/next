'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface TrialStatus {
  subscriptionStatus: string;
  trialEndsAt?: string;
  daysRemaining?: number;
  minutesRemaining?: number;
  isExpired: boolean;
  isGracePeriod: boolean;
  gracePeriodEndsAt?: string;
  isFullyLocked: boolean;
}

interface SubscriptionContextType {
  trialStatus: TrialStatus | null;
  setTrialStatus: (status: TrialStatus) => void;
  // Helper: true if any write operation should be blocked
  isReadOnly: boolean;
  // Helper: true if user can't access anything (fully locked)
  isFullyBlocked: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [trialStatus, setTrialStatusState] = useState<TrialStatus | null>(null);

  const setTrialStatus = useCallback((status: TrialStatus) => {
    setTrialStatusState(status);
  }, []);

  // Read-only mode: expired trial OR grace period OR fully locked
  const isReadOnly = trialStatus ? (
    trialStatus.isExpired ||
    trialStatus.isGracePeriod ||
    trialStatus.isFullyLocked
  ) : false;

  // Fully blocked: only when fully locked (after grace period)
  const isFullyBlocked = trialStatus?.isFullyLocked ?? false;

  return (
    <SubscriptionContext.Provider value={{
      trialStatus,
      setTrialStatus,
      isReadOnly,
      isFullyBlocked,
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}

// Hook that returns true if we should hide create/edit buttons
export function useIsReadOnly() {
  const { isReadOnly } = useSubscription();
  return isReadOnly;
}
