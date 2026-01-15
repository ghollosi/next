'use client';

import { useEffect, useState } from 'react';

interface SessionTimeoutWarningProps {
  show: boolean;
  timeRemaining: number | null;
  onExtend: () => void;
  onLogout: () => void;
}

/**
 * SECURITY: Session timeout warning modal
 *
 * Shows a warning when the session is about to expire,
 * allowing users to extend their session or logout.
 */
export function SessionTimeoutWarning({
  show,
  timeRemaining,
  onExtend,
  onLogout,
}: SessionTimeoutWarningProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !show) return null;

  const minutes = Math.floor((timeRemaining || 0) / 60000);
  const seconds = Math.floor(((timeRemaining || 0) % 60000) / 1000);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
        {/* Warning Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-yellow-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold text-gray-900 text-center mb-2">
          Session lejarat
        </h2>

        {/* Message */}
        <p className="text-gray-600 text-center mb-4">
          Biztonsagi okokbol a munkameneted hamarosan lejar inaktivitas miatt.
        </p>

        {/* Countdown */}
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <div className="text-center">
            <span className="text-3xl font-bold text-red-600 font-mono">
              {minutes}:{seconds.toString().padStart(2, '0')}
            </span>
            <p className="text-sm text-red-600 mt-1">
              mulva automatikusan kijelentkeztetunk
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onLogout}
            className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
          >
            Kijelentkezes
          </button>
          <button
            onClick={onExtend}
            className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
          >
            Maradok bejelentkezve
          </button>
        </div>
      </div>
    </div>
  );
}
