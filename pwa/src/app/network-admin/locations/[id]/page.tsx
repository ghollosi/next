'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { networkAdminApi, fetchOperatorApi } from '@/lib/network-admin-api';

interface OpeningHourData {
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

interface Location {
  id: string;
  code: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  operationType: 'OWN' | 'SUBCONTRACTOR';
  washMode?: string;
  latitude?: number;
  longitude?: number;
  openingHours?: string;
  openingHoursStructured?: Record<string, OpeningHourData>;
  isActive: boolean;
  createdAt: string;
}

interface Operator {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
}

interface LocationService {
  id: string;
  servicePackageId: string;
  servicePackageName: string;
  servicePackageCode: string;
  isActive: boolean;
}

interface ServicePackage {
  id: string;
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
  durationMinutes?: number;
}

interface QRCodeData {
  locationId: string;
  locationCode: string;
  locationName: string;
  washUrl: string;
  qrCodeDataUrl: string;
  size: number;
}

interface Booking {
  id: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: string;
  customerName?: string;
  customerPhone?: string;
  plateNumber?: string;
  vehicleType: string;
  servicePackage?: { name: string };
  driver?: { name: string };
}

interface BlockedSlot {
  id: string;
  startTime: string;
  endTime: string;
  reason?: string;
  isRecurring: boolean;
  recurringDayOfWeek?: number;
  createdBy: string;
}

interface Price {
  id: string;
  servicePackageId: string;
  vehicleType: string;
  price: number;
  servicePackage?: { id: string; name: string; code: string; durationMinutes?: number };
}

type VehicleType = 'TRUCK' | 'TRUCK_12T' | 'TRAILER' | 'BUS' | 'VAN' | 'CAR';

const VEHICLE_TYPES: { value: VehicleType; label: string }[] = [
  { value: 'TRUCK', label: 'Kamion' },
  { value: 'TRUCK_12T', label: 'Kamion 12t' },
  { value: 'TRAILER', label: 'Pótkocsi' },
  { value: 'BUS', label: 'Busz' },
  { value: 'VAN', label: 'Kisbusz' },
  { value: 'CAR', label: 'Személyautó' },
];

const DAY_NAMES = ['Vasárnap', 'Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat'];

// Napok nevei a JS getDay() függvényhez (0 = vasárnap)
const dayOfWeekNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

// Helper: nyitvatartási órák kinyerése adott napra
function getOpeningHoursForDate(
  date: string,
  openingHours?: Record<string, OpeningHourData>
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

export default function LocationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const locationId = params.id as string;

  const [location, setLocation] = useState<Location | null>(null);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [locationServices, setLocationServices] = useState<LocationService[]>([]);
  const [allServicePackages, setAllServicePackages] = useState<ServicePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Service Modal
  const [serviceModal, setServiceModal] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [addingService, setAddingService] = useState(false);
  const [serviceError, setServiceError] = useState('');

  // QR Modal
  const [qrModal, setQrModal] = useState<QRCodeData | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);

  // Operator Modal
  const [operatorModal, setOperatorModal] = useState<{
    mode: 'create' | 'edit';
    operator?: Operator;
  } | null>(null);
  const [operatorForm, setOperatorForm] = useState({ name: '', pin: '' });
  const [operatorError, setOperatorError] = useState('');
  const [savingOperator, setSavingOperator] = useState(false);

  // Booking Calendar
  const [activeTab, setActiveTab] = useState<'info' | 'bookings' | 'blocked'>('info');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [weekBookings, setWeekBookings] = useState<Booking[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [prices, setPrices] = useState<Price[]>([]);
  const [calendarMode, setCalendarMode] = useState<'day' | 'week'>('day');

  // Blocked Slot Modal
  const [blockedModal, setBlockedModal] = useState(false);
  const [blockedForm, setBlockedForm] = useState({
    isRecurring: false,
    dayOfWeek: '1',
    date: new Date().toISOString().split('T')[0],
    startTime: '08:00',
    endTime: '09:00',
    reason: 'Walk-in ügyfelek',
  });
  const [savingBlocked, setSavingBlocked] = useState(false);

  // New Booking Modal
  const [newBookingModal, setNewBookingModal] = useState(false);
  const [newBookingStep, setNewBookingStep] = useState(1);
  const [availableSlots, setAvailableSlots] = useState<Array<{ startTime: string; endTime: string; available: boolean }>>([]);
  const [newBookingForm, setNewBookingForm] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    vehicleType: 'TRUCK' as VehicleType,
    servicePackageId: '',
    plateNumber: '',
    selectedSlot: '',
    notes: '',
  });
  const [savingBooking, setSavingBooking] = useState(false);

  useEffect(() => {
    loadData();
  }, [locationId]);

  useEffect(() => {
    if (activeTab === 'bookings') {
      if (calendarMode === 'day') {
        loadBookings();
      } else {
        loadWeekBookings();
      }
    } else if (activeTab === 'blocked') {
      loadBlockedSlots();
    }
  }, [activeTab, selectedDate, locationId, calendarMode]);

  const loadBookings = async () => {
    setLoadingBookings(true);
    try {
      const result = await networkAdminApi.listBookings({
        locationId,
        dateFrom: selectedDate,
        dateTo: selectedDate,
      });
      setBookings(result.data || []);
    } catch (err) {
      console.error('Failed to load bookings:', err);
    } finally {
      setLoadingBookings(false);
    }
  };

  const loadWeekBookings = async () => {
    setLoadingBookings(true);
    try {
      const start = new Date(selectedDate);
      const day = start.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      start.setDate(start.getDate() + diff);
      const startStr = start.toISOString().split('T')[0];
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      const endStr = end.toISOString().split('T')[0];

      const result = await networkAdminApi.listBookings({
        locationId,
        dateFrom: startStr,
        dateTo: endStr,
      });
      setWeekBookings(result.data || []);
    } catch (err) {
      console.error('Failed to load week bookings:', err);
    } finally {
      setLoadingBookings(false);
    }
  };

  const loadBlockedSlots = async () => {
    try {
      const slots = await networkAdminApi.listBlockedSlots(locationId);
      setBlockedSlots(slots);
    } catch (err) {
      console.error('Failed to load blocked slots:', err);
    }
  };

  const loadAvailableSlots = async () => {
    if (!newBookingForm.servicePackageId) return;
    try {
      const slots = await networkAdminApi.getAvailableSlots({
        locationId,
        date: selectedDate,
        servicePackageId: newBookingForm.servicePackageId,
        vehicleType: newBookingForm.vehicleType,
      });
      setAvailableSlots(slots);
    } catch (err) {
      console.error('Failed to load available slots:', err);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      // Load location details
      const locations = await fetchOperatorApi<Location[]>('/operator/locations');
      const loc = locations.find(l => l.id === locationId);
      if (!loc) {
        setError('Helyszín nem található');
        return;
      }
      setLocation(loc);

      // Load operators
      const ops = await networkAdminApi.listLocationOperators(locationId);
      setOperators(ops);

      // Load services and prices
      const [services, packages, priceList] = await Promise.all([
        networkAdminApi.listLocationServices(locationId),
        networkAdminApi.listServicePackages(),
        networkAdminApi.listPrices(),
      ]);
      setLocationServices(services);
      setAllServicePackages(packages);
      setPrices(priceList);
    } catch (err: any) {
      setError(err.message || 'Hiba történt');
    } finally {
      setLoading(false);
    }
  };

  const loadQRCode = async () => {
    setLoadingQr(true);
    try {
      const data = await fetchOperatorApi<QRCodeData>(
        `/operator/locations/${locationId}/qr-code-data?size=400`
      );
      setQrModal(data);
    } catch (err: any) {
      alert(err.message || 'Hiba történt');
    } finally {
      setLoadingQr(false);
    }
  };

  const downloadQRCode = async (format: 'png' | 'svg') => {
    if (!location) return;
    try {
      const data = await fetchOperatorApi<QRCodeData>(
        `/operator/locations/${locationId}/qr-code-data?size=600`
      );
      const a = document.createElement('a');
      a.href = data.qrCodeDataUrl;
      a.download = `qr-${location.code}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      alert(err.message || 'Hiba történt');
    }
  };

  // Operator CRUD
  const openCreateOperator = () => {
    setOperatorForm({ name: '', pin: '' });
    setOperatorError('');
    setOperatorModal({ mode: 'create' });
  };

  const openEditOperator = (operator: Operator) => {
    setOperatorForm({ name: operator.name, pin: '' });
    setOperatorError('');
    setOperatorModal({ mode: 'edit', operator });
  };

  const saveOperator = async () => {
    if (!operatorForm.name.trim()) {
      setOperatorError('A név megadása kötelező');
      return;
    }

    if (operatorModal?.mode === 'create' && operatorForm.pin.length !== 4) {
      setOperatorError('A PIN kódnak 4 számjegyűnek kell lennie');
      return;
    }

    if (operatorModal?.mode === 'edit' && operatorForm.pin && operatorForm.pin.length !== 4) {
      setOperatorError('A PIN kódnak 4 számjegyűnek kell lennie');
      return;
    }

    setSavingOperator(true);
    setOperatorError('');

    try {
      if (operatorModal?.mode === 'create') {
        await networkAdminApi.createLocationOperator(locationId, {
          name: operatorForm.name.trim(),
          pin: operatorForm.pin,
        });
      } else if (operatorModal?.mode === 'edit' && operatorModal.operator) {
        const updateData: { name?: string; pin?: string } = {
          name: operatorForm.name.trim(),
        };
        if (operatorForm.pin) {
          updateData.pin = operatorForm.pin;
        }
        await networkAdminApi.updateLocationOperator(operatorModal.operator.id, updateData);
      }

      // Reload operators
      const ops = await networkAdminApi.listLocationOperators(locationId);
      setOperators(ops);
      setOperatorModal(null);
    } catch (err: any) {
      setOperatorError(err.message || 'Hiba történt');
    } finally {
      setSavingOperator(false);
    }
  };

  const toggleOperatorStatus = async (operator: Operator) => {
    try {
      await networkAdminApi.updateLocationOperator(operator.id, {
        isActive: !operator.isActive,
      });
      // Reload operators
      const ops = await networkAdminApi.listLocationOperators(locationId);
      setOperators(ops);
    } catch (err: any) {
      alert(err.message || 'Hiba történt');
    }
  };

  const deleteOperator = async (operator: Operator) => {
    if (!confirm(`Biztosan törölni szeretnéd "${operator.name}" operátort?`)) {
      return;
    }

    try {
      await networkAdminApi.deleteLocationOperator(operator.id);
      // Reload operators
      const ops = await networkAdminApi.listLocationOperators(locationId);
      setOperators(ops);
    } catch (err: any) {
      alert(err.message || 'Hiba történt');
    }
  };

  // Service functions
  const openAddService = () => {
    setSelectedServiceId('');
    setServiceError('');
    setServiceModal(true);
  };

  const addService = async () => {
    if (!selectedServiceId) {
      setServiceError('Válassz egy szolgáltatást');
      return;
    }

    setAddingService(true);
    setServiceError('');

    try {
      await networkAdminApi.addLocationService(locationId, selectedServiceId);
      // Reload services
      const services = await networkAdminApi.listLocationServices(locationId);
      setLocationServices(services);
      setServiceModal(false);
    } catch (err: any) {
      setServiceError(err.message || 'Hiba történt');
    } finally {
      setAddingService(false);
    }
  };

  const removeService = async (service: LocationService) => {
    if (!confirm(`Biztosan eltávolítod a "${service.servicePackageName}" szolgáltatást erről a helyszínről?`)) {
      return;
    }

    try {
      await networkAdminApi.removeLocationService(locationId, service.servicePackageId);
      // Reload services
      const services = await networkAdminApi.listLocationServices(locationId);
      setLocationServices(services);
    } catch (err: any) {
      alert(err.message || 'Hiba történt');
    }
  };

  // Get available services (not yet added to location)
  const availableServices = allServicePackages.filter(
    pkg => pkg.isActive && !locationServices.some(ls => ls.servicePackageId === pkg.id)
  );

  // Blocked slot functions
  const createBlockedSlot = async () => {
    setSavingBlocked(true);
    try {
      if (blockedForm.isRecurring) {
        await networkAdminApi.createRecurringBlock({
          locationId,
          dayOfWeek: blockedForm.dayOfWeek,
          startTime: blockedForm.startTime,
          endTime: blockedForm.endTime,
          reason: blockedForm.reason || undefined,
        });
      } else {
        const startDateTime = `${blockedForm.date}T${blockedForm.startTime}:00`;
        const endDateTime = `${blockedForm.date}T${blockedForm.endTime}:00`;
        await networkAdminApi.createBlockedSlot({
          locationId,
          startTime: startDateTime,
          endTime: endDateTime,
          reason: blockedForm.reason || undefined,
        });
      }
      await loadBlockedSlots();
      setBlockedModal(false);
      setBlockedForm({
        isRecurring: false,
        dayOfWeek: '1',
        date: new Date().toISOString().split('T')[0],
        startTime: '08:00',
        endTime: '09:00',
        reason: 'Walk-in ügyfelek',
      });
    } catch (err: any) {
      alert(err.message || 'Hiba történt');
    } finally {
      setSavingBlocked(false);
    }
  };

  const deleteBlockedSlot = async (slotId: string) => {
    if (!confirm('Biztosan törölni szeretnéd ezt a blokkolt időszakot?')) return;
    try {
      await networkAdminApi.deleteBlockedSlot(slotId);
      await loadBlockedSlots();
    } catch (err: any) {
      alert(err.message || 'Hiba történt');
    }
  };

  // New booking functions
  const openNewBookingModal = () => {
    setNewBookingStep(1);
    setNewBookingForm({
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      vehicleType: 'TRUCK',
      servicePackageId: '',
      plateNumber: '',
      selectedSlot: '',
      notes: '',
    });
    setAvailableSlots([]);
    setNewBookingModal(true);
  };

  const handleServiceSelected = async () => {
    if (!newBookingForm.servicePackageId || !newBookingForm.vehicleType) return;
    await loadAvailableSlots();
    setNewBookingStep(3);
  };

  const createNewBooking = async () => {
    if (!newBookingForm.customerName || !newBookingForm.selectedSlot || !newBookingForm.servicePackageId) {
      alert('Kérlek töltsd ki az összes kötelező mezőt!');
      return;
    }
    setSavingBooking(true);
    try {
      await networkAdminApi.createBooking({
        locationId,
        scheduledStart: `${selectedDate}T${newBookingForm.selectedSlot}:00`,
        servicePackageId: newBookingForm.servicePackageId,
        vehicleType: newBookingForm.vehicleType,
        customerName: newBookingForm.customerName,
        customerPhone: newBookingForm.customerPhone || undefined,
        customerEmail: newBookingForm.customerEmail || undefined,
        plateNumber: newBookingForm.plateNumber || undefined,
        notes: newBookingForm.notes || undefined,
      });
      setNewBookingModal(false);
      await loadBookings();
    } catch (err: any) {
      alert(err.message || 'Hiba történt');
    } finally {
      setSavingBooking(false);
    }
  };

  const getServicePrice = (serviceId: string, vehicleType: string) => {
    const price = prices.find(p => p.servicePackageId === serviceId && p.vehicleType === vehicleType);
    return price?.price || 0;
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      PENDING: { label: 'Függőben', color: 'bg-yellow-100 text-yellow-700' },
      CONFIRMED: { label: 'Megerősítve', color: 'bg-blue-100 text-blue-700' },
      IN_PROGRESS: { label: 'Folyamatban', color: 'bg-purple-100 text-purple-700' },
      COMPLETED: { label: 'Befejezett', color: 'bg-green-100 text-green-700' },
      CANCELLED: { label: 'Lemondva', color: 'bg-gray-100 text-gray-500' },
      NO_SHOW: { label: 'Nem jelent meg', color: 'bg-red-100 text-red-700' },
    };
    const s = statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-500' };
    return <span className={`px-2 py-1 text-xs font-medium rounded-full ${s.color}`}>{s.label}</span>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Betöltés...</div>
      </div>
    );
  }

  if (error || !location) {
    return (
      <div className="space-y-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600">
          {error || 'Helyszín nem található'}
        </div>
        <Link
          href="/network-admin/locations"
          className="inline-flex items-center gap-2 text-primary-600 hover:underline"
        >
          &larr; Vissza a helyszínekhez
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/network-admin/locations"
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{location.name}</h1>
            <p className="text-gray-500 font-mono">{location.code}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadQRCode}
            disabled={loadingQr}
            className="px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            QR kód
          </button>
          <Link
            href={`/network-admin/locations/${locationId}/edit`}
            className="px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
          >
            Szerkesztés
          </Link>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('info')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'info'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Alapadatok
            </button>
            <button
              onClick={() => setActiveTab('bookings')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'bookings'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Foglalások
            </button>
            <button
              onClick={() => setActiveTab('blocked')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'blocked'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Walk-in időszakok
            </button>
          </nav>
        </div>
      </div>

      {/* Bookings Tab */}
      {activeTab === 'bookings' && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          {/* Calendar Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCalendarMode('day')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  calendarMode === 'day' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Napi
              </button>
              <button
                onClick={() => setCalendarMode('week')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  calendarMode === 'week' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
                className="px-4 py-2 border border-gray-200 rounded-lg text-center font-medium focus:border-primary-500 focus:outline-none"
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
                className="px-3 py-2 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 text-sm font-medium"
              >
                Ma
              </button>
            </div>

            <button
              onClick={openNewBookingModal}
              className="px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors text-sm"
            >
              + Új foglalás
            </button>
          </div>

          {loadingBookings ? (
            <div className="text-center py-8 text-gray-500">Betöltés...</div>
          ) : calendarMode === 'day' ? (
            /* Napi nézet - időrács */
            (() => {
              const { startHour, endHour, isClosed } = getOpeningHoursForDate(selectedDate, location?.openingHoursStructured);
              const hourCount = endHour - startHour;
              const gridHeight = Math.max(hourCount * 40, 200);

              if (isClosed) {
                return (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                      <div className="font-semibold text-center">
                        {new Date(selectedDate).toLocaleDateString('hu-HU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                      </div>
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
                      {new Date(selectedDate).toLocaleDateString('hu-HU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
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
                      if (slot.isRecurring) {
                        const dow = new Date(selectedDate).getDay();
                        if (slot.recurringDayOfWeek !== dow) return null;
                        const slotStart = slot.startTime || '00:00';
                        const slotEnd = slot.endTime || '00:00';
                        const [sH, sM] = slotStart.split(':').map(Number);
                        const [eH, eM] = slotEnd.split(':').map(Number);
                        const top = ((sH - startHour) * 60 + sM) * (40 / 60);
                        const height = ((eH * 60 + eM) - (sH * 60 + sM)) * (40 / 60);
                        return (
                          <div
                            key={slot.id}
                            className="absolute left-16 right-4 bg-orange-100 border-l-4 border-orange-500 rounded-r px-2 py-1 overflow-hidden"
                            style={{ top: `${top}px`, height: `${Math.max(height, 20)}px` }}
                          >
                            <div className="text-xs font-medium text-orange-700 truncate">
                              Walk-in: {slotStart} - {slotEnd}
                            </div>
                          </div>
                        );
                      } else {
                        const slotDate = new Date(slot.startTime).toISOString().split('T')[0];
                        if (slotDate !== selectedDate) return null;
                        const s = new Date(slot.startTime);
                        const e = new Date(slot.endTime);
                        const top = ((s.getHours() - startHour) * 60 + s.getMinutes()) * (40 / 60);
                        const height = ((e.getHours() * 60 + e.getMinutes()) - (s.getHours() * 60 + s.getMinutes())) * (40 / 60);
                        return (
                          <div
                            key={slot.id}
                            className="absolute left-16 right-4 bg-orange-100 border-l-4 border-orange-500 rounded-r px-2 py-1 overflow-hidden"
                            style={{ top: `${top}px`, height: `${Math.max(height, 20)}px` }}
                          >
                            <div className="text-xs font-medium text-orange-700 truncate">
                              Walk-in: {s.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })} - {e.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        );
                      }
                    })}

                    {/* Foglalások */}
                    {bookings.map((booking) => {
                      const bStart = new Date(booking.scheduledStart);
                      const bEnd = new Date(booking.scheduledEnd);
                      const top = ((bStart.getHours() - startHour) * 60 + bStart.getMinutes()) * (40 / 60);
                      const height = ((bEnd.getHours() * 60 + bEnd.getMinutes()) - (bStart.getHours() * 60 + bStart.getMinutes())) * (40 / 60);

                      const bgColor = booking.status === 'COMPLETED' ? 'bg-green-100 border-green-500' :
                                     booking.status === 'IN_PROGRESS' ? 'bg-purple-100 border-purple-500' :
                                     booking.status === 'CONFIRMED' ? 'bg-blue-100 border-blue-500' :
                                     booking.status === 'CANCELLED' ? 'bg-gray-100 border-gray-400' :
                                     booking.status === 'NO_SHOW' ? 'bg-red-100 border-red-500' :
                                     'bg-yellow-100 border-yellow-500';

                      return (
                        <Link
                          key={booking.id}
                          href={`/network-admin/bookings/${booking.id}`}
                          className={`absolute left-16 right-4 ${bgColor} border-l-4 rounded-r px-2 py-1 cursor-pointer hover:shadow-md transition-shadow overflow-hidden`}
                          style={{ top: `${top}px`, height: `${Math.max(height, 30)}px` }}
                        >
                          <div className="text-xs font-semibold truncate">
                            {bStart.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })} {booking.customerName || booking.driver?.name || 'Ismeretlen'}
                          </div>
                          {height > 40 && (
                            <div className="text-xs text-gray-600 truncate">
                              {booking.servicePackage?.name} - {booking.plateNumber || '-'}
                            </div>
                          )}
                        </Link>
                      );
                    })}

                    {bookings.length === 0 && (
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
              const dow = weekStartDate.getDay();
              const diffToMonday = dow === 0 ? -6 : 1 - dow;
              weekStartDate.setDate(weekStartDate.getDate() + diffToMonday);

              // Lekérjük minden nap nyitvatartását és meghatározzuk a legkorábbi/legkésőbbi órát
              const weekDays = Array.from({ length: 7 }, (_, i) => {
                const d = new Date(weekStartDate);
                d.setDate(d.getDate() + i);
                const dateStr = d.toISOString().split('T')[0];
                return {
                  date: d,
                  dateStr,
                  ...getOpeningHoursForDate(dateStr, location?.openingHoursStructured),
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
                            className={`p-2 text-center border-r border-gray-200 last:border-r-0 cursor-pointer hover:bg-gray-100 ${isToday ? 'bg-primary-50' : ''} ${dayInfo.isClosed ? 'bg-gray-100' : ''}`}
                            onClick={() => {
                              setSelectedDate(dayInfo.dateStr);
                              setCalendarMode('day');
                            }}
                          >
                            <div className="text-xs text-gray-500">{dayNames[i]}</div>
                            <div className={`text-sm font-semibold ${isToday ? 'text-primary-600' : ''} ${dayInfo.isClosed ? 'text-gray-400' : ''}`}>
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

                            const cellBookings = weekBookings.filter((b) => {
                              const bDate = new Date(b.scheduledStart);
                              return bDate.toISOString().split('T')[0] === dayInfo.dateStr && bDate.getHours() === hour;
                            });

                            const cellBlocked = blockedSlots.filter((slot) => {
                              if (slot.isRecurring) {
                                if (slot.recurringDayOfWeek !== dayInfo.date.getDay()) return false;
                                const [sH] = (slot.startTime || '00:00').split(':').map(Number);
                                return sH === hour;
                              } else {
                                const slotDate = new Date(slot.startTime);
                                return slotDate.toISOString().split('T')[0] === dayInfo.dateStr && slotDate.getHours() === hour;
                              }
                            });

                            return (
                              <div
                                key={dayIdx}
                                className={`border-r border-gray-200 last:border-r-0 relative ${isToday ? 'bg-primary-50/30' : ''} ${isOutsideHours ? 'bg-gray-50' : ''}`}
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
                                                 'bg-yellow-200 border-yellow-400';
                                  return (
                                    <Link
                                      key={booking.id}
                                      href={`/network-admin/bookings/${booking.id}`}
                                      className={`absolute inset-1 ${bgColor} border rounded text-xs p-0.5 overflow-hidden hover:shadow`}
                                      title={`${booking.customerName || 'Ismeretlen'}`}
                                    >
                                      <div className="font-medium truncate">
                                        {new Date(booking.scheduledStart).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}
                                      </div>
                                    </Link>
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

      {/* Blocked Slots Tab */}
      {activeTab === 'blocked' && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Walk-in időszakok</h2>
            <button
              onClick={() => setBlockedModal(true)}
              className="px-4 py-2 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-700 transition-colors text-sm"
            >
              + Új blokkolt időszak
            </button>
          </div>

          <div className="bg-amber-50 rounded-xl p-4 mb-6">
            <p className="text-sm text-amber-700">
              <strong>Walk-in időszakok:</strong> Az itt megadott időszakokban a sofőrök nem tudnak online foglalni.
              Ezeket az időszakokat a walk-in ügyfeleknek tarthatod fenn.
            </p>
          </div>

          {blockedSlots.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>Nincs blokkolt időszak</p>
            </div>
          ) : (
            <div className="space-y-3">
              {blockedSlots.map((slot) => (
                <div key={slot.id} className="border border-orange-200 bg-orange-50 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      {slot.isRecurring ? (
                        <p className="font-medium text-orange-700">
                          Minden {DAY_NAMES[slot.recurringDayOfWeek || 0]}: {slot.startTime} - {slot.endTime}
                        </p>
                      ) : (
                        <p className="font-medium text-orange-700">
                          {new Date(slot.startTime).toLocaleDateString('hu-HU')} {new Date(slot.startTime).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })} - {new Date(slot.endTime).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                      {slot.reason && <p className="text-sm text-orange-600 mt-1">{slot.reason}</p>}
                    </div>
                    <button
                      onClick={() => deleteBlockedSlot(slot.id)}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Info Tab - Location Info Card */}
      {activeTab === 'info' && (
        <>
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Helyszín adatok</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-gray-500 mb-1">Cím</p>
            <p className="text-gray-900">
              {location.address || '-'}
              {location.city && (
                <span>
                  {location.address ? ', ' : ''}
                  {location.zipCode} {location.city}
                </span>
              )}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">Üzemeltetés típusa</p>
            <span
              className={`inline-block px-2 py-1 text-sm font-medium rounded-full ${
                location.operationType === 'OWN'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-orange-100 text-orange-700'
              }`}
            >
              {location.operationType === 'OWN' ? 'Saját' : 'Alvállalkozó'}
            </span>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">Mosás mód</p>
            <p className="text-gray-900">
              {location.washMode === 'DRIVER_INITIATED' ? 'Sofőr indítja' :
               location.washMode === 'OPERATOR_INITIATED' ? 'Operátor indítja' :
               location.washMode || '-'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">Státusz</p>
            <span
              className={`inline-block px-2 py-1 text-sm font-medium rounded-full ${
                location.isActive
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {location.isActive ? 'Aktív' : 'Inaktív'}
            </span>
          </div>
          {location.openingHours && (
            <div className="md:col-span-2">
              <p className="text-sm text-gray-500 mb-1">Nyitvatartás</p>
              <p className="text-gray-900">{location.openingHours}</p>
            </div>
          )}
        </div>
      </div>

      {/* Operators Section */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Operátorok</h2>
          <button
            onClick={openCreateOperator}
            className="px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors text-sm"
          >
            + Új operátor
          </button>
        </div>

        {operators.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p>Nincsenek operátorok ehhez a helyszínhez.</p>
            <p className="text-sm mt-1">Adj hozzá operátorokat, akik bejelentkezhetnek a mosáskezeléshez.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {operators.map((operator) => (
              <div key={operator.id} className="py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{operator.name}</p>
                    <p className="text-sm text-gray-500">
                      Létrehozva: {new Date(operator.createdAt).toLocaleDateString('hu-HU')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      operator.isActive
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {operator.isActive ? 'Aktív' : 'Inaktív'}
                  </span>
                  <button
                    onClick={() => toggleOperatorStatus(operator)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title={operator.isActive ? 'Letiltás' : 'Aktiválás'}
                  >
                    {operator.isActive ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => openEditOperator(operator)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Szerkesztés"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => deleteOperator(operator)}
                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Törlés"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info box */}
        <div className="mt-4 bg-blue-50 rounded-xl p-4">
          <p className="text-sm text-blue-700">
            <strong>Tipp:</strong> Minden operátor saját PIN kóddal jelentkezik be az Operátor Portálra.
            A helyszín kódja ({location.code}) és az egyedi PIN kód együtt azonosítja az operátort.
          </p>
        </div>
      </div>

      {/* Services Section */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Elérhető szolgáltatások</h2>
          <button
            onClick={openAddService}
            disabled={availableServices.length === 0}
            className="px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors text-sm disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            + Szolgáltatás hozzáadása
          </button>
        </div>

        {locationServices.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <p>Nincsenek szolgáltatások ehhez a helyszínhez.</p>
            <p className="text-sm mt-1">Add hozzá az árlistában szereplő szolgáltatásokat, hogy a sofőrök kiválaszthassák.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {locationServices.map((service) => (
              <div key={service.id} className="py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{service.servicePackageName}</p>
                    <p className="text-sm text-gray-500 font-mono">{service.servicePackageCode}</p>
                  </div>
                </div>
                <button
                  onClick={() => removeService(service)}
                  className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Eltávolítás"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Info box */}
        <div className="mt-4 bg-amber-50 rounded-xl p-4">
          <p className="text-sm text-amber-700">
            <strong>Fontos:</strong> Csak azok a szolgáltatások jelennek meg a sofőröknek, amelyek itt hozzá vannak adva.
            Az árakat az <Link href="/network-admin/prices" className="underline">Árlista</Link> menüben tudod beállítani.
          </p>
        </div>
      </div>
        </>
      )}

      {/* Service Modal */}
      {serviceModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setServiceModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Szolgáltatás hozzáadása</h2>
                <button
                  onClick={() => setServiceModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Válassz szolgáltatást *
                </label>
                {availableServices.length === 0 ? (
                  <p className="text-gray-500 text-sm">Minden szolgáltatás már hozzá van adva ehhez a helyszínhez.</p>
                ) : (
                  <select
                    value={selectedServiceId}
                    onChange={(e) => setSelectedServiceId(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-0 focus:outline-none"
                  >
                    <option value="">-- Válassz --</option>
                    {availableServices.map((pkg) => (
                      <option key={pkg.id} value={pkg.id}>
                        {pkg.name} ({pkg.code})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {serviceError && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">
                  {serviceError}
                </div>
              )}
            </div>

            <div className="p-6 pt-0 flex gap-3">
              <button
                onClick={() => setServiceModal(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
              >
                Mégse
              </button>
              <button
                onClick={addService}
                disabled={addingService || availableServices.length === 0}
                className="flex-1 py-3 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 transition-colors disabled:bg-gray-300"
              >
                {addingService ? 'Hozzáadás...' : 'Hozzáadás'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {qrModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setQrModal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{qrModal.locationName}</h2>
                  <p className="text-sm text-gray-500 font-mono">{qrModal.locationCode}</p>
                </div>
                <button
                  onClick={() => setQrModal(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 flex flex-col items-center">
              <div className="bg-white p-4 rounded-xl border-2 border-gray-100 shadow-inner">
                <img
                  src={qrModal.qrCodeDataUrl}
                  alt={`QR code for ${qrModal.locationName}`}
                  className="w-64 h-64"
                />
              </div>
              <div className="mt-4 w-full">
                <p className="text-xs text-gray-500 text-center mb-2">Mosás indítás URL:</p>
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-600 font-mono break-all text-center">
                  {qrModal.washUrl}
                </div>
              </div>
            </div>

            <div className="p-6 pt-0 flex gap-3">
              <button
                onClick={() => downloadQRCode('png')}
                className="flex-1 py-3 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                PNG
              </button>
              <button
                onClick={() => downloadQRCode('svg')}
                className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                SVG
              </button>
            </div>

            <div className="px-6 pb-6">
              <div className="bg-blue-50 rounded-xl p-4">
                <p className="text-sm text-blue-700">
                  <strong>Használat:</strong> Nyomtasd ki és helyezd el a mosóhelyen.
                  A sofőrök beolvashatják a telefonjukkal.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Operator Modal */}
      {operatorModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setOperatorModal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  {operatorModal.mode === 'create' ? 'Új operátor' : 'Operátor szerkesztése'}
                </h2>
                <button
                  onClick={() => setOperatorModal(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Operátor neve *
                </label>
                <input
                  type="text"
                  value={operatorForm.name}
                  onChange={(e) => setOperatorForm({ ...operatorForm, name: e.target.value })}
                  placeholder="pl. Kiss János"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-0 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  PIN kód {operatorModal.mode === 'create' ? '*' : '(hagyd üresen, ha nem változik)'}
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  value={operatorForm.pin}
                  onChange={(e) => setOperatorForm({ ...operatorForm, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                  placeholder="••••"
                  className="w-full px-4 py-3 text-xl text-center tracking-[0.5em] font-mono border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-0 focus:outline-none"
                  maxLength={4}
                />
                <p className="text-xs text-gray-500 mt-1">4 számjegyű PIN kód</p>
              </div>

              {operatorError && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">
                  {operatorError}
                </div>
              )}
            </div>

            <div className="p-6 pt-0 flex gap-3">
              <button
                onClick={() => setOperatorModal(null)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
              >
                Mégse
              </button>
              <button
                onClick={saveOperator}
                disabled={savingOperator}
                className="flex-1 py-3 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 transition-colors disabled:bg-gray-300"
              >
                {savingOperator ? 'Mentés...' : 'Mentés'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Blocked Slot Modal */}
      {blockedModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setBlockedModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Új blokkolt időszak</h2>
                <button
                  onClick={() => setBlockedModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Recurring toggle */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isRecurring"
                  checked={blockedForm.isRecurring}
                  onChange={(e) => setBlockedForm({ ...blockedForm, isRecurring: e.target.checked })}
                  className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <label htmlFor="isRecurring" className="text-sm font-medium text-gray-700">
                  Ismétlődő (minden héten)
                </label>
              </div>

              {blockedForm.isRecurring ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nap</label>
                  <select
                    value={blockedForm.dayOfWeek}
                    onChange={(e) => setBlockedForm({ ...blockedForm, dayOfWeek: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-0 focus:outline-none"
                  >
                    <option value="1">Hétfő</option>
                    <option value="2">Kedd</option>
                    <option value="3">Szerda</option>
                    <option value="4">Csütörtök</option>
                    <option value="5">Péntek</option>
                    <option value="6">Szombat</option>
                    <option value="0">Vasárnap</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Dátum</label>
                  <input
                    type="date"
                    value={blockedForm.date}
                    onChange={(e) => setBlockedForm({ ...blockedForm, date: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-0 focus:outline-none"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Kezdés</label>
                  <input
                    type="time"
                    value={blockedForm.startTime}
                    onChange={(e) => setBlockedForm({ ...blockedForm, startTime: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-0 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Befejezés</label>
                  <input
                    type="time"
                    value={blockedForm.endTime}
                    onChange={(e) => setBlockedForm({ ...blockedForm, endTime: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-0 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Megjegyzés</label>
                <input
                  type="text"
                  value={blockedForm.reason}
                  onChange={(e) => setBlockedForm({ ...blockedForm, reason: e.target.value })}
                  placeholder="pl. Walk-in ügyfelek"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-0 focus:outline-none"
                />
              </div>
            </div>

            <div className="p-6 pt-0 flex gap-3">
              <button
                onClick={() => setBlockedModal(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
              >
                Mégse
              </button>
              <button
                onClick={createBlockedSlot}
                disabled={savingBlocked}
                className="flex-1 py-3 bg-orange-600 text-white font-medium rounded-xl hover:bg-orange-700 transition-colors disabled:bg-gray-300"
              >
                {savingBlocked ? 'Mentés...' : 'Mentés'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Booking Modal */}
      {newBookingModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto"
          onClick={() => setNewBookingModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-lg w-full my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Új foglalás</h2>
                <button
                  onClick={() => setNewBookingModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {/* Step indicator */}
              <div className="flex items-center gap-2 mt-4">
                {[1, 2, 3, 4].map((step) => (
                  <div
                    key={step}
                    className={`flex-1 h-2 rounded-full ${
                      step <= newBookingStep ? 'bg-primary-500' : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>
              <p className="text-sm text-gray-500 mt-2">
                {newBookingStep === 1 && 'Ügyfél adatok'}
                {newBookingStep === 2 && 'Szolgáltatás'}
                {newBookingStep === 3 && 'Időpont'}
                {newBookingStep === 4 && 'Összegzés'}
              </p>
            </div>

            <div className="p-6 space-y-4">
              {/* Step 1: Customer */}
              {newBookingStep === 1 && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Ügyfél neve *</label>
                    <input
                      type="text"
                      value={newBookingForm.customerName}
                      onChange={(e) => setNewBookingForm({ ...newBookingForm, customerName: e.target.value })}
                      placeholder="pl. Kiss János"
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-0 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Telefonszám</label>
                    <input
                      type="tel"
                      value={newBookingForm.customerPhone}
                      onChange={(e) => setNewBookingForm({ ...newBookingForm, customerPhone: e.target.value })}
                      placeholder="+36 30 123 4567"
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-0 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">E-mail</label>
                    <input
                      type="email"
                      value={newBookingForm.customerEmail}
                      onChange={(e) => setNewBookingForm({ ...newBookingForm, customerEmail: e.target.value })}
                      placeholder="pelda@email.hu"
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-0 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Rendszám</label>
                    <input
                      type="text"
                      value={newBookingForm.plateNumber}
                      onChange={(e) => setNewBookingForm({ ...newBookingForm, plateNumber: e.target.value.toUpperCase() })}
                      placeholder="ABC-123"
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-0 focus:outline-none uppercase"
                    />
                  </div>
                </>
              )}

              {/* Step 2: Service */}
              {newBookingStep === 2 && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Jármű típus *</label>
                    <div className="grid grid-cols-2 gap-2">
                      {VEHICLE_TYPES.map((vt) => (
                        <button
                          key={vt.value}
                          onClick={() => setNewBookingForm({ ...newBookingForm, vehicleType: vt.value })}
                          className={`px-4 py-3 border-2 rounded-xl text-sm font-medium transition-colors ${
                            newBookingForm.vehicleType === vt.value
                              ? 'border-primary-500 bg-primary-50 text-primary-700'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {vt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Szolgáltatás *</label>
                    <div className="space-y-2">
                      {locationServices.map((ls) => {
                        const price = getServicePrice(ls.servicePackageId, newBookingForm.vehicleType);
                        return (
                          <button
                            key={ls.servicePackageId}
                            onClick={() => setNewBookingForm({ ...newBookingForm, servicePackageId: ls.servicePackageId })}
                            className={`w-full px-4 py-3 border-2 rounded-xl text-left transition-colors ${
                              newBookingForm.servicePackageId === ls.servicePackageId
                                ? 'border-primary-500 bg-primary-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex justify-between items-center">
                              <span className="font-medium">{ls.servicePackageName}</span>
                              {price > 0 && <span className="text-primary-600 font-semibold">{price.toLocaleString('hu-HU')} Ft</span>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* Step 3: Time */}
              {newBookingStep === 3 && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Dátum</label>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => {
                        setSelectedDate(e.target.value);
                        loadAvailableSlots();
                      }}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-0 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Időpont *</label>
                    {availableSlots.length === 0 ? (
                      <div className="text-center py-4 text-gray-500">
                        <p>Nincs elérhető időpont erre a napra</p>
                        <button
                          onClick={loadAvailableSlots}
                          className="mt-2 text-primary-600 hover:underline text-sm"
                        >
                          Frissítés
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                        {availableSlots.filter(s => s.available).map((slot) => (
                          <button
                            key={slot.startTime}
                            onClick={() => setNewBookingForm({ ...newBookingForm, selectedSlot: slot.startTime })}
                            className={`px-3 py-2 border-2 rounded-lg text-sm font-medium transition-colors ${
                              newBookingForm.selectedSlot === slot.startTime
                                ? 'border-primary-500 bg-primary-50 text-primary-700'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            {slot.startTime}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Step 4: Summary */}
              {newBookingStep === 4 && (
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Ügyfél:</span>
                      <span className="font-medium">{newBookingForm.customerName}</span>
                    </div>
                    {newBookingForm.customerPhone && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Telefon:</span>
                        <span>{newBookingForm.customerPhone}</span>
                      </div>
                    )}
                    {newBookingForm.plateNumber && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Rendszám:</span>
                        <span className="font-mono">{newBookingForm.plateNumber}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-500">Jármű:</span>
                      <span>{VEHICLE_TYPES.find(v => v.value === newBookingForm.vehicleType)?.label}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Szolgáltatás:</span>
                      <span>{locationServices.find(s => s.servicePackageId === newBookingForm.servicePackageId)?.servicePackageName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Időpont:</span>
                      <span className="font-semibold">{selectedDate} {newBookingForm.selectedSlot}</span>
                    </div>
                    <div className="border-t pt-3 flex justify-between">
                      <span className="text-gray-700 font-medium">Ár:</span>
                      <span className="text-primary-600 font-bold text-lg">
                        {getServicePrice(newBookingForm.servicePackageId, newBookingForm.vehicleType).toLocaleString('hu-HU')} Ft
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Megjegyzés</label>
                    <textarea
                      value={newBookingForm.notes}
                      onChange={(e) => setNewBookingForm({ ...newBookingForm, notes: e.target.value })}
                      placeholder="Opcionális megjegyzés..."
                      rows={2}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-0 focus:outline-none resize-none"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 pt-0 flex gap-3">
              {newBookingStep > 1 && (
                <button
                  onClick={() => setNewBookingStep(newBookingStep - 1)}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Vissza
                </button>
              )}
              {newBookingStep < 4 ? (
                <button
                  onClick={() => {
                    if (newBookingStep === 1 && !newBookingForm.customerName) {
                      alert('Add meg az ügyfél nevét!');
                      return;
                    }
                    if (newBookingStep === 2) {
                      if (!newBookingForm.servicePackageId) {
                        alert('Válassz szolgáltatást!');
                        return;
                      }
                      handleServiceSelected();
                      return;
                    }
                    if (newBookingStep === 3 && !newBookingForm.selectedSlot) {
                      alert('Válassz időpontot!');
                      return;
                    }
                    setNewBookingStep(newBookingStep + 1);
                  }}
                  className="flex-1 py-3 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 transition-colors"
                >
                  Tovább
                </button>
              ) : (
                <button
                  onClick={createNewBooking}
                  disabled={savingBooking}
                  className="flex-1 py-3 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 transition-colors disabled:bg-gray-300"
                >
                  {savingBooking ? 'Foglalás...' : 'Foglalás létrehozása'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
