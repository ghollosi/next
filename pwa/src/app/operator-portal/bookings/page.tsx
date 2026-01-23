'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { SessionTimeoutWarning } from '@/components/SessionTimeoutWarning';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.vemiax.com';

interface Booking {
  id: string;
  bookingCode: string;
  scheduledStart: string;
  scheduledEnd: string;
  vehicleType: string;
  plateNumber?: string;
  serviceDurationMinutes: number;
  servicePrice: number;
  currency: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  status: string;
  paymentStatus: string;
  servicePackage?: {
    id: string;
    name: string;
    code: string;
  };
  createdAt: string;
}

interface BlockedSlot {
  id: string;
  startTime: string;
  endTime: string;
  reason?: string;
  isRecurring: boolean;
  recurringDayOfWeek?: string;
  recurringStartTime?: string;
  recurringEndTime?: string;
}

interface TimeSlot {
  startTime: string;
  endTime: string;
  available: boolean;
}

interface ServicePackage {
  id: string;
  name: string;
  code: string;
  durationMinutes: number;
  price: number;
  currency: string;
}

interface OpeningHour {
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

interface OperatorInfo {
  locationId: string;
  locationName: string;
  locationCode: string;
  washMode: string;
  networkName: string;
  openingHours?: Record<string, OpeningHour>;
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
  PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  CONFIRMED: 'bg-blue-100 text-blue-800 border-blue-300',
  IN_PROGRESS: 'bg-purple-100 text-purple-800 border-purple-300',
  COMPLETED: 'bg-green-100 text-green-800 border-green-300',
  CANCELLED: 'bg-gray-100 text-gray-800 border-gray-300',
  NO_SHOW: 'bg-red-100 text-red-800 border-red-300',
};

const dayLabels: Record<string, string> = {
  MONDAY: 'Hétfő',
  TUESDAY: 'Kedd',
  WEDNESDAY: 'Szerda',
  THURSDAY: 'Csütörtök',
  FRIDAY: 'Péntek',
  SATURDAY: 'Szombat',
  SUNDAY: 'Vasárnap',
};

const vehicleTypes = [
  { value: 'CAR', label: 'Személyautó' },
  { value: 'VAN', label: 'Kisteherautó' },
  { value: 'BUS', label: 'Busz' },
  { value: 'SEMI_TRUCK', label: 'Kamion' },
  { value: 'TRUCK_12T', label: 'Kamion 12t' },
  { value: 'TRAILER', label: 'Pótkocsi' },
];

// Napok nevei a JS getDay() függvényhez (0 = vasárnap)
const dayOfWeekNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

// Helper: nyitvatartási órák kinyerése adott napra
function getOpeningHoursForDate(
  date: string,
  openingHours?: Record<string, { openTime: string; closeTime: string; isClosed: boolean }>
): { startHour: number; endHour: number; isClosed: boolean } {
  // Ha nincs nyitvatartási adat beállítva, használjuk az alapértelmezést (nem zárva!)
  if (!openingHours || Object.keys(openingHours).length === 0) {
    return { startHour: 6, endHour: 20, isClosed: false }; // Alapértelmezett
  }

  const dayOfWeek = new Date(date).getDay();
  const dayName = dayOfWeekNames[dayOfWeek];
  const hours = openingHours[dayName];

  // Ha nincs adat az adott napra, de más napokra van, használjuk az alapértelmezést
  if (!hours) {
    return { startHour: 6, endHour: 20, isClosed: false };
  }

  // Ha explicit zárva van beállítva
  if (hours.isClosed) {
    return { startHour: 6, endHour: 20, isClosed: true };
  }

  const [openH] = hours.openTime.split(':').map(Number);
  const [closeH] = hours.closeTime.split(':').map(Number);

  return { startHour: openH, endHour: closeH, isClosed: false };
}

export default function OperatorBookingsPage() {
  const router = useRouter();
  const [operatorInfo, setOperatorInfo] = useState<OperatorInfo | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [todaysBookings, setTodaysBookings] = useState<Booking[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [view, setView] = useState<'today' | 'calendar' | 'blocked' | 'new'>('today');
  const [calendarMode, setCalendarMode] = useState<'day' | 'week'>('day');
  const [weekBookings, setWeekBookings] = useState<Booking[]>([]);

  // Új foglalás form
  const [newBookingStep, setNewBookingStep] = useState<'customer' | 'service' | 'time' | 'confirm'>('customer');
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [services, setServices] = useState<ServicePackage[]>([]);
  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    vehicleType: 'CAR',
    plateNumber: '',
    servicePackageIds: [] as string[], // Több szolgáltatás támogatása
    scheduledStart: '',
    notes: '',
  });

  // Blokkolt időszak form
  const [blockForm, setBlockForm] = useState({
    startTime: '',
    endTime: '',
    reason: '',
    isRecurring: false,
    dayOfWeek: 1,
    recurringStartTime: '08:00',
    recurringEndTime: '12:00',
  });

  const handleLogout = () => {
    localStorage.removeItem('operator_session');
    localStorage.removeItem('operator_info');
    router.replace('/operator-portal/login');
  };

  const { showWarning, timeRemaining, dismissWarning } = useSessionTimeout({
    onTimeout: handleLogout,
    enabled: !!operatorInfo,
  });

  const getSession = () => localStorage.getItem('operator_session');

  const loadTodaysBookings = useCallback(async (session?: string) => {
    const sessionId = session || getSession();
    if (!sessionId) return;

    try {
      const response = await fetch(`${API_URL}/operator-portal/bookings/today`, {
        headers: { 'x-operator-session': sessionId },
      });

      if (!response.ok) {
        if (response.status === 401) {
          handleLogout();
          return;
        }
        throw new Error('Adatok betöltése sikertelen');
      }

      const data = await response.json();
      setTodaysBookings(data.data || []);
    } catch (err) {
      console.error('Error loading today\'s bookings:', err);
    }
  }, []);

  const loadBookings = useCallback(async (date: string, session?: string) => {
    const sessionId = session || getSession();
    if (!sessionId) return;

    try {
      setLoading(true);
      const response = await fetch(
        `${API_URL}/operator-portal/bookings?dateFrom=${date}&dateTo=${date}`,
        { headers: { 'x-operator-session': sessionId } }
      );

      if (!response.ok) throw new Error('Adatok betöltése sikertelen');

      const data = await response.json();
      setBookings(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba történt');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadWeekBookings = useCallback(async (startDate: string, session?: string) => {
    const sessionId = session || getSession();
    if (!sessionId) return;

    try {
      setLoading(true);
      const start = new Date(startDate);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      const endDateStr = end.toISOString().split('T')[0];

      const response = await fetch(
        `${API_URL}/operator-portal/bookings?dateFrom=${startDate}&dateTo=${endDateStr}`,
        { headers: { 'x-operator-session': sessionId } }
      );

      if (!response.ok) throw new Error('Adatok betöltése sikertelen');

      const data = await response.json();
      setWeekBookings(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba történt');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBlockedSlots = useCallback(async () => {
    const sessionId = getSession();
    if (!sessionId) return;

    try {
      const response = await fetch(`${API_URL}/operator-portal/blocked-slots`, {
        headers: { 'x-operator-session': sessionId },
      });

      if (!response.ok) throw new Error('Blokkolt időszakok betöltése sikertelen');

      const data = await response.json();
      setBlockedSlots(data || []);
    } catch (err) {
      console.error('Error loading blocked slots:', err);
    }
  }, []);

  const loadAvailableSlots = useCallback(async (date: string, vehicleType: string) => {
    const sessionId = getSession();
    if (!sessionId) return;

    try {
      setLoading(true);
      const response = await fetch(
        `${API_URL}/operator-portal/available-slots?date=${date}&vehicleType=${vehicleType}`,
        { headers: { 'x-operator-session': sessionId } }
      );

      if (!response.ok) throw new Error('Időpontok betöltése sikertelen');

      const data = await response.json();
      setAvailableSlots(data.slots || []);
      setServices(data.services || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba történt');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const session = getSession();
    const info = localStorage.getItem('operator_info');

    if (!session || !info) {
      router.replace('/operator-portal/login');
      return;
    }

    // Betöltjük a profilt a szerverre friss nyitvatartási adatokért
    const loadProfile = async () => {
      try {
        const response = await fetch(`${API_URL}/operator-portal/profile`, {
          headers: { 'x-operator-session': session },
        });
        if (response.ok) {
          const profile = await response.json();
          setOperatorInfo(profile);
          // Mentjük a localStorage-ba is a friss adatokat
          localStorage.setItem('operator_info', JSON.stringify(profile));
        } else {
          // Ha nem sikerül, használjuk a localStorage-ban lévőt
          setOperatorInfo(JSON.parse(info));
        }
      } catch {
        setOperatorInfo(JSON.parse(info));
      }
    };

    loadProfile();
    loadTodaysBookings(session);
    loadBlockedSlots();

    const interval = setInterval(() => loadTodaysBookings(session), 30000);
    return () => clearInterval(interval);
  }, [router, loadTodaysBookings, loadBlockedSlots]);

  useEffect(() => {
    if (view === 'calendar') {
      if (calendarMode === 'day') {
        loadBookings(selectedDate);
      } else {
        // Heti nézetnél a hét első napjától kezdve
        const date = new Date(selectedDate);
        const day = date.getDay();
        const diff = day === 0 ? -6 : 1 - day; // Hétfőtől kezdődik
        date.setDate(date.getDate() + diff);
        loadWeekBookings(date.toISOString().split('T')[0]);
      }
    }
  }, [view, selectedDate, calendarMode, loadBookings, loadWeekBookings]);

  const handleAction = async (bookingId: string, action: string, reason?: string) => {
    const sessionId = getSession();
    if (!sessionId) return;

    setActionLoading(bookingId);

    try {
      const options: RequestInit = {
        method: 'POST',
        headers: {
          'x-operator-session': sessionId,
          'Content-Type': 'application/json',
        },
      };

      if (action === 'cancel' && reason) {
        options.body = JSON.stringify({ reason });
      }

      const response = await fetch(`${API_URL}/operator-portal/bookings/${bookingId}/${action}`, options);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Művelet sikertelen');
      }

      await loadTodaysBookings();
      if (view === 'calendar') {
        await loadBookings(selectedDate);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba történt');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateBooking = async () => {
    const sessionId = getSession();
    if (!sessionId) return;

    setActionLoading('new');

    try {
      // Backend jelenleg csak egy szolgáltatást támogat, az elsőt küldjük
      const bookingPayload = {
        ...formData,
        servicePackageId: formData.servicePackageIds[0],
      };

      const response = await fetch(`${API_URL}/operator-portal/bookings/create`, {
        method: 'POST',
        headers: {
          'x-operator-session': sessionId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bookingPayload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Foglalás létrehozása sikertelen');
      }

      // Reset form
      setFormData({
        customerName: '',
        customerPhone: '',
        customerEmail: '',
        vehicleType: 'TRUCK',
        plateNumber: '',
        servicePackageIds: [],
        scheduledStart: '',
        notes: '',
      });
      setNewBookingStep('customer');
      setView('today');
      await loadTodaysBookings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba történt');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateBlockedSlot = async () => {
    const sessionId = getSession();
    if (!sessionId) return;

    setActionLoading('block');

    try {
      const endpoint = blockForm.isRecurring
        ? `${API_URL}/operator-portal/blocked-slots/recurring`
        : `${API_URL}/operator-portal/blocked-slots`;

      const body = blockForm.isRecurring
        ? {
            dayOfWeek: blockForm.dayOfWeek,
            startTime: blockForm.recurringStartTime,
            endTime: blockForm.recurringEndTime,
            reason: blockForm.reason || 'Walk-in ügyfeleknek fenntartva',
          }
        : {
            startTime: blockForm.startTime,
            endTime: blockForm.endTime,
            reason: blockForm.reason || 'Walk-in ügyfeleknek fenntartva',
          };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'x-operator-session': sessionId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Blokkolt időszak létrehozása sikertelen');
      }

      setBlockForm({
        startTime: '',
        endTime: '',
        reason: '',
        isRecurring: false,
        dayOfWeek: 1,
        recurringStartTime: '08:00',
        recurringEndTime: '12:00',
      });
      await loadBlockedSlots();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba történt');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteBlockedSlot = async (id: string) => {
    if (!confirm('Biztosan törölni szeretné ezt a blokkolt időszakot?')) return;

    const sessionId = getSession();
    if (!sessionId) return;

    try {
      const response = await fetch(`${API_URL}/operator-portal/blocked-slots/${id}`, {
        method: 'DELETE',
        headers: { 'x-operator-session': sessionId },
      });

      if (!response.ok) throw new Error('Törlés sikertelen');

      await loadBlockedSlots();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba történt');
    }
  };

  function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('hu-HU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    });
  }

  function formatPrice(price: number, currency: string) {
    return new Intl.NumberFormat('hu-HU', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
    }).format(price);
  }

  function getTimeUntil(dateStr: string) {
    const now = new Date();
    const target = new Date(dateStr);
    const diffMs = target.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 0) {
      const absMins = Math.abs(diffMins);
      if (absMins < 60) return `${absMins} perce volt`;
      return `${Math.floor(absMins / 60)} órája volt`;
    }
    if (diffMins < 60) return `${diffMins} perc múlva`;
    return `${Math.floor(diffMins / 60)} óra múlva`;
  }

  function getBookingActions(booking: Booking) {
    const actions: { label: string; action: () => void; style: string }[] = [];

    switch (booking.status) {
      case 'PENDING':
        actions.push({
          label: 'Megerősítés',
          action: () => handleAction(booking.id, 'confirm'),
          style: 'bg-blue-600 text-white hover:bg-blue-700',
        });
        actions.push({
          label: 'Lemondás',
          action: () => {
            const reason = prompt('Lemondás oka:');
            if (reason) handleAction(booking.id, 'cancel', reason);
          },
          style: 'bg-red-100 text-red-600 hover:bg-red-200',
        });
        break;
      case 'CONFIRMED':
        actions.push({
          label: 'Indítás',
          action: () => handleAction(booking.id, 'start'),
          style: 'bg-green-600 text-white hover:bg-green-700',
        });
        actions.push({
          label: 'Nem jelent meg',
          action: () => handleAction(booking.id, 'no-show'),
          style: 'bg-orange-100 text-orange-600 hover:bg-orange-200',
        });
        break;
      case 'IN_PROGRESS':
        actions.push({
          label: 'Befejezés',
          action: () => handleAction(booking.id, 'complete'),
          style: 'bg-green-600 text-white hover:bg-green-700',
        });
        break;
    }

    return actions;
  }

  if (!operatorInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Betöltés...</div>
      </div>
    );
  }

  const now = new Date();
  const upcomingBookings = todaysBookings.filter(b =>
    new Date(b.scheduledStart) > now && !['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(b.status)
  );
  const activeBookings = todaysBookings.filter(b =>
    b.status === 'IN_PROGRESS' || (b.status === 'CONFIRMED' && new Date(b.scheduledStart) <= now)
  );
  const pastBookings = todaysBookings.filter(b =>
    ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(b.status)
  );

  const selectedServices = services.filter(s => formData.servicePackageIds.includes(s.id));
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.durationMinutes, 0);
  const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);
  const firstService = selectedServices[0]; // For currency

  return (
    <div className="min-h-screen bg-gray-50">
      <SessionTimeoutWarning
        show={showWarning}
        timeRemaining={timeRemaining}
        onExtend={dismissWarning}
        onLogout={handleLogout}
      />

      {/* Header */}
      <header className="bg-green-600 text-white px-4 py-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/operator-portal/dashboard')}
              className="p-2 hover:bg-green-700 rounded-lg transition-colors"
              title="Vissza a főoldalra"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-bold">{operatorInfo.locationName}</h1>
              <p className="text-green-200 text-sm">{operatorInfo.locationCode} - Foglalások</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/operator-portal/dashboard')}
              className="px-4 py-2 bg-green-700 hover:bg-green-800 rounded-lg text-sm transition-colors"
            >
              Mosások
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-green-700 hover:bg-green-800 rounded-lg text-sm transition-colors"
            >
              Kijelentkezés
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* View Toggle */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setView('today')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              view === 'today' ? 'bg-green-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            Mai foglalások
          </button>
          <button
            onClick={() => setView('calendar')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              view === 'calendar' ? 'bg-green-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            Naptár
          </button>
          <button
            onClick={() => setView('blocked')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              view === 'blocked' ? 'bg-green-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            Walk-in időszakok
          </button>
          <button
            onClick={() => {
              setView('new');
              setNewBookingStep('customer');
            }}
            className="px-4 py-2 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Új foglalás
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-600">
            {error}
            <button onClick={() => setError('')} className="ml-4 underline">Bezárás</button>
          </div>
        )}

        {/* Today View */}
        {view === 'today' && (
          <>
            {activeBookings.length > 0 && (
              <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4 mb-6">
                <h2 className="text-lg font-semibold text-purple-800 mb-4 flex items-center gap-2">
                  <span className="w-3 h-3 bg-purple-500 rounded-full animate-pulse"></span>
                  Aktív foglalások
                </h2>
                <div className="space-y-3">
                  {activeBookings.map((booking) => (
                    <div key={booking.id} className="bg-white rounded-lg p-4 shadow-sm">
                      <div className="flex flex-wrap gap-4 items-center justify-between">
                        <div className="flex-1 min-w-[200px]">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-lg font-bold">{booking.bookingCode}</span>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${statusColors[booking.status]}`}>
                              {statusLabels[booking.status]}
                            </span>
                          </div>
                          <div className="text-sm text-gray-600">
                            {formatTime(booking.scheduledStart)} - {formatTime(booking.scheduledEnd)}
                          </div>
                          <div className="text-sm font-medium mt-1">
                            {booking.customerName || 'Névtelen'} - {booking.plateNumber || '-'}
                          </div>
                          <div className="text-sm text-gray-500">{booking.servicePackage?.name}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold">{formatPrice(booking.servicePrice, booking.currency)}</div>
                        </div>
                        <div className="flex gap-2">
                          {getBookingActions(booking).map((action, idx) => (
                            <button
                              key={idx}
                              onClick={action.action}
                              disabled={actionLoading === booking.id}
                              className={`px-4 py-2 rounded-lg font-medium disabled:opacity-50 ${action.style}`}
                            >
                              {actionLoading === booking.id ? '...' : action.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {upcomingBookings.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                <h2 className="text-lg font-semibold text-blue-800 mb-4">Közelgő ({upcomingBookings.length})</h2>
                <div className="space-y-3">
                  {upcomingBookings.map((booking) => (
                    <div key={booking.id} className="bg-white rounded-lg p-4 shadow-sm">
                      <div className="flex flex-wrap gap-4 items-center justify-between">
                        <div className="flex-1 min-w-[200px]">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono font-bold">{booking.bookingCode}</span>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${statusColors[booking.status]}`}>
                              {statusLabels[booking.status]}
                            </span>
                            <span className="text-sm text-gray-500">- {getTimeUntil(booking.scheduledStart)}</span>
                          </div>
                          <div className="text-sm text-gray-600">
                            {formatTime(booking.scheduledStart)} - {formatTime(booking.scheduledEnd)}
                          </div>
                          <div className="text-sm font-medium mt-1">
                            {booking.customerName || 'Névtelen'} - {booking.plateNumber || '-'}
                          </div>
                        </div>
                        <div className="font-bold">{formatPrice(booking.servicePrice, booking.currency)}</div>
                        <div className="flex gap-2">
                          {getBookingActions(booking).map((action, idx) => (
                            <button
                              key={idx}
                              onClick={action.action}
                              disabled={actionLoading === booking.id}
                              className={`px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 ${action.style}`}
                            >
                              {actionLoading === booking.id ? '...' : action.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pastBookings.length > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6">
                <h2 className="text-lg font-semibold text-gray-700 mb-4">Korábbi ({pastBookings.length})</h2>
                <div className="space-y-2">
                  {pastBookings.map((booking) => (
                    <div key={booking.id} className="bg-white rounded-lg p-3 shadow-sm flex flex-wrap gap-4 items-center justify-between">
                      <span className="font-mono text-sm text-gray-600">{booking.bookingCode}</span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${statusColors[booking.status]}`}>
                        {statusLabels[booking.status]}
                      </span>
                      <span className="text-sm text-gray-600">{formatTime(booking.scheduledStart)} - {booking.customerName || 'Névtelen'}</span>
                      <span className="text-sm font-medium">{formatPrice(booking.servicePrice, booking.currency)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {todaysBookings.length === 0 && (
              <div className="bg-white rounded-xl shadow-sm p-8 text-center">
                <svg className="w-16 h-16 mx-auto text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <div className="text-lg text-gray-600 font-medium">Nincs mai foglalás</div>
              </div>
            )}
          </>
        )}

        {/* Calendar View */}
        {view === 'calendar' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            {/* Calendar Controls */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCalendarMode('day')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    calendarMode === 'day' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Napi
                </button>
                <button
                  onClick={() => setCalendarMode('week')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    calendarMode === 'week' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Heti
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const date = new Date(selectedDate);
                    date.setDate(date.getDate() - (calendarMode === 'week' ? 7 : 1));
                    setSelectedDate(date.toISOString().split('T')[0]);
                  }}
                  className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  &larr;
                </button>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-center font-medium"
                />
                <button
                  onClick={() => {
                    const date = new Date(selectedDate);
                    date.setDate(date.getDate() + (calendarMode === 'week' ? 7 : 1));
                    setSelectedDate(date.toISOString().split('T')[0]);
                  }}
                  className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  &rarr;
                </button>
                <button
                  onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                  className="px-3 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 text-sm font-medium"
                >
                  Ma
                </button>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-8 text-gray-500">Betöltés...</div>
            ) : calendarMode === 'day' ? (
              /* Napi nézet - időrács */
              (() => {
                const { startHour, endHour, isClosed } = getOpeningHoursForDate(selectedDate, operatorInfo?.openingHours);
                const hourCount = endHour - startHour;
                const gridHeight = Math.max(hourCount * 40, 200);

                if (isClosed) {
                  return (
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                        <div className="font-semibold text-center">{formatDate(selectedDate)}</div>
                      </div>
                      <div className="p-8 text-center text-gray-500">
                        <div className="text-4xl mb-2">🚫</div>
                        <div className="font-medium">Ezen a napon zárva</div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                      <div className="font-semibold text-center">
                        {formatDate(selectedDate)}
                        <span className="ml-2 text-sm font-normal text-gray-500">
                          ({startHour.toString().padStart(2, '0')}:00 - {endHour.toString().padStart(2, '0')}:00)
                        </span>
                      </div>
                    </div>
                    <div className="relative" style={{ minHeight: `${gridHeight}px` }}>
                      {/* Óra vonalak */}
                      {Array.from({ length: hourCount + 1 }, (_, i) => i + startHour).map((hour) => (
                        <div
                          key={hour}
                          className="absolute left-0 right-0 border-t border-gray-100"
                          style={{ top: `${(hour - startHour) * 40}px` }}
                        >
                          <span className="absolute -top-2.5 left-2 text-xs text-gray-400 bg-white px-1">
                            {hour.toString().padStart(2, '0')}:00
                          </span>
                        </div>
                      ))}

                      {/* Blokkolt időszakok */}
                      {blockedSlots.map((slot) => {
                        const slotDate = slot.isRecurring
                          ? selectedDate
                          : new Date(slot.startTime).toISOString().split('T')[0];
                        if (!slot.isRecurring && slotDate !== selectedDate) return null;
                        if (slot.isRecurring) {
                          const dayOfWeek = new Date(selectedDate).getDay();
                          const slotDayNum = dayOfWeekNames.indexOf(slot.recurringDayOfWeek || '');
                          if (slotDayNum !== dayOfWeek) return null;
                        }

                        const slotStartTime = slot.isRecurring
                          ? slot.recurringStartTime || '00:00'
                          : formatTime(slot.startTime);
                        const slotEndTime = slot.isRecurring
                          ? slot.recurringEndTime || '00:00'
                          : formatTime(slot.endTime);

                        const [sH, sM] = slotStartTime.split(':').map(Number);
                        const [eH, eM] = slotEndTime.split(':').map(Number);
                        const top = ((sH - startHour) * 60 + sM) * (40 / 60);
                        const height = ((eH * 60 + eM) - (sH * 60 + sM)) * (40 / 60);

                        return (
                          <div
                            key={slot.id}
                            className="absolute left-16 right-4 bg-orange-100 border-l-4 border-orange-500 rounded-r px-2 py-1 overflow-hidden"
                            style={{ top: `${top}px`, height: `${Math.max(height, 20)}px` }}
                          >
                            <div className="text-xs font-medium text-orange-700 truncate">
                              Walk-in: {slotStartTime} - {slotEndTime}
                            </div>
                            {slot.reason && height > 30 && (
                              <div className="text-xs text-orange-600 truncate">{slot.reason}</div>
                            )}
                          </div>
                        );
                      })}

                      {/* Foglalások */}
                      {bookings.map((booking) => {
                        const bStart = new Date(booking.scheduledStart);
                        const bEnd = new Date(booking.scheduledEnd);
                        const bStartH = bStart.getHours();
                        const bStartM = bStart.getMinutes();
                        const bEndH = bEnd.getHours();
                        const bEndM = bEnd.getMinutes();

                        const top = ((bStartH - startHour) * 60 + bStartM) * (40 / 60);
                        const height = ((bEndH * 60 + bEndM) - (bStartH * 60 + bStartM)) * (40 / 60);

                        const bgColor = booking.status === 'COMPLETED' ? 'bg-green-100 border-green-500' :
                                       booking.status === 'IN_PROGRESS' ? 'bg-purple-100 border-purple-500' :
                                       booking.status === 'CONFIRMED' ? 'bg-blue-100 border-blue-500' :
                                       booking.status === 'CANCELLED' ? 'bg-gray-100 border-gray-400' :
                                       booking.status === 'NO_SHOW' ? 'bg-red-100 border-red-500' :
                                       'bg-yellow-100 border-yellow-500';

                        return (
                          <div
                            key={booking.id}
                            className={`absolute left-16 right-4 ${bgColor} border-l-4 rounded-r px-2 py-1 cursor-pointer hover:shadow-md transition-shadow overflow-hidden`}
                            style={{ top: `${top}px`, height: `${Math.max(height, 30)}px` }}
                            onClick={() => {
                              const actions = getBookingActions(booking);
                              if (actions.length > 0) {
                                const actionStr = actions.map(a => a.label).join(' / ');
                                if (confirm(`${booking.customerName || 'Névtelen'}\n${formatTime(booking.scheduledStart)} - ${formatTime(booking.scheduledEnd)}\n\nMűveletek: ${actionStr}`)) {
                                  actions[0].action();
                                }
                              }
                            }}
                          >
                            <div className="text-xs font-semibold truncate">
                              {formatTime(booking.scheduledStart)} {booking.customerName || 'Névtelen'}
                            </div>
                            {height > 40 && (
                              <div className="text-xs text-gray-600 truncate">
                                {booking.servicePackage?.name} - {booking.plateNumber || '-'}
                              </div>
                            )}
                            {height > 60 && (
                              <div className="text-xs font-medium">
                                {formatPrice(booking.servicePrice, booking.currency)}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {bookings.length === 0 && blockedSlots.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                          Nincs foglalás ezen a napon
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()
            ) : (
              /* Heti nézet */
              (() => {
                // Kiszámoljuk a hét első napját
                const weekStartDate = new Date(selectedDate);
                const dayOfWeek = weekStartDate.getDay();
                const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
                weekStartDate.setDate(weekStartDate.getDate() + diffToMonday);

                // Lekérjük minden nap nyitvatartását és meghatározzuk a legkorábbi/legkésőbbi órát
                const weekDays = Array.from({ length: 7 }, (_, i) => {
                  const d = new Date(weekStartDate);
                  d.setDate(d.getDate() + i);
                  const dateStr = d.toISOString().split('T')[0];
                  return {
                    date: d,
                    dateStr,
                    ...getOpeningHoursForDate(dateStr, operatorInfo?.openingHours),
                  };
                });

                const openDays = weekDays.filter(d => !d.isClosed);
                const weekMinHour = openDays.length > 0 ? Math.min(...openDays.map(d => d.startHour)) : 6;
                const weekMaxHour = openDays.length > 0 ? Math.max(...openDays.map(d => d.endHour)) : 20;
                const weekHourCount = weekMaxHour - weekMinHour;
                const weekGridHeight = Math.max(weekHourCount * 40, 200);

                return (
                  <div className="border border-gray-200 rounded-lg overflow-x-auto">
                    <div className="min-w-[800px]">
                      {/* Napok fejléc */}
                      <div className="grid grid-cols-8 bg-gray-50 border-b border-gray-200">
                        <div className="p-2 text-xs font-medium text-gray-500 border-r border-gray-200"></div>
                        {weekDays.map((dayInfo, i) => {
                          const isToday = dayInfo.dateStr === new Date().toISOString().split('T')[0];
                          const dayNames = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'];
                          return (
                            <div
                              key={i}
                              className={`p-2 text-center border-r border-gray-200 last:border-r-0 ${isToday ? 'bg-green-50' : ''} ${dayInfo.isClosed ? 'bg-gray-100' : ''}`}
                            >
                              <div className="text-xs text-gray-500">{dayNames[i]}</div>
                              <div className={`text-sm font-semibold ${isToday ? 'text-green-600' : ''} ${dayInfo.isClosed ? 'text-gray-400' : ''}`}>
                                {dayInfo.date.getDate()}
                              </div>
                              {dayInfo.isClosed && <div className="text-[10px] text-gray-400">Zárva</div>}
                            </div>
                          );
                        })}
                      </div>

                      {/* Óra sorok */}
                      <div className="relative" style={{ minHeight: `${weekGridHeight}px` }}>
                        {Array.from({ length: weekHourCount }, (_, i) => i + weekMinHour).map((hour) => (
                          <div key={hour} className="grid grid-cols-8 border-b border-gray-100" style={{ height: '40px' }}>
                            <div className="p-1 text-xs text-gray-400 border-r border-gray-200 flex items-start">
                              {hour.toString().padStart(2, '0')}:00
                            </div>
                            {weekDays.map((dayInfo, dayIdx) => {
                              const isToday = dayInfo.dateStr === new Date().toISOString().split('T')[0];
                              const isOutsideHours = dayInfo.isClosed || hour < dayInfo.startHour || hour >= dayInfo.endHour;

                              // Foglalások ebben a cellában
                              const cellBookings = weekBookings.filter((b) => {
                                const bDate = new Date(b.scheduledStart);
                                const bDateStr = bDate.toISOString().split('T')[0];
                                const bHour = bDate.getHours();
                                return bDateStr === dayInfo.dateStr && bHour === hour;
                              });

                              // Blokkolt időszakok ebben a cellában
                              const cellBlocked = blockedSlots.filter((slot) => {
                                if (slot.isRecurring) {
                                  const slotDayNum = dayOfWeekNames.indexOf(slot.recurringDayOfWeek || '');
                                  if (slotDayNum !== dayInfo.date.getDay()) return false;
                                  const [sH] = (slot.recurringStartTime || '00:00').split(':').map(Number);
                                  return sH === hour;
                                } else {
                                  const slotDate = new Date(slot.startTime);
                                  return slotDate.toISOString().split('T')[0] === dayInfo.dateStr && slotDate.getHours() === hour;
                                }
                              });

                              return (
                                <div
                                  key={dayIdx}
                                  className={`border-r border-gray-200 last:border-r-0 relative ${isToday ? 'bg-green-50/30' : ''} ${isOutsideHours ? 'bg-gray-50' : ''}`}
                                >
                                  {!isOutsideHours && cellBlocked.map((slot) => (
                                    <div
                                      key={slot.id}
                                      className="absolute inset-1 bg-orange-100 border border-orange-300 rounded text-xs p-0.5 overflow-hidden"
                                    >
                                      <span className="text-orange-700 font-medium">W</span>
                                    </div>
                                  ))}
                                  {!isOutsideHours && cellBookings.map((booking) => {
                                    const bgColor = booking.status === 'COMPLETED' ? 'bg-green-200 border-green-400' :
                                                   booking.status === 'IN_PROGRESS' ? 'bg-purple-200 border-purple-400' :
                                                   booking.status === 'CONFIRMED' ? 'bg-blue-200 border-blue-400' :
                                                   booking.status === 'CANCELLED' ? 'bg-gray-200 border-gray-400' :
                                                   'bg-yellow-200 border-yellow-400';
                                    return (
                                      <div
                                        key={booking.id}
                                        className={`absolute inset-1 ${bgColor} border rounded text-xs p-0.5 overflow-hidden cursor-pointer hover:shadow`}
                                        title={`${booking.customerName || 'Névtelen'} - ${formatTime(booking.scheduledStart)}`}
                                        onClick={() => {
                                          setSelectedDate(dayInfo.dateStr);
                                          setCalendarMode('day');
                                        }}
                                      >
                                        <div className="font-medium truncate">{formatTime(booking.scheduledStart)}</div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()
            )}

            {/* Jelmagyarázat */}
            <div className="mt-4 flex flex-wrap gap-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 bg-yellow-200 border-l-2 border-yellow-500 rounded-r"></div>
                <span>Függőben</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 bg-blue-200 border-l-2 border-blue-500 rounded-r"></div>
                <span>Megerősítve</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 bg-purple-200 border-l-2 border-purple-500 rounded-r"></div>
                <span>Folyamatban</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 bg-green-200 border-l-2 border-green-500 rounded-r"></div>
                <span>Befejezve</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 bg-orange-200 border-l-2 border-orange-500 rounded-r"></div>
                <span>Walk-in</span>
              </div>
            </div>
          </div>
        )}

        {/* Blocked Slots View */}
        {view === 'blocked' && (
          <div className="space-y-6">
            {/* Create new blocked slot */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4">Új walk-in időszak létrehozása</h3>
              <p className="text-sm text-gray-500 mb-4">
                Ezek az időszakok nem lesznek foglalhatók online - walk-in ügyfeleknek tartja fenn.
              </p>

              <div className="space-y-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={blockForm.isRecurring}
                    onChange={(e) => setBlockForm({ ...blockForm, isRecurring: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span>Ismétlődő (hetente)</span>
                </label>

                {blockForm.isRecurring ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nap</label>
                      <select
                        value={blockForm.dayOfWeek}
                        onChange={(e) => setBlockForm({ ...blockForm, dayOfWeek: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        <option value={1}>Hétfő</option>
                        <option value={2}>Kedd</option>
                        <option value={3}>Szerda</option>
                        <option value={4}>Csütörtök</option>
                        <option value={5}>Péntek</option>
                        <option value={6}>Szombat</option>
                        <option value={0}>Vasárnap</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Kezdés</label>
                        <input
                          type="time"
                          value={blockForm.recurringStartTime}
                          onChange={(e) => setBlockForm({ ...blockForm, recurringStartTime: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Vége</label>
                        <input
                          type="time"
                          value={blockForm.recurringEndTime}
                          onChange={(e) => setBlockForm({ ...blockForm, recurringEndTime: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Kezdés</label>
                      <input
                        type="datetime-local"
                        value={blockForm.startTime}
                        onChange={(e) => setBlockForm({ ...blockForm, startTime: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Vége</label>
                      <input
                        type="datetime-local"
                        value={blockForm.endTime}
                        onChange={(e) => setBlockForm({ ...blockForm, endTime: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Megjegyzés (opcionális)</label>
                  <input
                    type="text"
                    value={blockForm.reason}
                    onChange={(e) => setBlockForm({ ...blockForm, reason: e.target.value })}
                    placeholder="pl. Walk-in ügyfeleknek"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <button
                  onClick={handleCreateBlockedSlot}
                  disabled={actionLoading === 'block'}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                >
                  {actionLoading === 'block' ? 'Mentés...' : 'Létrehozás'}
                </button>
              </div>
            </div>

            {/* Existing blocked slots */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4">Meglévő walk-in időszakok</h3>

              {blockedSlots.length === 0 ? (
                <div className="text-gray-500 text-center py-4">Nincs beállított walk-in időszak</div>
              ) : (
                <div className="space-y-3">
                  {blockedSlots.map((slot) => (
                    <div key={slot.id} className="flex items-center justify-between p-3 border border-orange-200 bg-orange-50 rounded-lg">
                      <div>
                        {slot.isRecurring ? (
                          <div className="font-medium">
                            Minden {dayLabels[slot.recurringDayOfWeek || ''] || slot.recurringDayOfWeek}, {slot.recurringStartTime} - {slot.recurringEndTime}
                          </div>
                        ) : (
                          <div className="font-medium">
                            {formatDate(slot.startTime)}, {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                          </div>
                        )}
                        {slot.reason && <div className="text-sm text-gray-600">{slot.reason}</div>}
                      </div>
                      <button
                        onClick={() => handleDeleteBlockedSlot(slot.id)}
                        className="text-red-600 hover:text-red-700 text-sm font-medium"
                      >
                        Törlés
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* New Booking View */}
        {view === 'new' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold mb-6">Új foglalás létrehozása</h3>

            {/* Progress */}
            <div className="flex items-center gap-2 mb-6">
              {['customer', 'service', 'time', 'confirm'].map((step, idx) => (
                <div key={step} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    newBookingStep === step ? 'bg-blue-600 text-white' :
                    idx < ['customer', 'service', 'time', 'confirm'].indexOf(newBookingStep)
                      ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {idx + 1}
                  </div>
                  {idx < 3 && <div className="w-8 h-0.5 bg-gray-200 mx-1" />}
                </div>
              ))}
            </div>

            {/* Step 1: Customer */}
            {newBookingStep === 'customer' && (
              <div className="space-y-4">
                <h4 className="font-medium">Ügyfél adatai</h4>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Név *</label>
                  <input
                    type="text"
                    value={formData.customerName}
                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Ügyfél neve"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefonszám</label>
                  <input
                    type="tel"
                    value={formData.customerPhone}
                    onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="+36 30 123 4567"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.customerEmail}
                    onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="email@example.com"
                  />
                </div>
                <button
                  onClick={() => setNewBookingStep('service')}
                  disabled={!formData.customerName}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Tovább
                </button>
              </div>
            )}

            {/* Step 2: Service */}
            {newBookingStep === 'service' && (
              <div className="space-y-4">
                <h4 className="font-medium">Jármű és szolgáltatás</h4>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jármű típusa *</label>
                  <select
                    value={formData.vehicleType}
                    onChange={(e) => setFormData({ ...formData, vehicleType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    {vehicleTypes.map((vt) => (
                      <option key={vt.value} value={vt.value}>{vt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rendszám</label>
                  <input
                    type="text"
                    value={formData.plateNumber}
                    onChange={(e) => setFormData({ ...formData, plateNumber: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg uppercase"
                    placeholder="ABC-123"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setNewBookingStep('customer')}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Vissza
                  </button>
                  <button
                    onClick={() => {
                      const date = new Date().toISOString().split('T')[0];
                      loadAvailableSlots(date, formData.vehicleType);
                      setNewBookingStep('time');
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Tovább
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Time */}
            {newBookingStep === 'time' && (
              <div className="space-y-4">
                <h4 className="font-medium">Időpont és szolgáltatás választása</h4>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dátum</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      setSelectedDate(e.target.value);
                      loadAvailableSlots(e.target.value, formData.vehicleType);
                    }}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                {services.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Szolgáltatások * (több is kiválasztható)</label>
                    <div className="space-y-2">
                      {services.map((service) => {
                        const isSelected = formData.servicePackageIds.includes(service.id);
                        return (
                          <label
                            key={service.id}
                            className={`flex items-start gap-3 w-full p-3 border rounded-lg cursor-pointer transition-colors ${
                              isSelected
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormData({
                                    ...formData,
                                    servicePackageIds: [...formData.servicePackageIds, service.id],
                                  });
                                } else {
                                  setFormData({
                                    ...formData,
                                    servicePackageIds: formData.servicePackageIds.filter(id => id !== service.id),
                                  });
                                }
                              }}
                              className="mt-1 w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <div className="flex-1">
                              <div className="font-medium">{service.name}</div>
                              <div className="flex justify-between text-sm text-gray-500">
                                <span>{service.durationMinutes} perc</span>
                                <span className="font-medium">{formatPrice(service.price, service.currency)}</span>
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                    {formData.servicePackageIds.length > 0 && (
                      <div className="mt-2 p-2 bg-blue-50 rounded-lg text-sm text-blue-700">
                        Kiválasztva: {formData.servicePackageIds.length} szolgáltatás
                        {formData.servicePackageIds.length > 0 && (
                          <span className="ml-2 font-medium">
                            ({services.filter(s => formData.servicePackageIds.includes(s.id)).reduce((sum, s) => sum + s.durationMinutes, 0)} perc összesen)
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {loading ? (
                  <div className="text-center py-4 text-gray-500">Időpontok betöltése...</div>
                ) : availableSlots.filter(s => s.available).length === 0 ? (
                  <div className="text-center py-4 text-gray-500">Nincs szabad időpont ezen a napon</div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Időpont *</label>
                    <div className="grid grid-cols-4 gap-2">
                      {availableSlots.filter(s => s.available).map((slot, idx) => (
                        <button
                          key={idx}
                          onClick={() => setFormData({ ...formData, scheduledStart: slot.startTime })}
                          className={`p-2 border rounded-lg text-center ${
                            formData.scheduledStart === slot.startTime
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {formatTime(slot.startTime)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => setNewBookingStep('service')}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Vissza
                  </button>
                  <button
                    onClick={() => setNewBookingStep('confirm')}
                    disabled={formData.servicePackageIds.length === 0 || !formData.scheduledStart}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    Tovább
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Confirm */}
            {newBookingStep === 'confirm' && (
              <div className="space-y-4">
                <h4 className="font-medium">Foglalás megerősítése</h4>

                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Ügyfél:</span>
                    <span className="font-medium">{formData.customerName}</span>
                  </div>
                  {formData.customerPhone && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Telefon:</span>
                      <span>{formData.customerPhone}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-500">Jármű:</span>
                    <span>{vehicleTypes.find(v => v.value === formData.vehicleType)?.label} {formData.plateNumber && `(${formData.plateNumber})`}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Szolgáltatások:</span>
                    <ul className="mt-1 space-y-1">
                      {selectedServices.map(s => (
                        <li key={s.id} className="flex justify-between text-sm">
                          <span>{s.name}</span>
                          <span className="text-gray-600">{s.durationMinutes} perc</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Időtartam:</span>
                    <span>{totalDuration} perc összesen</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Időpont:</span>
                    <span>{formatDate(formData.scheduledStart)}, {formatTime(formData.scheduledStart)}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Megjegyzés (opcionális)</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    rows={2}
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setNewBookingStep('time')}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Vissza
                  </button>
                  <button
                    onClick={handleCreateBooking}
                    disabled={actionLoading === 'new'}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {actionLoading === 'new' ? 'Mentés...' : 'Foglalás létrehozása'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
