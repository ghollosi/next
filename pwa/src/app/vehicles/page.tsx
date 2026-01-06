'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, getDriver, DriverInfo } from '@/lib/session';
import { api, Vehicle } from '@/lib/api';

export default function VehiclesPage() {
  const router = useRouter();
  const [driver, setDriver] = useState<DriverInfo | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [tractors, setTractors] = useState<Vehicle[]>([]);
  const [trailers, setTrailers] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const session = getSession();
    const driverInfo = getDriver();

    if (!session || !driverInfo) {
      router.replace('/login');
      return;
    }

    setSessionId(session);
    setDriver(driverInfo);
    loadVehicles(session);
  }, [router]);

  const loadVehicles = async (session: string) => {
    try {
      const data = await api.getVehicles(session);
      setTractors(data.tractors || []);
      setTrailers(data.trailers || []);
    } catch (err: any) {
      setError(err.message || 'Nem sikerult betolteni a jarmuveket');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  if (!driver) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Betoltes...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-primary-600 text-white px-4 py-4 safe-area-top">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="p-2 hover:bg-primary-700 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-lg font-semibold">Jarmuveim</h1>
            <p className="text-primary-200 text-sm">
              {tractors.length + trailers.length} jarmu
            </p>
          </div>
        </div>
      </header>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 px-4 py-6 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <svg className="animate-spin w-8 h-8 text-primary-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        ) : tractors.length === 0 && trailers.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Nincs jarmu</h3>
            <p className="text-gray-500">Meg nem tartozik jarmu a profilodhoz.</p>
            <p className="text-gray-400 text-sm mt-2">
              Kerlek, fordulj a diszpecserhez jarmu hozzaadasaert.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Vontatók */}
            {tractors.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <span className="text-2xl">🚛</span>
                  Vontatok ({tractors.length})
                </h2>
                <div className="space-y-3">
                  {tractors.map((vehicle) => (
                    <div
                      key={vehicle.id}
                      className="bg-white rounded-xl shadow-sm p-4"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center">
                          <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className="font-mono text-xl font-bold text-gray-800">
                            {vehicle.plateNumber}
                          </p>
                          <p className="text-sm text-gray-500">
                            Vontato
                            {vehicle.plateState && ` - ${vehicle.plateState}`}
                          </p>
                        </div>
                        <div className="w-3 h-3 bg-green-500 rounded-full" title="Aktiv" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pótkocsik */}
            {trailers.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <span className="text-2xl">🚚</span>
                  Potkocsik ({trailers.length})
                </h2>
                <div className="space-y-3">
                  {trailers.map((vehicle) => (
                    <div
                      key={vehicle.id}
                      className="bg-white rounded-xl shadow-sm p-4"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-orange-100 rounded-xl flex items-center justify-center">
                          <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className="font-mono text-xl font-bold text-gray-800">
                            {vehicle.plateNumber}
                          </p>
                          <p className="text-sm text-gray-500">
                            Potkocsi
                            {vehicle.plateState && ` - ${vehicle.plateState}`}
                          </p>
                        </div>
                        <div className="w-3 h-3 bg-green-500 rounded-full" title="Aktiv" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="px-4 pb-4">
        <div className="bg-blue-50 rounded-xl p-4 text-center">
          <p className="text-sm text-blue-700">
            Jarmu hozzaadasahoz vagy modositasahoz kerlek fordulj a diszpecserhez.
          </p>
        </div>
      </div>

      {/* Bottom Safe Area */}
      <div className="safe-area-bottom" />
    </div>
  );
}
