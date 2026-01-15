'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSession, getDriver, DriverInfo } from '@/lib/session';
import { api, Location, WashService, Vehicle, VehicleCategory } from '@/lib/api';

interface SelectedService {
  service: WashService;
  vehicleCategory?: VehicleCategory;
  plateNumber?: string;
  quantity: number;
}

function NewWashContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locationCodeFromQR = searchParams.get('location');

  const [driver, setDriver] = useState<DriverInfo | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  // Ha QR kódból jövünk, egyből a szolgáltatás választásra ugrunk (amint betöltött a location)
  const [step, setStep] = useState<'location' | 'services' | 'vehicles'>(locationCodeFromQR ? 'services' : 'location');
  const [qrLocationLoading, setQrLocationLoading] = useState(!!locationCodeFromQR);

  // Form state
  const [locations, setLocations] = useState<Location[]>([]);
  const [services, setServices] = useState<WashService[]>([]);
  const [solos, setSolos] = useState<Vehicle[]>([]);
  const [tractors, setTractors] = useState<Vehicle[]>([]);
  const [trailers, setTrailers] = useState<Vehicle[]>([]);

  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([]);

  // Vehicle selection state
  const [selectedSolo, setSelectedSolo] = useState<Vehicle | null>(null);
  const [selectedTractor, setSelectedTractor] = useState<Vehicle | null>(null);
  const [selectedTrailer, setSelectedTrailer] = useState<Vehicle | null>(null);
  const [manualSoloPlate, setManualSoloPlate] = useState('');
  const [manualTractorPlate, setManualTractorPlate] = useState('');
  const [manualTrailerPlate, setManualTrailerPlate] = useState('');
  const [vehicleMode, setVehicleMode] = useState<'solo' | 'combo'>('combo');
  const [useManualPlates, setUseManualPlates] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const hasVehicles = solos.length > 0 || tractors.length > 0 || trailers.length > 0;

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
      setSolos(vehicleData.solos || []);
      setTractors(vehicleData.tractors || []);
      setTrailers(vehicleData.trailers || []);

      // If no saved vehicles, default to manual input
      const hasAnyVehicles = (vehicleData.solos?.length || 0) +
                            (vehicleData.tractors?.length || 0) +
                            (vehicleData.trailers?.length || 0) > 0;
      if (!hasAnyVehicles) {
        setUseManualPlates(true);
      }

      // If there's a location code from QR, auto-select it and load services directly
      if (locationCodeFromQR) {
        const location = locs.find(l => l.code === locationCodeFromQR);
        if (location) {
          setSelectedLocation(location);
          // Load services for QR location
          try {
            const svcs = await api.getServices(session, location.code);
            setServices(svcs);
            setStep('services');
          } catch (err) {
            setError('Nem sikerult betolteni a szolgaltatasokat');
            setStep('location');
          }
        } else {
          // Location code not found, show location selection
          setError(`Ismeretlen helyszin kod: ${locationCodeFromQR}`);
          setStep('location');
        }
        setQrLocationLoading(false);
      }
    } catch (err) {
      setError('Nem sikerult betolteni az adatokat');
      setQrLocationLoading(false);
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
      setStep('services');
    } catch (err) {
      setError('Nem sikerult betolteni a szolgaltatasokat');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleService = (service: WashService) => {
    setSelectedServices(prev => {
      const existing = prev.find(s => s.service.id === service.id);
      if (existing) {
        // Remove if already selected
        return prev.filter(s => s.service.id !== service.id);
      } else {
        // Add new service
        return [...prev, { service, quantity: 1 }];
      }
    });
  };

  const isServiceSelected = (serviceId: string) => {
    return selectedServices.some(s => s.service.id === serviceId);
  };

  const handleContinueToVehicles = () => {
    if (selectedServices.length === 0) {
      setError('Valassz legalabb egy szolgaltatast!');
      return;
    }
    setStep('vehicles');
    setError('');
  };

  const handleSubmit = async () => {
    if (!sessionId || !driver || !selectedLocation || selectedServices.length === 0) {
      return;
    }

    // Validate vehicle selection
    let tractorPlate: string | undefined;
    let trailerPlate: string | undefined;
    let soloPlate: string | undefined;

    if (vehicleMode === 'solo') {
      soloPlate = useManualPlates ? manualSoloPlate : selectedSolo?.plateNumber;
      if (!soloPlate?.trim()) {
        setError('Add meg a szolo jarmu rendszamat!');
        return;
      }
    } else {
      tractorPlate = useManualPlates ? manualTractorPlate : selectedTractor?.plateNumber;
      trailerPlate = useManualPlates ? manualTrailerPlate : selectedTrailer?.plateNumber;
      if (!tractorPlate?.trim()) {
        setError('Add meg a vontato rendszamat!');
        return;
      }
    }

    setIsLoading(true);
    setError('');

    try {
      // Build services array for API
      const servicesData = selectedServices.map(s => ({
        servicePackageId: s.service.id,
        quantity: s.quantity,
      }));

      const washEvent = await api.createWashEvent(sessionId, {
        locationId: selectedLocation.id,
        services: servicesData,
        // Backwards compatibility - send first service as main
        servicePackageId: selectedServices[0].service.id,
        // Vehicle data
        tractorVehicleId: vehicleMode === 'combo' && !useManualPlates ? selectedTractor?.id : undefined,
        tractorPlateManual: vehicleMode === 'combo' && useManualPlates ? tractorPlate?.toUpperCase().trim() :
                          vehicleMode === 'solo' ? soloPlate?.toUpperCase().trim() : undefined,
        trailerVehicleId: vehicleMode === 'combo' && !useManualPlates ? selectedTrailer?.id : undefined,
        trailerPlateManual: vehicleMode === 'combo' && useManualPlates && trailerPlate ? trailerPlate.toUpperCase().trim() : undefined,
      });

      router.push(`/wash/${washEvent.id}`);
    } catch (err: any) {
      setError(err.message || 'Nem sikerult letrehozni a mosast');
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 'services') {
      // Ha QR kódból jöttünk, visszamegyünk a dashboardra (nem a helyszínválasztásra)
      if (locationCodeFromQR) {
        router.push('/dashboard');
      } else {
        setStep('location');
        setSelectedLocation(null);
        setSelectedServices([]);
      }
    } else if (step === 'vehicles') {
      setStep('services');
    } else {
      router.back();
    }
  };

  if (!driver || qrLocationLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="animate-spin w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full mb-4"></div>
        <div className="text-gray-500">
          {qrLocationLoading ? 'Helyszin betoltese...' : 'Betoltes...'}
        </div>
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
            <h1 className="text-lg font-semibold">Uj mosas</h1>
            <p className="text-primary-200 text-sm">
              {step === 'location' && 'Valassz helyszint'}
              {step === 'services' && 'Valassz szolgaltatasokat'}
              {step === 'vehicles' && 'Valassz jarmut'}
            </p>
          </div>
        </div>
      </header>

      {/* Progress Indicator */}
      <div className="px-4 py-4">
        <div className="flex items-center justify-center gap-2">
          <div className={`w-3 h-3 rounded-full ${step === 'location' ? 'bg-primary-600' : 'bg-primary-200'}`} />
          <div className={`w-8 h-0.5 ${step !== 'location' ? 'bg-primary-600' : 'bg-gray-300'}`} />
          <div className={`w-3 h-3 rounded-full ${step === 'services' ? 'bg-primary-600' : step === 'vehicles' ? 'bg-primary-200' : 'bg-gray-300'}`} />
          <div className={`w-8 h-0.5 ${step === 'vehicles' ? 'bg-primary-600' : 'bg-gray-300'}`} />
          <div className={`w-3 h-3 rounded-full ${step === 'vehicles' ? 'bg-primary-600' : 'bg-gray-300'}`} />
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-500">
          <span>Helyszin</span>
          <span>Szolgaltatasok</span>
          <span>Jarmu</span>
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
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Valassz moso helyszint</h2>
            {locations.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {isLoading ? 'Helyszinek betoltese...' : 'Nincs elerheto helyszin'}
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

        {/* Step 2: Services Selection (Multi-select) */}
        {step === 'services' && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Valassz szolgaltatasokat</h2>
            <p className="text-sm text-gray-500 mb-4">Tobbet is valaszthatsz</p>

            <div className="bg-primary-50 rounded-xl p-3 mb-4">
              <p className="text-sm text-primary-700">
                <span className="font-medium">Helyszin:</span> {selectedLocation?.name}
              </p>
            </div>

            {services.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Nincs elerheto szolgaltatas ezen a helyszinen
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {services.map((service) => {
                    const isSelected = isServiceSelected(service.id);
                    return (
                      <button
                        key={service.id}
                        onClick={() => toggleService(service)}
                        className={`w-full rounded-xl shadow-sm p-4 text-left transition-all border-2 ${
                          isSelected
                            ? 'bg-primary-50 border-primary-500'
                            : 'bg-white border-transparent hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                            isSelected ? 'bg-primary-500' : 'bg-blue-100'
                          }`}>
                            {isSelected ? (
                              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            ) : (
                              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <div className="flex-1">
                            <h3 className={`font-semibold ${isSelected ? 'text-primary-700' : 'text-gray-800'}`}>
                              {service.name}
                            </h3>
                            <p className="text-sm text-gray-500">{service.code}</p>
                            {service.description && (
                              <p className="text-xs text-gray-400 mt-1">{service.description}</p>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Selected Count & Continue Button */}
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-600 mb-3 text-center">
                    {selectedServices.length === 0
                      ? 'Valassz legalabb egy szolgaltatast'
                      : `${selectedServices.length} szolgaltatas kivalasztva`
                    }
                  </p>
                  <button
                    onClick={handleContinueToVehicles}
                    disabled={selectedServices.length === 0}
                    className="w-full py-4 bg-primary-600 text-white font-semibold rounded-xl
                             disabled:bg-gray-300 disabled:cursor-not-allowed
                             hover:bg-primary-700 active:bg-primary-800 transition-colors"
                  >
                    Tovabb a jarmuhoz
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 3: Vehicle Selection */}
        {step === 'vehicles' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Valassz jarmut</h2>

            <div className="bg-primary-50 rounded-xl p-3 space-y-1">
              <p className="text-sm text-primary-700">
                <span className="font-medium">Helyszin:</span> {selectedLocation?.name}
              </p>
              <p className="text-sm text-primary-700">
                <span className="font-medium">Szolgaltatasok:</span> {selectedServices.map(s => s.service.name).join(', ')}
              </p>
            </div>

            {/* Vehicle Mode Toggle: Solo vs Combo */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Jarmu tipusa
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setVehicleMode('solo')}
                  className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${
                    vehicleMode === 'solo'
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200'
                  }`}
                >
                  <span className="text-2xl">🚗</span>
                  <span className={`text-sm font-medium ${vehicleMode === 'solo' ? 'text-primary-700' : 'text-gray-600'}`}>
                    Szolo
                  </span>
                </button>
                <button
                  onClick={() => setVehicleMode('combo')}
                  className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${
                    vehicleMode === 'combo'
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200'
                  }`}
                >
                  <span className="text-2xl">🚛🚚</span>
                  <span className={`text-sm font-medium ${vehicleMode === 'combo' ? 'text-primary-700' : 'text-gray-600'}`}>
                    Szerelveny
                  </span>
                </button>
              </div>
            </div>

            {/* Toggle between saved vehicles and manual input */}
            {hasVehicles && (
              <div className="flex gap-2">
                <button
                  onClick={() => setUseManualPlates(false)}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                    !useManualPlates
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  Mentett jarmuvek
                </button>
                <button
                  onClick={() => setUseManualPlates(true)}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                    useManualPlates
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  Kezi megadas
                </button>
              </div>
            )}

            {!useManualPlates && hasVehicles ? (
              /* Saved Vehicles Selection */
              <div className="space-y-4">
                {vehicleMode === 'solo' ? (
                  /* Solo Vehicle Selection */
                  <div className="bg-white rounded-xl shadow-sm p-4">
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Szolo jarmu *
                    </label>
                    <div className="space-y-2">
                      {solos.length === 0 ? (
                        <p className="text-gray-500 text-sm py-4 text-center">
                          Nincs mentett szolo jarmu. Haszналj kezi megadast!
                        </p>
                      ) : (
                        solos.map((vehicle) => (
                          <VehicleButton
                            key={vehicle.id}
                            vehicle={vehicle}
                            isSelected={selectedSolo?.id === vehicle.id}
                            onClick={() => setSelectedSolo(vehicle)}
                            icon="🚗"
                          />
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  /* Combo: Tractor + Trailer Selection */
                  <>
                    {/* Tractor Selection */}
                    <div className="bg-white rounded-xl shadow-sm p-4">
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Vontato *
                      </label>
                      <div className="space-y-2">
                        {tractors.length === 0 ? (
                          <p className="text-gray-500 text-sm py-4 text-center">
                            Nincs mentett vontato. Haszналj kezi megadast!
                          </p>
                        ) : (
                          tractors.map((vehicle) => (
                            <VehicleButton
                              key={vehicle.id}
                              vehicle={vehicle}
                              isSelected={selectedTractor?.id === vehicle.id}
                              onClick={() => setSelectedTractor(vehicle)}
                              icon="🚛"
                            />
                          ))
                        )}
                      </div>
                    </div>

                    {/* Trailer Selection */}
                    <div className="bg-white rounded-xl shadow-sm p-4">
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Vontatmany (opcionalis)
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
                          <p className="text-gray-500">Nincs vontatmany</p>
                        </button>
                        {trailers.map((vehicle) => (
                          <VehicleButton
                            key={vehicle.id}
                            vehicle={vehicle}
                            isSelected={selectedTrailer?.id === vehicle.id}
                            onClick={() => setSelectedTrailer(vehicle)}
                            icon="🚚"
                          />
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              /* Manual Plate Input */
              <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
                {vehicleMode === 'solo' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Szolo jarmu rendszama *
                    </label>
                    <input
                      type="text"
                      value={manualSoloPlate}
                      onChange={(e) => setManualSoloPlate(e.target.value.toUpperCase())}
                      placeholder="ABC-123"
                      className="w-full px-4 py-4 text-xl text-center font-mono tracking-wider
                                 border-2 border-gray-200 rounded-xl
                                 focus:border-primary-500 focus:ring-4 focus:ring-primary-100
                                 transition-all uppercase"
                      autoCapitalize="characters"
                      autoComplete="off"
                    />
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Vontato rendszama *
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
                        Vontatmany rendszama (opcionalis)
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
                  </>
                )}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={isLoading ||
                (vehicleMode === 'solo' && !useManualPlates && !selectedSolo && solos.length > 0) ||
                (vehicleMode === 'solo' && useManualPlates && !manualSoloPlate.trim()) ||
                (vehicleMode === 'combo' && !useManualPlates && !selectedTractor && tractors.length > 0) ||
                (vehicleMode === 'combo' && useManualPlates && !manualTractorPlate.trim())
              }
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
                  Letrehozas...
                </span>
              ) : (
                'Mosas inditasa'
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

// Vehicle Button Component
function VehicleButton({
  vehicle,
  isSelected,
  onClick,
  icon,
}: {
  vehicle: Vehicle;
  isSelected: boolean;
  onClick: () => void;
  icon: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full p-3 rounded-xl border-2 text-left transition-colors ${
        isSelected
          ? 'border-primary-500 bg-primary-50'
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
          isSelected
            ? 'bg-primary-500'
            : 'bg-gray-100'
        }`}>
          <span className="text-xl">{icon}</span>
        </div>
        <div className="flex-1">
          <p className="font-mono font-semibold text-gray-800">
            {vehicle.plateNumber}
          </p>
          {vehicle.nickname && (
            <p className="text-xs text-gray-500">{vehicle.nickname}</p>
          )}
        </div>
        {isSelected && (
          <svg className="w-5 h-5 text-primary-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        )}
      </div>
    </button>
  );
}

export default function NewWashPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Betoltes...</div>
      </div>
    }>
      <NewWashContent />
    </Suspense>
  );
}
