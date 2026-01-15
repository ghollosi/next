'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';

function DownloadContent() {
  const searchParams = useSearchParams();
  const locationCode = searchParams.get('location');

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-600 to-primary-800 flex flex-col items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        {/* Logo */}
        <div className="w-20 h-20 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <svg className="w-12 h-12 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          VSys Truck Wash
        </h1>
        <p className="text-gray-600 mb-8">
          Töltsd le az alkalmazást a kamion mosás indításához
        </p>

        {locationCode && (
          <div className="bg-primary-50 rounded-xl p-4 mb-6">
            <p className="text-sm text-primary-700">
              Helyszín: <strong>{locationCode}</strong>
            </p>
          </div>
        )}

        {/* Platform Selection */}
        <div className="space-y-4 mb-8">
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              alert('Az App Store link hamarosan elérhető!');
            }}
            className="flex items-center justify-center gap-3 w-full py-4 px-6 bg-black text-white rounded-xl hover:bg-gray-800 transition-colors"
          >
            <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
            <div className="text-left">
              <p className="text-xs opacity-75">Letöltés innen</p>
              <p className="text-lg font-semibold">App Store</p>
            </div>
          </a>

          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              alert('A Google Play link hamarosan elérhető!');
            }}
            className="flex items-center justify-center gap-3 w-full py-4 px-6 bg-black text-white rounded-xl hover:bg-gray-800 transition-colors"
          >
            <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z"/>
            </svg>
            <div className="text-left">
              <p className="text-xs opacity-75">Elérhető itt</p>
              <p className="text-lg font-semibold">Google Play</p>
            </div>
          </a>
        </div>

        {/* Divider */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-white text-gray-500">vagy</span>
          </div>
        </div>

        {/* Web App Option */}
        <div className="space-y-3">
          <Link
            href={`/register${locationCode ? `?location=${locationCode}` : ''}`}
            className="block w-full py-3 px-6 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 transition-colors"
          >
            Folytatás a böngészőben
          </Link>
          <p className="text-xs text-gray-500">
            Használhatod az alkalmazást a böngészőben is, de a legjobb élményért töltsd le a natív appot.
          </p>
        </div>
      </div>

      {/* Footer */}
      <p className="text-white/60 text-sm mt-8">
        © 2025 VSys Next. Minden jog fenntartva.
      </p>
    </div>
  );
}

export default function DownloadPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-primary-600 to-primary-800 flex items-center justify-center">
        <p className="text-white">Betöltés...</p>
      </div>
    }>
      <DownloadContent />
    </Suspense>
  );
}
