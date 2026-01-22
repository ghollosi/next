'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, getDriver, DriverInfo } from '@/lib/session';
import { api } from '@/lib/api';
import DriverEmiWrapper from '@/components/DriverEmiWrapper';
import dynamic from 'next/dynamic';

// Dynamically import QRScanner to avoid SSR issues with html5-qrcode
const QRScanner = dynamic(() => import('@/components/QRScanner'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <svg className="animate-spin w-8 h-8 text-primary-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <p className="text-white text-sm">Szkenner betoltese...</p>
      </div>
    </div>
  ),
});

export default function ScanQRPage() {
  const router = useRouter();
  const [driver, setDriver] = useState<DriverInfo | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scannedRawValue, setScannedRawValue] = useState<string | null>(null);

  useEffect(() => {
    const session = getSession();
    const driverInfo = getDriver();

    if (!session || !driverInfo) {
      router.replace('/login');
      return;
    }

    setSessionId(session);
    setDriver(driverInfo);
  }, [router]);

  const handleScanResult = useCallback(async (scannedCode: string) => {
    if (isProcessing || !sessionId) return;

    setIsProcessing(true);
    setError('');
    setScannedRawValue(scannedCode); // Store raw value for debugging

    try {
      // Extract location code from QR data
      let locationCode = scannedCode.trim();

      // Check if it's a URL with location parameter (e.g., https://app.vemiax.com/wash/new?location=A2)
      if (scannedCode.includes('location=')) {
        const match = scannedCode.match(/location=([^&\s#]+)/i);
        if (match) {
          locationCode = match[1].trim();
        }
      }
      // If it's a URL without location param, try to extract the last path segment
      else if (scannedCode.includes('/')) {
        const parts = scannedCode.split('/');
        locationCode = parts[parts.length - 1].trim();

        // Remove any query parameters if present
        if (locationCode.includes('?')) {
          locationCode = locationCode.split('?')[0];
        }
      }

      // Remove any hash if present
      if (locationCode.includes('#')) {
        locationCode = locationCode.split('#')[0];
      }

      // Convert to uppercase for matching
      locationCode = locationCode.toUpperCase();

      // Validate location exists
      const location = await api.getLocationByCode(sessionId, locationCode);

      // Navigate to new wash with pre-selected location
      router.push(`/wash/new?location=${location.code}`);
    } catch (err: any) {
      setError(`Helyszin nem talalhato: "${scannedCode}"`);
      setIsProcessing(false);

      // Reset after a longer delay so user can see the error
      setTimeout(() => {
        setIsProcessing(false);
        setScannedRawValue(null);
      }, 5000);
    }
  }, [sessionId, router, isProcessing]);

  const handleCameraError = useCallback((errorMsg: string) => {
    setCameraError(errorMsg);
    // Automatically show manual input when camera fails
    setShowManualInput(true);
  }, []);

  const handleBack = () => {
    router.back();
  };

  const handleManualSubmit = async () => {
    if (!sessionId || !manualCode.trim()) return;

    setIsLoading(true);
    setError('');

    try {
      // Try to find location by code
      const location = await api.getLocationByCode(sessionId, manualCode.toUpperCase().trim());

      // Navigate to new wash with pre-selected location
      router.push(`/wash/new?location=${location.code}`);
    } catch (err: any) {
      setError(err.message || 'Helyszin nem talalhato');
      setIsLoading(false);
    }
  };

  if (!driver) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Betoltes...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-gray-900/80 backdrop-blur text-white px-4 py-4 safe-area-top absolute top-0 left-0 right-0 z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-lg font-semibold">QR kod szkenneles</h1>
            <p className="text-gray-400 text-sm">Iranyitsd a kamerát a QR kodra</p>
          </div>
        </div>
      </header>

      {/* Camera View / Manual Input */}
      <div className="flex-1 flex items-center justify-center pt-20 pb-32 px-4">
        {!showManualInput ? (
          <div className="w-full max-w-sm">
            {/* QR Scanner */}
            <QRScanner
              onScan={handleScanResult}
              onCameraError={handleCameraError}
            />

            {/* Status messages */}
            {isProcessing && (
              <div className="mt-4 text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600/20 rounded-full">
                  <svg className="animate-spin w-4 h-4 text-primary-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="text-primary-400 text-sm">Helyszin keresese...</span>
                </div>
              </div>
            )}

            {error && !isProcessing && (
              <div className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 text-sm text-center">
                {error}
                {scannedRawValue && (
                  <div className="mt-2 text-xs text-gray-400 break-all">
                    Beolvasott ertek: <code className="bg-gray-800 px-1 rounded">{scannedRawValue}</code>
                  </div>
                )}
              </div>
            )}

            {/* Instructions */}
            <p className="text-gray-400 text-sm text-center mt-6">
              Helyezd a QR kodot a keret kozepe
            </p>
          </div>
        ) : (
          /* Manual Input Form */
          <div className="w-full max-w-sm">
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-xl font-semibold text-gray-800 text-center mb-2">
                Helyszin kod megadasa
              </h2>

              {cameraError && (
                <p className="text-orange-600 text-sm text-center mb-4">
                  {cameraError}
                </p>
              )}

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm text-center">
                  {error}
                </div>
              )}

              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                placeholder="WASH001"
                className="w-full px-4 py-4 text-2xl text-center font-mono tracking-wider
                           border-2 border-gray-200 rounded-xl
                           focus:border-primary-500 focus:ring-4 focus:ring-primary-100
                           transition-all uppercase"
                autoCapitalize="characters"
                autoComplete="off"
                autoFocus
              />

              <div className="mt-6 space-y-3">
                <button
                  onClick={handleManualSubmit}
                  disabled={isLoading || !manualCode.trim()}
                  className="w-full py-4 bg-gradient-to-r from-primary-500 to-primary-700
                             text-white font-semibold rounded-xl shadow-lg
                             hover:from-primary-600 hover:to-primary-800
                             active:scale-[0.98] transition-all
                             disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Kereses...
                    </span>
                  ) : (
                    'Helyszin keresese'
                  )}
                </button>

                {!cameraError && (
                  <button
                    onClick={() => setShowManualInput(false)}
                    className="w-full py-3 text-gray-600 font-medium
                               hover:text-gray-800 transition-colors"
                  >
                    Vissza a szkennerhez
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Button - Manual Entry Toggle */}
      {!showManualInput && (
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-8 safe-area-bottom">
          <button
            onClick={() => setShowManualInput(true)}
            className="w-full py-4 bg-white/10 backdrop-blur text-white font-semibold rounded-xl
                       hover:bg-white/20 active:scale-[0.98] transition-all"
          >
            Kod kezi megadasa
          </button>
        </div>
      )}

      {/* Émi Chat Widget */}
      <DriverEmiWrapper />
    </div>
  );
}
