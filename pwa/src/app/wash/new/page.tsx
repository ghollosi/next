'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, getDriver, DriverInfo } from '@/lib/session';
import { api, Location, WashService } from '@/lib/api';

export default function NewWashPage() {
  const router = useRouter();
  const [driver, setDriver] = useState<DriverInfo | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [step, setStep] = useState<'location' | 'service' | 'plate'>('location');

  // Form state
  const [locations, setLocations] = useState<Location[]>([]);
  const [services, setServices] = useState<WashService[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [selectedService, setSelectedService] = useState<WashService | null>(null);
  const [tractorPlate, setTractorPlate] = useState('');
  const [trailerPlate, setTrailerPlate] = useState('');

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
    loadLocations(session);
  }, [router]);

  const loadLocations = async (session: string) => {
    try {
      const locs = await api.getLocations(session);
      setLocations(locs);
    } catch (err) {
      setError('Failed to load locations');
    }
  };

  const handleSelectLocation = async (location: Location) => {
    setSelectedLocation(location);
    setIsLoading(true);
    try {
      const svcs = await api.getServices(sessionId!, location.code);
      setServices(svcs);
      setStep('service');
    } catch (err) {
      setError('Failed to load services');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectService = (service: WashService) => {
    setSelectedService(service);
    setStep('plate');
  };

  const handleSubmit = async () => {
    if (!sessionId || !driver || !selectedLocation || !selectedService || !tractorPlate.trim()) {
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const washEvent = await api.createWashEvent(sessionId, {
        locationCode: selectedLocation.code,
        servicePackageCode: selectedService.code,
        tractorPlateManual: tractorPlate.toUpperCase().trim(),
        trailerPlateManual: trailerPlate.toUpperCase().trim() || undefined,
      });

      router.push(`/wash/${washEvent.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create wash event');
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 'service') {
      setStep('location');
      setSelectedLocation(null);
    } else if (step === 'plate') {
      setStep('service');
      setSelectedService(null);
    } else {
      router.back();
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
            <h1 className="text-lg font-semibold">New Wash</h1>
            <p className="text-primary-200 text-sm">
              {step === 'location' && 'Select location'}
              {step === 'service' && 'Select service'}
              {step === 'plate' && 'Enter plate number'}
            </p>
          </div>
        </div>
      </header>

      {/* Progress Indicator */}
      <div className="px-4 py-4">
        <div className="flex items-center justify-center gap-2">
          <div className={`w-3 h-3 rounded-full ${step === 'location' ? 'bg-primary-600' : 'bg-primary-200'}`} />
          <div className={`w-8 h-0.5 ${step !== 'location' ? 'bg-primary-600' : 'bg-gray-300'}`} />
          <div className={`w-3 h-3 rounded-full ${step === 'service' ? 'bg-primary-600' : step === 'plate' ? 'bg-primary-200' : 'bg-gray-300'}`} />
          <div className={`w-8 h-0.5 ${step === 'plate' ? 'bg-primary-600' : 'bg-gray-300'}`} />
          <div className={`w-3 h-3 rounded-full ${step === 'plate' ? 'bg-primary-600' : 'bg-gray-300'}`} />
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
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Select Wash Location</h2>
            {locations.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {isLoading ? 'Loading locations...' : 'No locations available'}
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
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Select Service</h2>
            <div className="bg-primary-50 rounded-xl p-3 mb-4">
              <p className="text-sm text-primary-700">
                <span className="font-medium">Location:</span> {selectedLocation?.name}
              </p>
            </div>
            {services.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No services available at this location
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

        {/* Step 3: Plate Number */}
        {step === 'plate' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Enter Plate Numbers</h2>

            <div className="bg-primary-50 rounded-xl p-3 space-y-1">
              <p className="text-sm text-primary-700">
                <span className="font-medium">Location:</span> {selectedLocation?.name}
              </p>
              <p className="text-sm text-primary-700">
                <span className="font-medium">Service:</span> {selectedService?.name}
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tractor Plate Number *
                </label>
                <input
                  type="text"
                  value={tractorPlate}
                  onChange={(e) => setTractorPlate(e.target.value.toUpperCase())}
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
                  Trailer Plate Number (optional)
                </label>
                <input
                  type="text"
                  value={trailerPlate}
                  onChange={(e) => setTrailerPlate(e.target.value.toUpperCase())}
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

            <button
              onClick={handleSubmit}
              disabled={isLoading || !tractorPlate.trim()}
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
                  Creating...
                </span>
              ) : (
                'Create Wash Event'
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
