'use client';

import { useEffect, useCallback, useRef, useState } from 'react';

// SECURITY: Session timeout configuration
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes of inactivity
const WARNING_BEFORE_MS = 5 * 60 * 1000; // Show warning 5 minutes before timeout

interface UseSessionTimeoutOptions {
  onTimeout: () => void;
  onWarning?: () => void;
  timeoutMs?: number;
  warningBeforeMs?: number;
  enabled?: boolean;
}

interface UseSessionTimeoutReturn {
  resetTimer: () => void;
  timeRemaining: number | null;
  showWarning: boolean;
  dismissWarning: () => void;
}

/**
 * SECURITY: Session timeout hook for automatic logout after inactivity
 *
 * Monitors user activity (mouse, keyboard, touch, scroll) and triggers
 * automatic logout after the configured timeout period.
 *
 * Shows a warning before logout so users can extend their session.
 */
export function useSessionTimeout({
  onTimeout,
  onWarning,
  timeoutMs = SESSION_TIMEOUT_MS,
  warningBeforeMs = WARNING_BEFORE_MS,
  enabled = true,
}: UseSessionTimeoutOptions): UseSessionTimeoutReturn {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  // Clear all timers
  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (warningRef.current) {
      clearTimeout(warningRef.current);
      warningRef.current = null;
    }
  }, []);

  // Reset the inactivity timer
  const resetTimer = useCallback(() => {
    if (!enabled) return;

    lastActivityRef.current = Date.now();
    setShowWarning(false);
    setTimeRemaining(null);
    clearTimers();

    // Set warning timer
    warningRef.current = setTimeout(() => {
      setShowWarning(true);
      onWarning?.();

      // Start countdown
      const countdownInterval = setInterval(() => {
        const remaining = Math.max(0, (lastActivityRef.current + timeoutMs) - Date.now());
        setTimeRemaining(remaining);

        if (remaining <= 0) {
          clearInterval(countdownInterval);
        }
      }, 1000);

      // Store interval for cleanup
      (warningRef.current as any)._countdownInterval = countdownInterval;
    }, timeoutMs - warningBeforeMs);

    // Set timeout timer
    timeoutRef.current = setTimeout(() => {
      setShowWarning(false);
      onTimeout();
    }, timeoutMs);
  }, [enabled, timeoutMs, warningBeforeMs, onTimeout, onWarning, clearTimers]);

  // Dismiss warning and extend session
  const dismissWarning = useCallback(() => {
    setShowWarning(false);
    resetTimer();
  }, [resetTimer]);

  // Set up activity listeners
  useEffect(() => {
    if (!enabled) return;

    const activityEvents = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
      'click',
    ];

    // Throttle activity detection to avoid excessive timer resets
    let lastReset = 0;
    const throttleMs = 1000; // Only reset once per second max

    const handleActivity = () => {
      const now = Date.now();
      if (now - lastReset > throttleMs) {
        lastReset = now;
        // Only reset if not showing warning (user must click to dismiss)
        if (!showWarning) {
          resetTimer();
        }
      }
    };

    // Add listeners
    activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Initial timer start
    resetTimer();

    // Cleanup
    return () => {
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      clearTimers();

      // Clear countdown interval if exists
      if ((warningRef.current as any)?._countdownInterval) {
        clearInterval((warningRef.current as any)._countdownInterval);
      }
    };
  }, [enabled, resetTimer, clearTimers, showWarning]);

  return {
    resetTimer,
    timeRemaining,
    showWarning,
    dismissWarning,
  };
}

// Export default timeout values for configuration
export const SESSION_DEFAULTS = {
  TIMEOUT_MS: SESSION_TIMEOUT_MS,
  WARNING_BEFORE_MS: WARNING_BEFORE_MS,
};
