'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { networkAdminApi, fetchOperatorApi, isPlatformViewMode } from '@/lib/network-admin-api';

type LocationVisibility = 'PUBLIC' | 'NETWORK_ONLY' | 'DEDICATED';

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
  locationType?: 'CAR_WASH' | 'TRUCK_WASH';
  washMode?: string;
  latitude?: number;
  longitude?: number;
  openingHours?: string;
  phone?: string;
  email?: string;
  isActive: boolean;
  createdAt: string;
  // Láthatóság
  visibility?: LocationVisibility;
  dedicatedPartnerIds?: string[];
  // Alvállalkozói cégadatok
  subcontractorCompanyName?: string;
  subcontractorTaxNumber?: string;
  subcontractorAddress?: string;
  subcontractorCity?: string;
  subcontractorZipCode?: string;
  subcontractorContactName?: string;
  subcontractorContactPhone?: string;
  subcontractorContactEmail?: string;
  subcontractorBankAccount?: string;
}

interface PartnerCompany {
  id: string;
  name: string;
  code?: string;
  isActive: boolean;
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
}

interface OpeningHour {
  dayOfWeek: string;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

const DAY_LABELS: Record<string, string> = {
  MONDAY: 'Hetfo',
  TUESDAY: 'Kedd',
  WEDNESDAY: 'Szerda',
  THURSDAY: 'Csutortok',
  FRIDAY: 'Pentek',
  SATURDAY: 'Szombat',
  SUNDAY: 'Vasarnap',
};

const DAYS_ORDER = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

export default function LocationEditPage() {
  const params = useParams();
  const router = useRouter();
  const locationId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isPlatformView, setIsPlatformView] = useState(false);

  // Check if in Platform View mode - redirect to details page
  useEffect(() => {
    if (isPlatformViewMode()) {
      setIsPlatformView(true);
      // Platform View mode is read-only, redirect to details page
      router.replace(`/network-admin/locations/${locationId}`);
    }
  }, [locationId, router]);

  const [form, setForm] = useState({
    name: '',
    code: '',
    address: '',
    city: '',
    zipCode: '',
    operationType: 'OWN' as 'OWN' | 'SUBCONTRACTOR',
    locationType: 'TRUCK_WASH' as 'CAR_WASH' | 'TRUCK_WASH',
    washMode: 'DRIVER_INITIATED',
    phone: '',
    email: '',
    isActive: true,
    // Láthatóság
    visibility: 'NETWORK_ONLY' as LocationVisibility,
    dedicatedPartnerIds: [] as string[],
    // Alvállalkozói cégadatok
    subcontractorCompanyName: '',
    subcontractorTaxNumber: '',
    subcontractorAddress: '',
    subcontractorCity: '',
    subcontractorZipCode: '',
    subcontractorContactName: '',
    subcontractorContactPhone: '',
    subcontractorContactEmail: '',
    subcontractorBankAccount: '',
  });

  // Partner companies for DEDICATED visibility
  const [partnerCompanies, setPartnerCompanies] = useState<PartnerCompany[]>([]);

  // Opening hours state
  const [openingHours, setOpeningHours] = useState<OpeningHour[]>(
    DAYS_ORDER.map(day => ({
      dayOfWeek: day,
      openTime: '08:00',
      closeTime: '18:00',
      isClosed: false,
    }))
  );
  const [savingHours, setSavingHours] = useState(false);
  const [hoursError, setHoursError] = useState('');
  const [hoursSuccess, setHoursSuccess] = useState('');

  // Services state
  const [locationServices, setLocationServices] = useState<LocationService[]>([]);
  const [allServicePackages, setAllServicePackages] = useState<ServicePackage[]>([]);
  const [serviceModal, setServiceModal] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [addingService, setAddingService] = useState(false);
  const [serviceError, setServiceError] = useState('');

  useEffect(() => {
    loadLocation();
  }, [locationId]);

  const loadLocation = async () => {
    try {
      const locations = await fetchOperatorApi<Location[]>('/operator/locations');
      const loc = locations.find(l => l.id === locationId);
      if (!loc) {
        setError('Helyszin nem talalhato');
        return;
      }
      setForm({
        name: loc.name || '',
        code: loc.code || '',
        address: loc.address || '',
        city: loc.city || '',
        zipCode: loc.zipCode || '',
        operationType: loc.operationType || 'OWN',
        locationType: loc.locationType || 'TRUCK_WASH',
        washMode: loc.washMode || 'DRIVER_INITIATED',
        phone: loc.phone || '',
        email: loc.email || '',
        isActive: loc.isActive,
        // Láthatóság
        visibility: loc.visibility || 'NETWORK_ONLY',
        dedicatedPartnerIds: loc.dedicatedPartnerIds || [],
        // Alvállalkozói cégadatok
        subcontractorCompanyName: loc.subcontractorCompanyName || '',
        subcontractorTaxNumber: loc.subcontractorTaxNumber || '',
        subcontractorAddress: loc.subcontractorAddress || '',
        subcontractorCity: loc.subcontractorCity || '',
        subcontractorZipCode: loc.subcontractorZipCode || '',
        subcontractorContactName: loc.subcontractorContactName || '',
        subcontractorContactPhone: loc.subcontractorContactPhone || '',
        subcontractorContactEmail: loc.subcontractorContactEmail || '',
        subcontractorBankAccount: loc.subcontractorBankAccount || '',
      });

      // Load services, opening hours, and partner companies
      const [services, packages, partners] = await Promise.all([
        networkAdminApi.listLocationServices(locationId),
        networkAdminApi.listServicePackages(),
        networkAdminApi.listPartnerCompanies(),
      ]);
      setLocationServices(services);
      setAllServicePackages(packages);
      setPartnerCompanies(partners.filter((p: PartnerCompany) => p.isActive));

      // Try to load opening hours
      try {
        const hoursData = await networkAdminApi.getLocationOpeningHours(locationId);
        if (hoursData.hours && hoursData.hours.length > 0) {
          setOpeningHours(hoursData.hours);
        }
      } catch {
        // If no hours exist yet, keep defaults
      }
    } catch (err: any) {
      setError(err.message || 'Hiba tortent');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setSaving(true);

    try {
      await networkAdminApi.updateLocation(locationId, {
        name: form.name,
        address: form.address || undefined,
        city: form.city || undefined,
        postalCode: form.zipCode || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        isActive: form.isActive,
        operationType: form.operationType,
        locationType: form.locationType,
        // Láthatóság
        visibility: form.visibility,
        dedicatedPartnerIds: form.visibility === 'DEDICATED' ? form.dedicatedPartnerIds : [],
        // Alvállalkozói cégadatok
        subcontractorCompanyName: form.subcontractorCompanyName || undefined,
        subcontractorTaxNumber: form.subcontractorTaxNumber || undefined,
        subcontractorAddress: form.subcontractorAddress || undefined,
        subcontractorCity: form.subcontractorCity || undefined,
        subcontractorZipCode: form.subcontractorZipCode || undefined,
        subcontractorContactName: form.subcontractorContactName || undefined,
        subcontractorContactPhone: form.subcontractorContactPhone || undefined,
        subcontractorContactEmail: form.subcontractorContactEmail || undefined,
        subcontractorBankAccount: form.subcontractorBankAccount || undefined,
      });
      setSuccessMessage('Helyszin sikeresen frissitve!');
      setTimeout(() => {
        router.push('/network-admin/locations');
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Hiba tortent a mentes soran');
    } finally {
      setSaving(false);
    }
  };

  const handleOpeningHourChange = (dayOfWeek: string, field: keyof OpeningHour, value: string | boolean) => {
    setOpeningHours(prev => prev.map(hour =>
      hour.dayOfWeek === dayOfWeek ? { ...hour, [field]: value } : hour
    ));
  };

  const handleSaveOpeningHours = async () => {
    setSavingHours(true);
    setHoursError('');
    setHoursSuccess('');

    try {
      // Validate times
      for (const hour of openingHours) {
        if (!hour.isClosed) {
          const openParts = hour.openTime.split(':').map(Number);
          const closeParts = hour.closeTime.split(':').map(Number);
          const openMinutes = openParts[0] * 60 + openParts[1];
          const closeMinutes = closeParts[0] * 60 + closeParts[1];

          if (closeMinutes <= openMinutes) {
            setHoursError(`${DAY_LABELS[hour.dayOfWeek]}: A zaras idopont nem lehet korabbi vagy egyenlo a nyitasnal`);
            setSavingHours(false);
            return;
          }
        }
      }

      await networkAdminApi.updateLocationOpeningHours(locationId, openingHours);
      setHoursSuccess('Nyitvatartas sikeresen mentve!');
      setTimeout(() => setHoursSuccess(''), 3000);
    } catch (err: any) {
      setHoursError(err.message || 'Hiba tortent a mentes soran');
    } finally {
      setSavingHours(false);
    }
  };

  const copyToAllDays = (sourceDay: string) => {
    const source = openingHours.find(h => h.dayOfWeek === sourceDay);
    if (source) {
      setOpeningHours(prev => prev.map(hour => ({
        ...hour,
        openTime: source.openTime,
        closeTime: source.closeTime,
        isClosed: source.isClosed,
      })));
    }
  };

  const setWeekdayHours = (openTime: string, closeTime: string) => {
    setOpeningHours(prev => prev.map(hour => {
      const isWeekday = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'].includes(hour.dayOfWeek);
      return isWeekday ? { ...hour, openTime, closeTime, isClosed: false } : hour;
    }));
  };

  const setWeekendClosed = () => {
    setOpeningHours(prev => prev.map(hour => {
      const isWeekend = ['SATURDAY', 'SUNDAY'].includes(hour.dayOfWeek);
      return isWeekend ? { ...hour, isClosed: true } : hour;
    }));
  };

  // Service functions
  const openAddService = () => {
    setSelectedServiceId('');
    setServiceError('');
    setServiceModal(true);
  };

  const addService = async () => {
    if (!selectedServiceId) {
      setServiceError('Valassz egy szolgaltatast');
      return;
    }

    setAddingService(true);
    setServiceError('');

    try {
      await networkAdminApi.addLocationService(locationId, selectedServiceId);
      const services = await networkAdminApi.listLocationServices(locationId);
      setLocationServices(services);
      setServiceModal(false);
    } catch (err: any) {
      setServiceError(err.message || 'Hiba tortent');
    } finally {
      setAddingService(false);
    }
  };

  const removeService = async (service: LocationService) => {
    if (!confirm(`Biztosan eltavolitod a "${service.servicePackageName}" szolgaltatast?`)) {
      return;
    }

    try {
      await networkAdminApi.removeLocationService(locationId, service.servicePackageId);
      const services = await networkAdminApi.listLocationServices(locationId);
      setLocationServices(services);
    } catch (err: any) {
      alert(err.message || 'Hiba tortent');
    }
  };

  // Get available services (not yet added to location)
  const availableServices = allServicePackages.filter(
    pkg => pkg.isActive && !locationServices.some(ls => ls.servicePackageId === pkg.id)
  );

  if (loading || isPlatformView) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">
          {isPlatformView ? 'Atiranyitas...' : 'Betoltes...'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/network-admin/locations/${locationId}`}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Helyszin szerkesztese</h1>
          <p className="text-gray-500 font-mono">{form.code}</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-green-600">
            {successMessage}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Helyszin neve *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-0 focus:outline-none"
              required
            />
          </div>

          {/* Code (read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Helyszin kod
            </label>
            <input
              type="text"
              value={form.code}
              disabled
              className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl bg-gray-50 text-gray-500 font-mono"
            />
            <p className="text-xs text-gray-500 mt-1">A kod nem modosithato</p>
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cim
            </label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="pl. Fo utca 1."
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-0 focus:outline-none"
            />
          </div>

          {/* City */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Iranyitoszam
              </label>
              <input
                type="text"
                value={form.zipCode}
                onChange={(e) => setForm({ ...form, zipCode: e.target.value })}
                placeholder="1234"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-0 focus:outline-none"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Varos
              </label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="Budapest"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-0 focus:outline-none"
              />
            </div>
          </div>

          {/* Operation Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Uzemeltetes tipusa
            </label>
            <select
              value={form.operationType}
              onChange={(e) => setForm({ ...form, operationType: e.target.value as 'OWN' | 'SUBCONTRACTOR' })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-0 focus:outline-none"
            >
              <option value="OWN">Sajat uzemeltetes</option>
              <option value="SUBCONTRACTOR">Alvallalkozo</option>
            </select>
          </div>

          {/* Location Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Moso tipusa
            </label>
            <select
              value={form.locationType}
              onChange={(e) => setForm({ ...form, locationType: e.target.value as 'CAR_WASH' | 'TRUCK_WASH' })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-0 focus:outline-none"
            >
              <option value="CAR_WASH">Automoso (1 rendszam)</option>
              <option value="TRUCK_WASH">Kamionmoso (vontato + potkocsi)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Automosonal csak egy rendszamot lehet megadni, kamionmosonal vontatot es potkocsit is.
            </p>
          </div>

          {/* Wash Mode */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mosas mod
            </label>
            <select
              value={form.washMode}
              onChange={(e) => setForm({ ...form, washMode: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-0 focus:outline-none"
            >
              <option value="DRIVER_INITIATED">Sofor inditja</option>
              <option value="OPERATOR_INITIATED">Operator inditja</option>
            </select>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Telefon
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+36 1 234 5678"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-0 focus:outline-none"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="helyszin@pelda.hu"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-0 focus:outline-none"
            />
          </div>

          {/* Active Status */}
          <div className="md:col-span-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="font-medium text-gray-700">Aktiv helyszin</span>
            </label>
            <p className="text-sm text-gray-500 mt-1 ml-8">
              Inaktiv helyszinen nem lehet mosast inditani.
            </p>
          </div>
        </div>

        {/* Láthatóság szekció */}
        <div className="pt-6 border-t border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Helyszin lathatosaga</h3>
          <div className="space-y-4">
            {/* Visibility dropdown */}
            <div className="max-w-md">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ki lathassa ezt a helyszint?
              </label>
              <select
                value={form.visibility}
                onChange={(e) => setForm({ ...form, visibility: e.target.value as LocationVisibility, dedicatedPartnerIds: [] })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-0 focus:outline-none"
              >
                <option value="PUBLIC">Publikus - Mindenki lathassa (privat ugyfelek is)</option>
                <option value="NETWORK_ONLY">Network Only - Csak a halozat soforfei</option>
                <option value="DEDICATED">Dedikalt - Csak kivalasztott partnerek</option>
              </select>
              <p className="text-xs text-gray-500 mt-2">
                {form.visibility === 'PUBLIC' && (
                  <>A helyszin megjelenik minden privat ugyfelenek es mas halozatok soforjeinek is.</>
                )}
                {form.visibility === 'NETWORK_ONLY' && (
                  <>A helyszin csak a sajat halozat flotta soforjeinek jelenik meg.</>
                )}
                {form.visibility === 'DEDICATED' && (
                  <>A helyszin csak a kivalasztott partnerek soforjeinek jelenik meg.</>
                )}
              </p>
            </div>

            {/* Dedicated partner selector - csak DEDICATED módnál */}
            {form.visibility === 'DEDICATED' && (
              <div className="max-w-md">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Kivalasztott partnerek *
                </label>
                {partnerCompanies.length === 0 ? (
                  <p className="text-gray-500 text-sm">Nincsenek aktiv partnerek a halozatban.</p>
                ) : (
                  <div className="border-2 border-gray-200 rounded-xl p-3 space-y-2 max-h-60 overflow-y-auto">
                    {partnerCompanies.map((partner) => (
                      <label key={partner.id} className="flex items-center gap-3 cursor-pointer p-2 hover:bg-gray-50 rounded-lg">
                        <input
                          type="checkbox"
                          checked={form.dedicatedPartnerIds.includes(partner.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setForm({ ...form, dedicatedPartnerIds: [...form.dedicatedPartnerIds, partner.id] });
                            } else {
                              setForm({ ...form, dedicatedPartnerIds: form.dedicatedPartnerIds.filter(id => id !== partner.id) });
                            }
                          }}
                          className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="text-gray-700">{partner.name}</span>
                        {partner.code && <span className="text-xs text-gray-400">({partner.code})</span>}
                      </label>
                    ))}
                  </div>
                )}
                {form.dedicatedPartnerIds.length > 0 && (
                  <p className="text-xs text-green-600 mt-2">
                    {form.dedicatedPartnerIds.length} partner kivalasztva
                  </p>
                )}
                {form.visibility === 'DEDICATED' && form.dedicatedPartnerIds.length === 0 && (
                  <p className="text-xs text-amber-600 mt-2">
                    Legalabb egy partnert ki kell valasztani a Dedikalt lathatosaghoz.
                  </p>
                )}
              </div>
            )}

            {/* Info box */}
            <div className="bg-blue-50 rounded-xl p-4 max-w-2xl">
              <p className="text-sm text-blue-700">
                <strong>Lathatosag magyarazat:</strong>
              </p>
              <ul className="text-sm text-blue-600 mt-2 space-y-1">
                <li><strong>Publikus:</strong> Privat ugyfelek es minden halozat soferfei latjak.</li>
                <li><strong>Network Only:</strong> Csak a sajat halozat soferfei latjak (nem jelenik meg privat ugyfeleknek).</li>
                <li><strong>Dedikalt:</strong> Csak a kivalasztott partnerek soferfei latjak.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Alvállalkozói cégadatok - csak SUBCONTRACTOR típusnál */}
        {form.operationType === 'SUBCONTRACTOR' && (
          <div className="pt-6 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Alvallalkozo cegadatok</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Cégnév */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cegnev *
                </label>
                <input
                  type="text"
                  value={form.subcontractorCompanyName}
                  onChange={(e) => setForm({ ...form, subcontractorCompanyName: e.target.value })}
                  placeholder="Pelda Mosoda Kft."
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-0 focus:outline-none"
                />
              </div>

              {/* Adószám */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Adoszam *
                </label>
                <input
                  type="text"
                  value={form.subcontractorTaxNumber}
                  onChange={(e) => setForm({ ...form, subcontractorTaxNumber: e.target.value })}
                  placeholder="12345678-1-23"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-0 focus:outline-none"
                />
              </div>

              {/* Székhely cím */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Szekhely cim
                </label>
                <input
                  type="text"
                  value={form.subcontractorAddress}
                  onChange={(e) => setForm({ ...form, subcontractorAddress: e.target.value })}
                  placeholder="Fo utca 1."
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-0 focus:outline-none"
                />
              </div>

              {/* Város és irányítószám */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Iranyitoszam
                  </label>
                  <input
                    type="text"
                    value={form.subcontractorZipCode}
                    onChange={(e) => setForm({ ...form, subcontractorZipCode: e.target.value })}
                    placeholder="1234"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-0 focus:outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Varos
                  </label>
                  <input
                    type="text"
                    value={form.subcontractorCity}
                    onChange={(e) => setForm({ ...form, subcontractorCity: e.target.value })}
                    placeholder="Budapest"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-0 focus:outline-none"
                  />
                </div>
              </div>

              {/* Kapcsolattartó neve */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Kapcsolattarto neve
                </label>
                <input
                  type="text"
                  value={form.subcontractorContactName}
                  onChange={(e) => setForm({ ...form, subcontractorContactName: e.target.value })}
                  placeholder="Kiss Peter"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-0 focus:outline-none"
                />
              </div>

              {/* Kapcsolattartó telefon */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Kapcsolattarto telefon
                </label>
                <input
                  type="tel"
                  value={form.subcontractorContactPhone}
                  onChange={(e) => setForm({ ...form, subcontractorContactPhone: e.target.value })}
                  placeholder="+36 30 123 4567"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-0 focus:outline-none"
                />
              </div>

              {/* Kapcsolattartó email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Kapcsolattarto email
                </label>
                <input
                  type="email"
                  value={form.subcontractorContactEmail}
                  onChange={(e) => setForm({ ...form, subcontractorContactEmail: e.target.value })}
                  placeholder="kapcsolat@pelda.hu"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-0 focus:outline-none"
                />
              </div>

              {/* Bankszámlaszám */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bankszamlaszam
                </label>
                <input
                  type="text"
                  value={form.subcontractorBankAccount}
                  onChange={(e) => setForm({ ...form, subcontractorBankAccount: e.target.value })}
                  placeholder="12345678-12345678-12345678"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-0 focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-gray-100">
          <Link
            href="/network-admin/locations"
            className="px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
          >
            Megse
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 transition-colors disabled:bg-gray-300"
          >
            {saving ? 'Mentes...' : 'Mentes'}
          </button>
        </div>
      </form>

      {/* Opening Hours Section */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Nyitvatartas</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setWeekdayHours('06:00', '22:00')}
              className="px-3 py-1 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
            >
              H-P: 6-22
            </button>
            <button
              onClick={setWeekendClosed}
              className="px-3 py-1 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Hetvege zarva
            </button>
          </div>
        </div>

        {hoursError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 mb-4">
            {hoursError}
          </div>
        )}

        {hoursSuccess && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-green-600 mb-4">
            {hoursSuccess}
          </div>
        )}

        <div className="space-y-3">
          {openingHours.map((hour) => (
            <div key={hour.dayOfWeek} className="flex items-center gap-4 py-3 border-b border-gray-100 last:border-0">
              <div className="w-28 font-medium text-gray-700">
                {DAY_LABELS[hour.dayOfWeek]}
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={hour.isClosed}
                  onChange={(e) => handleOpeningHourChange(hour.dayOfWeek, 'isClosed', e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                <span className="text-sm text-gray-500">Zarva</span>
              </label>

              {!hour.isClosed && (
                <>
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={hour.openTime}
                      onChange={(e) => handleOpeningHourChange(hour.dayOfWeek, 'openTime', e.target.value)}
                      className="px-3 py-2 border border-gray-200 rounded-lg focus:border-primary-500 focus:ring-0 focus:outline-none"
                    />
                    <span className="text-gray-400">-</span>
                    <input
                      type="time"
                      value={hour.closeTime}
                      onChange={(e) => handleOpeningHourChange(hour.dayOfWeek, 'closeTime', e.target.value)}
                      className="px-3 py-2 border border-gray-200 rounded-lg focus:border-primary-500 focus:ring-0 focus:outline-none"
                    />
                  </div>

                  <button
                    onClick={() => copyToAllDays(hour.dayOfWeek)}
                    className="text-xs text-primary-600 hover:text-primary-700"
                    title="Masolas minden napra"
                  >
                    Minden napra
                  </button>
                </>
              )}

              {hour.isClosed && (
                <span className="text-red-500 text-sm font-medium">Zarva</span>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={handleSaveOpeningHours}
            disabled={savingHours}
            className="px-6 py-3 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 transition-colors disabled:bg-gray-300"
          >
            {savingHours ? 'Mentes...' : 'Nyitvatartas mentese'}
          </button>
        </div>
      </div>

      {/* Services Section */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Elerheto szolgaltatasok</h2>
          <button
            onClick={openAddService}
            disabled={availableServices.length === 0}
            className="px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors text-sm disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            + Szolgaltatas hozzaadasa
          </button>
        </div>

        {locationServices.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <p>Nincsenek szolgaltatasok ehhez a helyszinhez.</p>
            <p className="text-sm mt-1">Add hozza a szolgaltatasokat, hogy a soforok kivalaszthassak.</p>
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
                  title="Eltavolitas"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 bg-amber-50 rounded-xl p-4">
          <p className="text-sm text-amber-700">
            <strong>Fontos:</strong> Csak azok a szolgaltatasok jelennek meg a soforoknek, amelyek itt hozza vannak adva.
            Az arakat a <Link href="/network-admin/prices" className="underline">Szolgaltatasok</Link> menuben tudod beallitani.
          </p>
        </div>
      </div>

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
                <h2 className="text-xl font-bold text-gray-900">Szolgaltatas hozzaadasa</h2>
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
                  Valassz szolgaltatast *
                </label>
                {availableServices.length === 0 ? (
                  <p className="text-gray-500 text-sm">Minden szolgaltatas mar hozza van adva.</p>
                ) : (
                  <select
                    value={selectedServiceId}
                    onChange={(e) => setSelectedServiceId(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-0 focus:outline-none"
                  >
                    <option value="">-- Valassz --</option>
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
                Megse
              </button>
              <button
                onClick={addService}
                disabled={addingService || availableServices.length === 0}
                className="flex-1 py-3 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 transition-colors disabled:bg-gray-300"
              >
                {addingService ? 'Hozzaadas...' : 'Hozzaadas'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
