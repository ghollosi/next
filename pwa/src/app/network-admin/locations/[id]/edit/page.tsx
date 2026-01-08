'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { networkAdminApi, fetchOperatorApi } from '@/lib/network-admin-api';

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
  phone?: string;
  email?: string;
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
}

export default function LocationEditPage() {
  const params = useParams();
  const router = useRouter();
  const locationId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [form, setForm] = useState({
    name: '',
    code: '',
    address: '',
    city: '',
    zipCode: '',
    operationType: 'OWN' as 'OWN' | 'SUBCONTRACTOR',
    washMode: 'DRIVER_INITIATED',
    openingHours: '',
    phone: '',
    email: '',
    isActive: true,
  });

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
        setError('Helyszín nem található');
        return;
      }
      setForm({
        name: loc.name || '',
        code: loc.code || '',
        address: loc.address || '',
        city: loc.city || '',
        zipCode: loc.zipCode || '',
        operationType: loc.operationType || 'OWN',
        washMode: loc.washMode || 'DRIVER_INITIATED',
        openingHours: loc.openingHours || '',
        phone: loc.phone || '',
        email: loc.email || '',
        isActive: loc.isActive,
      });

      // Load services
      const [services, packages] = await Promise.all([
        networkAdminApi.listLocationServices(locationId),
        networkAdminApi.listServicePackages(),
      ]);
      setLocationServices(services);
      setAllServicePackages(packages);
    } catch (err: any) {
      setError(err.message || 'Hiba történt');
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
        openingHours: form.openingHours || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        isActive: form.isActive,
      });
      setSuccessMessage('Helyszín sikeresen frissítve!');
      setTimeout(() => {
        router.push('/network-admin/locations');
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Hiba történt a mentés során');
    } finally {
      setSaving(false);
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
    if (!confirm(`Biztosan eltávolítod a "${service.servicePackageName}" szolgáltatást?`)) {
      return;
    }

    try {
      await networkAdminApi.removeLocationService(locationId, service.servicePackageId);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Betöltés...</div>
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
          <h1 className="text-2xl font-bold text-gray-900">Helyszín szerkesztése</h1>
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
              Helyszín neve *
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
              Helyszín kód
            </label>
            <input
              type="text"
              value={form.code}
              disabled
              className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl bg-gray-50 text-gray-500 font-mono"
            />
            <p className="text-xs text-gray-500 mt-1">A kód nem módosítható</p>
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cím
            </label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="pl. Fő utca 1."
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-0 focus:outline-none"
            />
          </div>

          {/* City */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Irányítószám
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
                Város
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
              Üzemeltetés típusa
            </label>
            <select
              value={form.operationType}
              onChange={(e) => setForm({ ...form, operationType: e.target.value as 'OWN' | 'SUBCONTRACTOR' })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-0 focus:outline-none"
            >
              <option value="OWN">Saját üzemeltetés</option>
              <option value="SUBCONTRACTOR">Alvállalkozó</option>
            </select>
          </div>

          {/* Wash Mode */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mosás mód
            </label>
            <select
              value={form.washMode}
              onChange={(e) => setForm({ ...form, washMode: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-0 focus:outline-none"
            >
              <option value="DRIVER_INITIATED">Sofőr indítja</option>
              <option value="OPERATOR_INITIATED">Operátor indítja</option>
            </select>
          </div>

          {/* Opening Hours */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nyitvatartás
            </label>
            <input
              type="text"
              value={form.openingHours}
              onChange={(e) => setForm({ ...form, openingHours: e.target.value })}
              placeholder="pl. H-P: 6:00-22:00, Szo-V: 8:00-20:00"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-0 focus:outline-none"
            />
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
              <span className="font-medium text-gray-700">Aktív helyszín</span>
            </label>
            <p className="text-sm text-gray-500 mt-1 ml-8">
              Inaktív helyszínen nem lehet mosást indítani.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-gray-100">
          <Link
            href="/network-admin/locations"
            className="px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
          >
            Mégse
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 transition-colors disabled:bg-gray-300"
          >
            {saving ? 'Mentés...' : 'Mentés'}
          </button>
        </div>
      </form>

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
            <p className="text-sm mt-1">Add hozzá a szolgáltatásokat, hogy a sofőrök kiválaszthassák.</p>
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

        <div className="mt-4 bg-amber-50 rounded-xl p-4">
          <p className="text-sm text-amber-700">
            <strong>Fontos:</strong> Csak azok a szolgáltatások jelennek meg a sofőröknek, amelyek itt hozzá vannak adva.
            Az árakat a <Link href="/network-admin/prices" className="underline">Szolgáltatások</Link> menüben tudod beállítani.
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
                  <p className="text-gray-500 text-sm">Minden szolgáltatás már hozzá van adva.</p>
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
    </div>
  );
}
