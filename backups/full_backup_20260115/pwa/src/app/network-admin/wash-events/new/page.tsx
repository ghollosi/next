'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetchOperatorApi, getNetworkId } from '@/lib/network-admin-api';

interface Location {
  id: string;
  code: string;
  name: string;
}

interface ServicePackage {
  id: string;
  code: string;
  name: string;
}

interface PartnerCompany {
  id: string;
  code: string;
  name: string;
  billingName?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const OPERATOR_ID = 'operator-1';

type PaymentMode = 'CONTRACT' | 'CASH' | 'CARD';

export default function NewWashEventPage() {
  const router = useRouter();
  const [locations, setLocations] = useState<Location[]>([]);
  const [services, setServices] = useState<ServicePackage[]>([]);
  const [partnerCompanies, setPartnerCompanies] = useState<PartnerCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('CONTRACT');
  const [tractorPlate, setTractorPlate] = useState('');
  const [trailerPlate, setTrailerPlate] = useState('');
  const [driverName, setDriverName] = useState('');

  useEffect(() => {
    loadFormData();
  }, []);

  const loadFormData = async () => {
    try {
      // Load locations and partner companies in parallel
      const [locData, partnerData] = await Promise.all([
        fetchOperatorApi<Location[]>('/operator/locations'),
        fetchOperatorApi<PartnerCompany[]>('/operator/partner-companies'),
      ]);

      setLocations(locData);
      if (locData.length > 0) {
        setSelectedLocationId(locData[0].id);
        // Load services for first location
        const svcData = await fetchOperatorApi<ServicePackage[]>(
          `/operator/locations/${locData[0].id}/services`
        );
        setServices(svcData);
        if (svcData.length > 0) {
          setSelectedServiceId(svcData[0].id);
        }
      }

      setPartnerCompanies(partnerData);
      if (partnerData.length > 0) {
        setSelectedPartnerId(partnerData[0].id);
      }
    } catch (err) {
      console.error('Failed to load form data', err);
    } finally {
      setLoading(false);
    }
  };

  // Load services when location changes
  const handleLocationChange = async (locationId: string) => {
    setSelectedLocationId(locationId);
    setSelectedServiceId('');
    setServices([]);

    try {
      const svcData = await fetchOperatorApi<ServicePackage[]>(
        `/operator/locations/${locationId}/services`
      );
      setServices(svcData);
      if (svcData.length > 0) {
        setSelectedServiceId(svcData[0].id);
      }
    } catch (err) {
      console.error('Failed to load services', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const networkId = getNetworkId();
    if (!networkId) {
      setError('Nincs bejelentkezve');
      setSubmitting(false);
      return;
    }

    try {
      // For CONTRACT payment mode, partner company is required
      // For CASH/CARD, we might create a walk-in partner or skip it
      const body: Record<string, any> = {
        locationId: selectedLocationId,
        servicePackageId: selectedServiceId,
        tractorPlateManual: tractorPlate.toUpperCase(),
        trailerPlateManual: trailerPlate.toUpperCase() || undefined,
        driverNameManual: driverName,
      };

      if (paymentMode === 'CONTRACT' && selectedPartnerId) {
        body.partnerCompanyId = selectedPartnerId;
      } else {
        // For cash/card payments, use the first partner company as default
        // In production, you'd have a "walk-in" partner company
        body.partnerCompanyId = selectedPartnerId || partnerCompanies[0]?.id;
      }

      const response = await fetch(`${API_URL}/operator/wash-events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-network-id': networkId,
          'x-user-id': OPERATOR_ID,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to create wash event');
      }

      const washEvent = await response.json();
      router.push(`/network-admin/wash-events/${washEvent.id}`);
    } catch (err: any) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Betöltés...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/network-admin/wash-events"
          className="text-primary-600 hover:text-primary-700 text-sm font-medium"
        >
          ← Vissza a mosásokhoz
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Új mosás</h1>
        <p className="text-gray-500">Manuális mosás rögzítése</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 space-y-6">
        {/* Payment Mode */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Fizetési mód *
          </label>
          <div className="flex gap-4">
            {[
              { value: 'CONTRACT', label: 'Szerződéses (számlás)' },
              { value: 'CASH', label: 'Készpénz' },
              { value: 'CARD', label: 'Bankkártya' },
            ].map((option) => (
              <label
                key={option.value}
                className={`flex-1 px-4 py-3 border rounded-xl cursor-pointer text-center transition-colors
                  ${paymentMode === option.value
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-300 hover:bg-gray-50'
                  }`}
              >
                <input
                  type="radio"
                  name="paymentMode"
                  value={option.value}
                  checked={paymentMode === option.value}
                  onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
                  className="sr-only"
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>

        {/* Partner Company - only for CONTRACT */}
        {paymentMode === 'CONTRACT' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Megrendelő cég *
            </label>
            <select
              value={selectedPartnerId}
              onChange={(e) => setSelectedPartnerId(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Válassz céget...</option>
              {partnerCompanies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name} ({company.code})
                </option>
              ))}
            </select>
            <p className="mt-1 text-sm text-gray-500">
              A számla erre a cégre kerül kiállításra.
            </p>
          </div>
        )}

        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Helyszín *
          </label>
          <select
            value={selectedLocationId}
            onChange={(e) => handleLocationChange(e.target.value)}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name} ({loc.code})
              </option>
            ))}
          </select>
        </div>

        {/* Service */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Szolgáltatás *
          </label>
          <select
            value={selectedServiceId}
            onChange={(e) => setSelectedServiceId(e.target.value)}
            required
            disabled={services.length === 0}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100"
          >
            {services.length === 0 ? (
              <option value="">Nincs elérhető szolgáltatás</option>
            ) : (
              services.map((svc) => (
                <option key={svc.id} value={svc.id}>
                  {svc.name} ({svc.code})
                </option>
              ))
            )}
          </select>
        </div>

        {/* Tractor Plate */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Vontató rendszáma *
          </label>
          <input
            type="text"
            value={tractorPlate}
            onChange={(e) => setTractorPlate(e.target.value.toUpperCase())}
            required
            placeholder="ABC-123"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono uppercase"
          />
        </div>

        {/* Trailer Plate */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Pótkocsi rendszáma (opcionális)
          </label>
          <input
            type="text"
            value={trailerPlate}
            onChange={(e) => setTrailerPlate(e.target.value.toUpperCase())}
            placeholder="XYZ-456"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono uppercase"
          />
        </div>

        {/* Driver Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Sofőr neve *
          </label>
          <input
            type="text"
            value={driverName}
            onChange={(e) => setDriverName(e.target.value)}
            required
            placeholder="Kiss János"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-4">
          <Link
            href="/network-admin/wash-events"
            className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl text-center hover:bg-gray-200 transition-colors"
          >
            Mégse
          </Link>
          <button
            type="submit"
            disabled={
              submitting ||
              !selectedLocationId ||
              !selectedServiceId ||
              !tractorPlate ||
              !driverName ||
              (paymentMode === 'CONTRACT' && !selectedPartnerId)
            }
            className="flex-1 py-3 bg-primary-600 text-white font-medium rounded-xl
                       hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors"
          >
            {submitting ? 'Létrehozás...' : 'Mosás indítása'}
          </button>
        </div>
      </form>
    </div>
  );
}
