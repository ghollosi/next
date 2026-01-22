'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, getDriver, DriverInfo } from '@/lib/session';
import DriverEmiWrapper from '@/components/DriverEmiWrapper';

const API_URL = 'https://api.vemiax.com';

interface Location {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
}

interface TimeSlot {
  startTime: string;
  endTime: string;
  available: boolean;
  remainingSlots: number;
}

interface ServicePackage {
  id: string;
  name: string;
  code: string;
  durationMinutes: number;
  price: number;
  currency: string;
}

interface Booking {
  id: string;
  bookingCode: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: string;
  location?: { name: string; code: string };
  servicePackage?: { name: string };
}

const statusLabels: Record<string, string> = {
  PENDING: 'Függőben',
  CONFIRMED: 'Megerősítve',
  IN_PROGRESS: 'Folyamatban',
  COMPLETED: 'Befejezve',
  CANCELLED: 'Lemondva',
  NO_SHOW: 'Nem jelent meg',
};

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-purple-100 text-purple-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
  NO_SHOW: 'bg-red-100 text-red-800',
};

export default function BookingPage() {
  const router = useRouter();
  const [driver, setDriver] = useState<DriverInfo | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [step, setStep] = useState<'list' | 'location' | 'date' | 'time' | 'confirm'>('list');
  const [locations, setLocations] = useState<Location[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [services, setServices] = useState<ServicePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Booking form state
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [selectedService, setSelectedService] = useState<ServicePackage | null>(null);
  const [plateNumber, setPlateNumber] = useState('');
  const [vehicleType, setVehicleType] = useState('CAR');

  useEffect(() => {
    const session = getSession();
    const driverInfo = getDriver();

    if (!session || !driverInfo) {
      router.replace('/login');
      return;
    }

    setSessionId(session);
    setDriver(driverInfo);
    loadBookings(session);
  }, [router]);

  async function loadBookings(session: string) {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/pwa/bookings`, {
        headers: { 'x-driver-session': session },
      });

      if (!response.ok) {
        if (response.status === 401) {
          router.replace('/login');
          return;
        }
        throw new Error('Hiba a foglalások betöltésekor');
      }

      const data = await response.json();
      setBookings(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadLocations() {
    if (!sessionId) return;
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/pwa/bookings/locations`, {
        headers: { 'x-driver-session': sessionId },
      });

      if (!response.ok) throw new Error('Hiba a helyszínek betöltésekor');

      const data = await response.json();
      setLocations(data);
      setStep('location');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadSlots(locationId: string, date: string) {
    if (!sessionId) return;
    try {
      setLoading(true);
      const response = await fetch(
        `${API_URL}/pwa/bookings/slots?locationId=${locationId}&date=${date}&vehicleType=${vehicleType}`,
        { headers: { 'x-driver-session': sessionId } }
      );

      if (!response.ok) throw new Error('Hiba az időpontok betöltésekor');

      const data = await response.json();
      setSlots(data.slots || []);
      setServices(data.services || []);
      setStep('time');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (!sessionId || !selectedLocation || !selectedSlot || !selectedService) return;

    try {
      setSubmitting(true);
      setError('');

      const response = await fetch(`${API_URL}/pwa/bookings`, {
        method: 'POST',
        headers: {
          'x-driver-session': sessionId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          locationId: selectedLocation.id,
          servicePackageId: selectedService.id,
          scheduledStart: selectedSlot.startTime,
          vehicleType,
          plateNumber: plateNumber.toUpperCase(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Hiba a foglalás létrehozásakor');
      }

      // Reset and go back to list
      resetForm();
      await loadBookings(sessionId);
      setStep('list');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelBooking(bookingId: string) {
    if (!sessionId) return;
    if (!confirm('Biztosan lemondja ezt a foglalást?')) return;

    try {
      const response = await fetch(`${API_URL}/pwa/bookings/${bookingId}/cancel`, {
        method: 'POST',
        headers: {
          'x-driver-session': sessionId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: 'Ügyfél lemondta' }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Hiba a lemondáskor');
      }

      await loadBookings(sessionId);
    } catch (err: any) {
      setError(err.message);
    }
  }

  function resetForm() {
    setSelectedLocation(null);
    setSelectedDate('');
    setSelectedSlot(null);
    setSelectedService(null);
    setPlateNumber('');
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('hu-HU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    });
  }

  function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString('hu-HU', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatSlotTime(timeStr: string) {
    const date = new Date(timeStr);
    return date.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
  }

  // Get min/max dates for date picker (today to 30 days ahead)
  const today = new Date().toISOString().split('T')[0];
  const maxDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {step !== 'list' && (
              <button
                onClick={() => {
                  if (step === 'location') {
                    setStep('list');
                  } else if (step === 'date') {
                    setStep('location');
                  } else if (step === 'time') {
                    setStep('date');
                  } else if (step === 'confirm') {
                    setStep('time');
                  }
                }}
                className="p-2 hover:bg-primary-700 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <div>
              <h1 className="text-lg font-semibold">Időpontfoglalás</h1>
              <p className="text-primary-200 text-sm">
                {step === 'list' && 'Foglalásaim'}
                {step === 'location' && 'Helyszín választása'}
                {step === 'date' && 'Dátum választása'}
                {step === 'time' && 'Időpont választása'}
                {step === 'confirm' && 'Foglalás megerősítése'}
              </p>
            </div>
          </div>
          {step === 'list' && (
            <button
              onClick={() => router.push('/dashboard')}
              className="p-2 hover:bg-primary-700 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </header>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {error}
          <button onClick={() => setError('')} className="ml-2 underline">Bezárás</button>
        </div>
      )}

      <main className="flex-1 p-4">
        {loading && step !== 'list' ? (
          <div className="text-center py-8 text-gray-500">Betöltés...</div>
        ) : (
          <>
            {/* Step: List of bookings */}
            {step === 'list' && (
              <>
                <button
                  onClick={loadLocations}
                  className="w-full bg-primary-600 text-white rounded-xl p-4 font-semibold flex items-center justify-center gap-2 hover:bg-primary-700 transition-colors mb-6"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Új foglalás
                </button>

                {loading ? (
                  <div className="text-center py-8 text-gray-500">Betöltés...</div>
                ) : bookings.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p>Nincs aktív foglalásod</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                      Aktív foglalások
                    </h3>
                    {bookings.map((booking) => (
                      <div key={booking.id} className="bg-white rounded-xl p-4 shadow-sm">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono font-bold text-gray-900">
                                {booking.bookingCode}
                              </span>
                              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[booking.status]}`}>
                                {statusLabels[booking.status]}
                              </span>
                            </div>
                            <div className="text-sm text-gray-600">
                              {formatDate(booking.scheduledStart)}
                            </div>
                            <div className="text-sm font-medium text-gray-900">
                              {formatTime(booking.scheduledStart)} - {formatTime(booking.scheduledEnd)}
                            </div>
                            <div className="text-sm text-gray-500 mt-1">
                              {booking.location?.name} ({booking.location?.code})
                            </div>
                            <div className="text-sm text-gray-500">
                              {booking.servicePackage?.name}
                            </div>
                          </div>
                          {['PENDING', 'CONFIRMED'].includes(booking.status) && (
                            <button
                              onClick={() => cancelBooking(booking.id)}
                              className="text-red-600 text-sm font-medium hover:text-red-700"
                            >
                              Lemondás
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Step: Select location */}
            {step === 'location' && (
              <div className="space-y-3">
                {locations.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    Nincs elérhető helyszín időpontfoglaláshoz
                  </div>
                ) : (
                  locations.map((location) => (
                    <button
                      key={location.id}
                      onClick={() => {
                        setSelectedLocation(location);
                        setStep('date');
                      }}
                      className="w-full bg-white rounded-xl p-4 shadow-sm text-left hover:bg-gray-50 transition-colors"
                    >
                      <div className="font-medium text-gray-900">{location.name}</div>
                      <div className="text-sm text-gray-500">{location.code}</div>
                      <div className="text-sm text-gray-500">{location.address}, {location.city}</div>
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Step: Select date */}
            {step === 'date' && selectedLocation && (
              <div className="space-y-4">
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="text-sm text-gray-500 mb-1">Helyszín</div>
                  <div className="font-medium text-gray-900">{selectedLocation.name}</div>
                </div>

                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Jármű típusa
                  </label>
                  <select
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="CAR">Személyautó</option>
                    <option value="VAN">Kisteherautó</option>
                    <option value="BUS">Busz</option>
                    <option value="SEMI_TRUCK">Kamion</option>
                    <option value="TRUCK_12T">Kamion 12t</option>
                    <option value="TRAILER">Pótkocsi</option>
                  </select>
                </div>

                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Dátum kiválasztása
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    min={today}
                    max={maxDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                <button
                  onClick={() => loadSlots(selectedLocation.id, selectedDate)}
                  disabled={!selectedDate}
                  className="w-full bg-primary-600 text-white rounded-xl p-4 font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-primary-700 transition-colors"
                >
                  Időpontok megtekintése
                </button>
              </div>
            )}

            {/* Step: Select time slot */}
            {step === 'time' && selectedLocation && (
              <div className="space-y-4">
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="text-sm text-gray-500 mb-1">Helyszín</div>
                  <div className="font-medium text-gray-900">{selectedLocation.name}</div>
                  <div className="text-sm text-gray-500 mt-2">
                    {new Date(selectedDate).toLocaleDateString('hu-HU', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      weekday: 'long',
                    })}
                  </div>
                </div>

                {services.length > 0 && (
                  <div className="bg-white rounded-xl p-4 shadow-sm">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Szolgáltatás
                    </label>
                    <div className="space-y-2">
                      {services.map((service) => (
                        <button
                          key={service.id}
                          onClick={() => setSelectedService(service)}
                          className={`w-full p-3 border rounded-lg text-left transition-colors ${
                            selectedService?.id === service.id
                              ? 'border-primary-500 bg-primary-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="font-medium text-gray-900">{service.name}</div>
                          <div className="flex justify-between text-sm text-gray-500">
                            <span>{service.durationMinutes} perc</span>
                            <span className="font-medium text-gray-900">
                              {new Intl.NumberFormat('hu-HU', {
                                style: 'currency',
                                currency: service.currency,
                                minimumFractionDigits: 0,
                              }).format(service.price)}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {slots.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    Nincs szabad időpont ezen a napon
                  </div>
                ) : (
                  <div className="bg-white rounded-xl p-4 shadow-sm">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Szabad időpontok
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {slots.filter(s => s.available).map((slot, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSelectedSlot(slot)}
                          className={`p-3 border rounded-lg text-center transition-colors ${
                            selectedSlot?.startTime === slot.startTime
                              ? 'border-primary-500 bg-primary-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="font-medium text-gray-900">
                            {formatSlotTime(slot.startTime)}
                          </div>
                          {slot.remainingSlots <= 2 && (
                            <div className="text-xs text-orange-600">
                              Csak {slot.remainingSlots} hely
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => setStep('confirm')}
                  disabled={!selectedSlot || !selectedService}
                  className="w-full bg-primary-600 text-white rounded-xl p-4 font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-primary-700 transition-colors"
                >
                  Tovább
                </button>
              </div>
            )}

            {/* Step: Confirm booking */}
            {step === 'confirm' && selectedLocation && selectedSlot && selectedService && (
              <div className="space-y-4">
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <h3 className="font-semibold text-gray-900 mb-4">Foglalás összegzése</h3>

                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Helyszín</span>
                      <span className="font-medium text-gray-900">{selectedLocation.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Dátum</span>
                      <span className="font-medium text-gray-900">
                        {new Date(selectedDate).toLocaleDateString('hu-HU', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Időpont</span>
                      <span className="font-medium text-gray-900">
                        {formatSlotTime(selectedSlot.startTime)} - {formatSlotTime(selectedSlot.endTime)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Szolgáltatás</span>
                      <span className="font-medium text-gray-900">{selectedService.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Időtartam</span>
                      <span className="font-medium text-gray-900">{selectedService.durationMinutes} perc</span>
                    </div>
                    <div className="border-t border-gray-200 pt-3 flex justify-between">
                      <span className="font-semibold text-gray-900">Ár</span>
                      <span className="font-bold text-primary-600 text-lg">
                        {new Intl.NumberFormat('hu-HU', {
                          style: 'currency',
                          currency: selectedService.currency,
                          minimumFractionDigits: 0,
                        }).format(selectedService.price)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rendszám
                  </label>
                  <input
                    type="text"
                    value={plateNumber}
                    onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                    placeholder="ABC-123"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 uppercase"
                  />
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={submitting || !plateNumber}
                  className="w-full bg-primary-600 text-white rounded-xl p-4 font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-primary-700 transition-colors"
                >
                  {submitting ? 'Foglalás...' : 'Foglalás véglegesítése'}
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Bottom Safe Area */}
      <div className="safe-area-bottom" />

      {/* Émi Chat Widget */}
      <DriverEmiWrapper />
    </div>
  );
}
