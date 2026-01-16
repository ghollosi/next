'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface PlatformViewContextType {
  isPlatformView: boolean;
  viewingNetworkId: string | null;
  viewingNetworkName: string | null;
  enterPlatformView: (networkId: string, networkName: string) => void;
  exitPlatformView: () => void;
}

const PlatformViewContext = createContext<PlatformViewContextType | undefined>(undefined);

const STORAGE_KEY = 'vsys_platform_view';

export function PlatformViewProvider({ children }: { children: ReactNode }) {
  const [isPlatformView, setIsPlatformView] = useState(false);
  const [viewingNetworkId, setViewingNetworkId] = useState<string | null>(null);
  const [viewingNetworkName, setViewingNetworkName] = useState<string | null>(null);

  // Load from sessionStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const data = JSON.parse(stored);
          setIsPlatformView(true);
          setViewingNetworkId(data.networkId);
          setViewingNetworkName(data.networkName);
        } catch {
          sessionStorage.removeItem(STORAGE_KEY);
        }
      }
    }
  }, []);

  const enterPlatformView = (networkId: string, networkName: string) => {
    setIsPlatformView(true);
    setViewingNetworkId(networkId);
    setViewingNetworkName(networkName);

    if (typeof window !== 'undefined') {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ networkId, networkName }));
    }
  };

  const exitPlatformView = () => {
    setIsPlatformView(false);
    setViewingNetworkId(null);
    setViewingNetworkName(null);

    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  };

  return (
    <PlatformViewContext.Provider
      value={{
        isPlatformView,
        viewingNetworkId,
        viewingNetworkName,
        enterPlatformView,
        exitPlatformView,
      }}
    >
      {children}
    </PlatformViewContext.Provider>
  );
}

export function usePlatformView() {
  const context = useContext(PlatformViewContext);
  if (context === undefined) {
    throw new Error('usePlatformView must be used within a PlatformViewProvider');
  }
  return context;
}
