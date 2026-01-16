'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, getDriver, DriverInfo } from '@/lib/session';
import { api, Location } from '@/lib/api';

export default function ScanQRPage() {
  const router = useRouter();
  const [driver, setDriver] = useState<DriverInfo | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasCamera, setHasCamera] = useState(false);
  const [cameraError, setCameraError] = useState('');

  useEffect(() => {
    const session = getSession();
    const driverInfo = getDriver();

    if (!session || !driverInfo) {
      router.replace('/login');
      return;
    }

    setSessionId(session);
    setDriver(driverInfo);
    checkCamera();
  }, [router]);

  const checkCamera = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(device => device.kind === 'videoinput');
      if (cameras.length > 0) {
        setHasCamera(true);
        // Note: Actual QR scanning would require a library like @zxing/library or html5-qrcode
        // For now, we'll show a placeholder and use manual input
      }
    } catch (err) {
      setCameraError('Camera access not available');
      setShowManualInput(true);
    }
  };

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
      setError(err.message || 'Location not found');
      setIsLoading(false);
    }
  };

  if (!driver) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Loading...</div>
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
            <h1 className="text-lg font-semibold">Scan QR Code</h1>
            <p className="text-gray-400 text-sm">Point at location QR code</p>
          </div>
        </div>
      </header>

      {/* Camera View / Placeholder */}
      <div className="flex-1 flex items-center justify-center relative">
        {!showManualInput ? (
          <>
            {/* QR Scanner Placeholder */}
            <div className="absolute inset-0 flex items-center justify-center">
              {hasCamera ? (
                <div className="relative">
                  {/* Scanner Frame */}
                  <div className="w-64 h-64 relative">
                    {/* Corner brackets */}
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary-500 rounded-tl-lg" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary-500 rounded-tr-lg" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary-500 rounded-bl-lg" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary-500 rounded-br-lg" />

                    {/* Scanning line animation */}
                    <div className="absolute inset-4 overflow-hidden">
                      <div className="w-full h-0.5 bg-primary-500 animate-pulse"
                           style={{ animation: 'scan 2s ease-in-out infinite' }} />
                    </div>
                  </div>

                  <p className="text-white text-center mt-8 text-sm">
                    QR scanner coming soon
                  </p>
                </div>
              ) : (
                <div className="text-center text-white px-8">
                  <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <p className="text-gray-400">
                    {cameraError || 'Camera not available'}
                  </p>
                </div>
              )}
            </div>

            {/* Manual Entry Button */}
            <div className="absolute bottom-24 left-0 right-0 px-4">
              <button
                onClick={() => setShowManualInput(true)}
                className="w-full py-4 bg-white/10 backdrop-blur text-white font-semibold rounded-xl
                           hover:bg-white/20 active:scale-[0.98] transition-all"
              >
                Enter Code Manually
              </button>
            </div>
          </>
        ) : (
          /* Manual Input Form */
          <div className="w-full px-6">
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h2 className="text-xl font-semibold text-gray-800 text-center mb-6">
                Enter Location Code
              </h2>

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
                      Looking up...
                    </span>
                  ) : (
                    'Find Location'
                  )}
                </button>

                <button
                  onClick={() => setShowManualInput(false)}
                  className="w-full py-3 text-gray-600 font-medium
                             hover:text-gray-800 transition-colors"
                >
                  Back to Scanner
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Safe Area */}
      <div className="safe-area-bottom bg-gray-900" />

      <style jsx>{`
        @keyframes scan {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(200px); }
        }
      `}</style>
    </div>
  );
}
