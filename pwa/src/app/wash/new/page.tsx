'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSession, getDriver, DriverInfo } from '@/lib/session';
import { api, Location, WashService, Vehicle } from '@/lib/api';

function NewWashContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locationCodeFromQR = searchParams.get('location');

  const [driver, setDriver] = useState<DriverInfo | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [step, setStep] = useState<'location' | 'service' | 'vehicle'>('location');

  // Form state
  const [locations, setLocations] = useState<Location[]>([]);
  const [services, setServices] = useState<WashService[]>([]);
  const [tractors, setTractors] = useState<Vehicle[]>([]);
  const [trailers, setTrailers] = useState<Vehicle[]>([]);

  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [selectedService, setSelectedService] = useState<WashService | null>(null);
  const [selectedTractor, setSelectedTractor] = useState<Vehicle | null>(null);
  const [selectedTrailer, setSelectedTrailer] = useState<Vehicle | null>(null);
  const [manualTractorPlate, setManualTractorPlate] = useState('');
  const [manualTrailerPlate, setManualTrailerPlate] = useState('');
  const [useManualPlates, setUseManualPlates] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
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
    loadInitialData(session);
  }, [router]);

  const loadInitialData = async (session: string) => {
    try {
      const [locs, vehicleData] = await Promise.all([
        api.getLocations(session),
        api.getVehicles(session),
      ]);
      setLocations(locs);
      setTractors(vehicleData.tractors || []);
      setTrailers(vehicleData.trailers || []);

      // If no saved vehicles, default to manual input
      if (!vehicleData.tractors || vehicleData.tractors.length === 0) {
        setUseManualPlates(true);
      }

      // If there's a location code from QR, auto-select it
      if (locationCodeFromQR) {
        const location = locs.find(l => l.code === locationCodeFromQR);
        if (location) {
          handleSelectLocation(location, session);
        }
      }
    } catch (err) {
      setError('Nem sikerült betölteni az adatokat');
    }
  };

  const handleSelectLocation = async (location: Location, session?: string) => {
    const sid = session || sessionId;
    if (!sid) return;

    setSelectedLocation(location);
    setIsLoading(true);
    try {
      const svcs = await api.getServices(sid, location.code);
      setServices(svcs);
      setStep('service');
    } catch (err) {
      setError('Nem sikerült betölteni a szolgáltatásokat');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectService = (service: WashService) => {
    setSelectedService(service);
    setStep('vehicle');
    // Pre-select first tractor if available
    if (tractors.length > 0) {
      setSelectedTractor(tractors[0]);
    }
  };

  const handleSubmit = async () => {
    if (!sessionId || !driver || !selectedLocation || !selectedService) {
      return;
    }

    // Need either selected vehicle or manual plate
    const tractorPlate = useManualPlates ? manualTractorPlate : selectedTractor?.plateNumber;
    const trailerPlate = useManualPlates ? manualTrailerPlate : selectedTrailer?.plateNumber;

    if (!tractorPlate?.trim()) {
      setError('Válassz vontatót vagy add meg a rendszámot!');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const washEvent = await api.createWashEvent(sessionId, {
        locationId: selectedLocation.id,
        servicePackageId: selectedService.id,
        tractorVehicleId: useManualPlates ? undefined : selectedTractor?.id,
        tractorPlateManual: useManualPlates ? tractorPlate.toUpperCase().trim() : undefined,
        trailerVehicleId: useManualPlates ? undefined : selectedTrailer?.id,
        trailerPlateManual: useManualPlates && trailerPlate ? trailerPlate.toUpperCase().trim() : undefined,
      });

      router.push(`/wash/${washEvent.id}`);
    } catch (err: any) {
      setError(err.message || 'Nem sikerült létrehozni a mosást');
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 'service') {
      setStep('location');
      setSelectedLocation(null);
    } else if (step === 'vehicle') {
      setStep('service');
      setSelectedService(null);
    } else {
      router.back();
    }
  };

  if (!driver) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Betöltés...</div>
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
            <h1 className="text-lg font-semibold">Új mosás</h1>
            <p className="text-primary-200 text-sm">
              {step === 'location' && 'Válassz helyszínt'}
              {step === 'service' && 'Válassz szolgáltatást'}
              {step === 'vehicle' && 'Válassz járművet'}
            </p>
          </div>
        </div>
      </header>

      {/* Progress Indicator */}
      <div className="px-4 py-4">
        <div className="flex items-center justify-center gap-2">
          <div className={`w-3 h-3 rounded-full ${step === 'location' ? 'bg-primary-600' : 'bg-primary-200'}`} />
          <div className={`w-8 h-0.5 ${step !== 'location' ? 'bg-primary-600' : 'bg-gray-300'}`} />
          <div className={`w-3 h-3 rounded-full ${step === 'service' ? 'bg-primary-600' : step === 'vehicle' ? 'bg-primary-200' : 'bg-gray-300'}`} />
          <div className={`w-8 h-0.5 ${step === 'vehicle' ? 'bg-primary-600' : 'bg-gray-300'}`} />
          <div className={`w-3 h-3 rounded-full ${step === 'vehicle' ? 'bg-primary-600' : 'bg-gray-300'}`} />
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-500">
          <span>Helyszín</span>
          <span>Szolgáltatás</span>
          <span>Jármű</span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 px-4 pb-6 overflow-auto">
        {/* Step 1: Location Selection */}
        {step === 'location' && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Válassz mosó helyszínt</h2>
            {locations.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {isLoading ? 'Helyszínek betöltése...' : 'Nincs elérhető helyszín'}
              </div>
            ) : (
              locations.map((location) => (
                <button
                  key={location.id}
                  onClick={() => handleSelectLocation(location)}
                  disabled={isLoading}
                  className="w-full bg-white rounded-xl shadow-sm p-4 text-left
                             hover:bg-gray-50 active:bg-gray-100 transition-colors
                             disabled:opacity-50"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-800">{location.name}</h3>
                      <p className="text-sm text-gray-500">{location.code}</p>
                      {location.city && (
                        <p className="text-xs text-gray-400">{location.city}</p>
                      )}
                    </div>
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {/* Step 2: Service Selection */}
        {step === 'service' && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Válassz szolgáltatást</h2>
            <div className="bg-primary-50 rounded-xl p-3 mb-4">
              <p className="text-sm text-primary-700">
                <span className="font-medium">Helyszín:</span> {selectedLocation?.name}
              </p>
            </div>
            {services.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Nincs elérhető szolgáltatás ezen a helyszínen
              </div>
            ) : (
              services.map((service) => (
                <button
                  key={service.id}
                  onClick={() => handleSelectService(service)}
                  className="w-full bg-white rounded-xl shadow-sm p-4 text-left
                             hover:bg-gray-50 active:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-800">{service.name}</h3>
                      <p className="text-sm text-gray-500">{service.code}</p>
                      {service.description && (
                        <p className="text-xs text-gray-400 mt-1">{service.description}</p>
                      )}
                    </div>
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {/* Step 3: Vehicle Selection */}
        {step === 'vehicle' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Válassz járművet</h2>

            <div className="bg-primary-50 rounded-xl p-3 space-y-1">
              <p className="text-sm text-primary-700">
                <span className="font-medium">Helyszín:</span> {selectedLocation?.name}
              </p>
              <p className="text-sm text-primary-700">
                <span className="font-medium">Szolgáltatás:</span> {selectedService?.name}
              </p>
            </div>

            {/* Toggle between saved vehicles and manual input */}
            {tractors.length > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={() => setUseManualPlates(false)}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                    !useManualPlates
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  Saját járművek
                </button>
                <button
                  onClick={() => setUseManualPlates(true)}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                    useManualPlates
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  Kézi megadás
                </button>
              </div>
            )}

            {!useManualPlates && tractors.length > 0 ? (
              /* Saved Vehicles Selection */
              <div className="space-y-4">
                {/* Tractor Selection */}
                <div className="bg-white rounded-xl shadow-sm p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Vontató *
                  </label>
                  <div className="space-y-2">
                    {tractors.map((tractor) => (
                      <button
                        key={tractor.id}
                        onClick={() => setSelectedTractor(tractor)}
                        className={`w-full p-3 rounded-xl border-2 text-left transition-colors ${
                          selectedTractor?.id === tractor.id
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            selectedTractor?.id === tractor.id
                              ? 'bg-primary-500 text-white'
                              : 'bg-gray-100 text-gray-500'
                          }`}>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                            </svg>
                          </div>
                          <div>
                            <p className="font-mono font-semibold text-gray-800">
                              {tractor.plateNumber}
                            </p>
                            {tractor.plateState && (
                              <p className="text-xs text-gray-500">{tractor.plateState}</p>
                            )}
                          </div>
                          {selectedTractor?.id === tractor.id && (
                            <svg className="w-5 h-5 text-primary-500 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Trailer Selection */}
                {trailers.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm p-4">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Pótkocsi (opcionális)
                    </label>
                    <div className="space-y-2">
                      <button
                        onClick={() => setSelectedTrailer(null)}
                        className={`w-full p-3 rounded-xl border-2 text-left transition-colors ${
                          selectedTrailer === null
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <p className="text-gray-500">Nincs pótkocsi</p>
                      </button>
                      {trailers.map((trailer) => (
                        <button
                          key={trailer.id}
                          onClick={() => setSelectedTrailer(trailer)}
                          className={`w-full p-3 rounded-xl border-2 text-left transition-colors ${
                            selectedTrailer?.id === trailer.id
                              ? 'border-primary-500 bg-primary-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              selectedTrailer?.id === trailer.id
                                ? 'bg-primary-500 text-white'
                                : 'bg-gray-100 text-gray-500'
                            }`}>
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                              </svg>
                            </div>
                            <div>
                              <p className="font-mono font-semibold text-gray-800">
                                {trailer.plateNumber}
                              </p>
                              {trailer.plateState && (
                                <p className="text-xs text-gray-500">{trailer.plateState}</p>
                              )}
                            </div>
                            {selectedTrailer?.id === trailer.id && (
                              <svg className="w-5 h-5 text-primary-500 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Manual Plate Input */
              <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Vontató rendszáma *
                  </label>
                  <input
                    type="text"
                    value={manualTractorPlate}
                    onChange={(e) => setManualTractorPlate(e.target.value.toUpperCase())}
                    placeholder="ABC-123"
                    className="w-full px-4 py-4 text-xl text-center font-mono tracking-wider
                               border-2 border-gray-200 rounded-xl
                               focus:border-primary-500 focus:ring-4 focus:ring-primary-100
                               transition-all uppercase"
                    autoCapitalize="characters"
                    autoComplete="off"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pótkocsi rendszáma (opcionális)
                  </label>
                  <input
                    type="text"
                    value={manualTrailerPlate}
                    onChange={(e) => setManualTrailerPlate(e.target.value.toUpperCase())}
                    placeholder="XYZ-789"
                    className="w-full px-4 py-4 text-xl text-center font-mono tracking-wider
                               border-2 border-gray-200 rounded-xl
                               focus:border-primary-500 focus:ring-4 focus:ring-primary-100
                               transition-all uppercase"
                    autoCapitalize="characters"
                    autoComplete="off"
                  />
                </div>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={isLoading || (!useManualPlates && !selectedTractor) || (useManualPlates && !manualTractorPlate.trim())}
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
                  Létrehozás...
                </span>
              ) : (
                'Mosás indítása'
              )}
            </button>
          </div>
        )}
      </div>

      {/* Bottom Safe Area */}
      <div className="safe-area-bottom" />
    </div>
  );
}

export default function NewWashPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Betöltés...</div>
      </div>
    }>
      <NewWashContent />
    </Suspense>
  );
}
