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
}

interface QRCodeData {
  locationId: string;
  locationCode: string;
  locationName: string;
  washUrl: string;
  qrCodeDataUrl: string;
  size: number;
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

  useEffect(() => {
    loadData();
  }, [locationId]);

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

      {/* Location Info Card */}
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
    </div>
  );
}
