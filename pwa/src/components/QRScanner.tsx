'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';

interface QRScannerProps {
  onScan: (result: string) => void;
  onError?: (error: string) => void;
  onCameraError?: (error: string) => void;
}

export default function QRScanner({ onScan, onError, onCameraError }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isStarted, setIsStarted] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    let mounted = true;

    const startScanner = async () => {
      if (!containerRef.current || scannerRef.current) return;

      const scannerId = 'qr-scanner-container';

      // Ensure the container has the correct ID
      containerRef.current.id = scannerId;

      try {
        const html5QrCode = new Html5Qrcode(scannerId);
        scannerRef.current = html5QrCode;

        // Use facingMode constraint to request back camera directly
        // This is more reliable than camera ID selection on iOS
        await html5QrCode.start(
          { facingMode: "environment" }, // "environment" = back camera, "user" = front camera
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1,
          },
          (decodedText) => {
            // Success callback
            if (mounted) {
              onScan(decodedText);
            }
          },
          (errorMessage) => {
            // Error callback (scanning errors, not critical)
            // These are expected when no QR code is in view
          }
        );

        if (mounted) {
          setIsStarted(true);
          setIsInitializing(false);
        }
      } catch (err: any) {
        console.error('QR Scanner error:', err);

        let errorMsg = 'Nem sikerult elinditani a kamerat';

        if (err.message?.includes('Permission')) {
          errorMsg = 'Kamera hozzaferes megtagadva. Kerem engedelyezze a kamerat a bongeszo beallitasaiban.';
        } else if (err.message?.includes('NotFound') || err.message?.includes('not found')) {
          errorMsg = 'Nem talalhato kamera az eszkozon';
        } else if (err.message?.includes('NotReadable') || err.message?.includes('not readable')) {
          errorMsg = 'A kamera mas alkalmazas altal van hasznalva';
        } else if (err.message?.includes('NotAllowed')) {
          errorMsg = 'Kamera hozzaferes megtagadva. Kerem engedelyezze a kamerat.';
        } else if (err.message?.includes('Overconstrained')) {
          errorMsg = 'A kamera nem tamogatja a kert beallitasokat';
        }

        if (mounted) {
          setCameraError(errorMsg);
          onCameraError?.(errorMsg);
          setIsInitializing(false);
        }
      }
    };

    // Small delay to ensure DOM is ready
    const timer = setTimeout(startScanner, 100);

    return () => {
      mounted = false;
      clearTimeout(timer);

      // Cleanup scanner
      if (scannerRef.current) {
        const scanner = scannerRef.current;
        try {
          if (scanner.getState() === Html5QrcodeScannerState.SCANNING) {
            scanner.stop().catch(() => {
              // Ignore stop errors during cleanup
            });
          }
        } catch {
          // Ignore errors during cleanup
        }
        scannerRef.current = null;
      }
    };
  }, [onScan, onCameraError]);

  if (cameraError) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p className="text-white font-medium mb-2">Kamera hiba</p>
        <p className="text-gray-400 text-sm">{cameraError}</p>
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-sm mx-auto">
      {isInitializing && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-gray-900">
          <div className="text-center">
            <svg className="animate-spin w-8 h-8 text-primary-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-white text-sm">Kamera inditasa...</p>
          </div>
        </div>
      )}

      {/* Scanner container - html5-qrcode will inject video here */}
      <div
        ref={containerRef}
        className="w-full aspect-square rounded-2xl overflow-hidden bg-black"
      />

      {/* Overlay with scanning frame */}
      {isStarted && (
        <div className="absolute inset-0 pointer-events-none">
          {/* Semi-transparent overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-64 h-64">
              {/* Corner brackets */}
              <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-primary-500 rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-primary-500 rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-primary-500 rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-primary-500 rounded-br-lg" />

              {/* Scanning line animation */}
              <div className="absolute inset-4 overflow-hidden">
                <div
                  className="w-full h-1 bg-gradient-to-r from-transparent via-primary-500 to-transparent"
                  style={{ animation: 'scan 2s ease-in-out infinite' }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes scan {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(224px); }
        }
      `}</style>
    </div>
  );
}
