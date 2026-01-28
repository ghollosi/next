'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { fetchOperatorApi, getNetworkId, isPlatformViewMode } from '@/lib/network-admin-api';
import { useSubscription } from '@/contexts/SubscriptionContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

interface ExchangeRateData {
  currency: string;
  rate: number;
  date: string;
  source: 'MNB' | 'ECB';
}

interface ServicePackage {
  id: string;
  code: string;
  name: string;
}

interface ServicePrice {
  id: string;
  servicePackageId: string;
  vehicleType: string;
  price: number;
  currency: string;
  isActive: boolean;
  servicePackage: {
    id: string;
    code: string;
    name: string;
  };
}

// Vehicle type labels in Hungarian
const vehicleTypeLabels: Record<string, string> = {
  SEMI_TRUCK: 'Nyerges szerelvény',
  GRAIN_CARRIER: 'Gabonaszállító',
  TRAILER_ONLY: 'Csak pótkocsi',
  CONTAINER_CARRIER: 'Konténer szállító',
  TRACTOR: 'Traktor',
  TRUCK_1_5T: 'Tehergépjármű 1,5 t-ig',
  TRUCK_3_5T: 'Tehergépjármű 3,5t-ig',
  TRUCK_7_5T: 'Tehergépjármű 7,5t-ig',
  TRUCK_12T: 'Tehergépjármű 12t-ig',
  TRUCK_12T_PLUS: 'Tehergépjármű 12t felett',
  TANK_SOLO: 'Tartályautó (szóló)',
  TANK_12T: 'Tartályautó 12t-ig',
  TANK_TRUCK: 'Tartályautó',
  TANK_SEMI_TRAILER: 'Tartályfélpótkocsi',
  TANDEM_7_5T: 'Tandem 7,5t-ig',
  TANDEM_7_5T_PLUS: 'Tandem 7,5t felett',
  SILO: 'Siló',
  SILO_TANDEM: 'Siló (tandem)',
  TIPPER_MIXER: 'Billencs, Mixer',
  CAR_CARRIER: 'Autószállító',
  MINIBUS: 'Kisbusz (8-9 személyes)',
  MIDIBUS: 'Nagybusz (14-15 személyes)',
  BUS: 'Autóbusz',
  CAR: 'Személygépkocsi',
  SUV_MPV: 'Egyterű, terepjáró',
  MACHINERY: 'Munkagép',
  FORKLIFT: 'Targonca',
  MOTORCYCLE: 'Motorkerékpár',
  BUILDING_PARTS: 'Épület / Alkatrész mosás',
  CHILD_SEAT: 'Gyerekülés',
};

const vehicleTypeOrder = [
  'SEMI_TRUCK',
  'GRAIN_CARRIER',
  'TRAILER_ONLY',
  'CONTAINER_CARRIER',
  'TRACTOR',
  'TRUCK_1_5T',
  'TRUCK_3_5T',
  'TRUCK_7_5T',
  'TRUCK_12T',
  'TRUCK_12T_PLUS',
  'TANK_SOLO',
  'TANK_12T',
  'TANK_TRUCK',
  'TANK_SEMI_TRAILER',
  'TANDEM_7_5T',
  'TANDEM_7_5T_PLUS',
  'SILO',
  'SILO_TANDEM',
  'TIPPER_MIXER',
  'CAR_CARRIER',
  'MINIBUS',
  'MIDIBUS',
  'BUS',
  'CAR',
  'SUV_MPV',
  'MACHINERY',
  'FORKLIFT',
  'MOTORCYCLE',
  'BUILDING_PARTS',
  'CHILD_SEAT',
];

export default function PricesPage() {
  const { isReadOnly } = useSubscription();
  const [servicePackages, setServicePackages] = useState<ServicePackage[]>([]);
  const [prices, setPrices] = useState<ServicePrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editedPrices, setEditedPrices] = useState<Record<string, number>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [exchangeRates, setExchangeRates] = useState<{ ecb: ExchangeRateData[] }>({ ecb: [] });
  const [ratesLoading, setRatesLoading] = useState(true);
  const [isPlatformView, setIsPlatformView] = useState(false);

  useEffect(() => {
    // Check Platform View mode on client side
    setIsPlatformView(isPlatformViewMode());
  }, []);

  useEffect(() => {
    loadData();
    loadExchangeRates();
  }, []);

  async function loadExchangeRates() {
    try {
      setRatesLoading(true);
      const response = await fetch(`${API_URL}/exchange-rates`);
      if (response.ok) {
        const data = await response.json();
        setExchangeRates(data);
      }
    } catch (err) {
      console.error('Exchange rates load error:', err);
    } finally {
      setRatesLoading(false);
    }
  }

  async function loadData() {
    try {
      setLoading(true);
      setError('');

      const [packagesRes, pricesRes] = await Promise.all([
        fetchOperatorApi<ServicePackage[]>('/operator/billing/service-packages'),
        fetchOperatorApi<ServicePrice[]>('/operator/billing/prices'),
      ]);

      setServicePackages(packagesRes);
      setPrices(pricesRes);
    } catch (err: any) {
      setError(err.message || 'Nem sikerült betölteni az adatokat');
    } finally {
      setLoading(false);
    }
  }

  function getPrice(servicePackageId: string, vehicleType: string): number | null {
    const key = `${servicePackageId}_${vehicleType}`;
    if (editedPrices[key] !== undefined) {
      return editedPrices[key];
    }
    const price = prices.find(
      (p) => p.servicePackageId === servicePackageId && p.vehicleType === vehicleType
    );
    return price ? Number(price.price) : null;
  }

  function handlePriceChange(servicePackageId: string, vehicleType: string, value: string) {
    const key = `${servicePackageId}_${vehicleType}`;
    const numValue = value === '' ? 0 : parseFloat(value);

    setEditedPrices((prev) => ({
      ...prev,
      [key]: numValue,
    }));
    setHasChanges(true);
  }

  async function handleSave() {
    if (!hasChanges) return;

    try {
      setSaving(true);
      setError('');

      const updates: Array<{ serviceCode: string; vehicleType: string; price: number }> = [];

      for (const [key, price] of Object.entries(editedPrices)) {
        const [servicePackageId, vehicleType] = key.split('_');
        const servicePackage = servicePackages.find((sp) => sp.id === servicePackageId);
        if (servicePackage) {
          updates.push({
            serviceCode: servicePackage.code,
            vehicleType,
            price,
          });
        }
      }

      await fetchOperatorApi('/operator/billing/prices/bulk', {
        method: 'POST',
        body: JSON.stringify({ prices: updates }),
      });

      // Reload data
      await loadData();
      setEditedPrices({});
      setHasChanges(false);
    } catch (err: any) {
      setError(err.message || 'Nem sikerült menteni az árakat');
    } finally {
      setSaving(false);
    }
  }

  async function handleExport() {
    try {
      const networkId = getNetworkId();
      if (!networkId) throw new Error('Nincs bejelentkezve');

      const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
      const response = await fetch(`${API_URL}/operator/billing/prices/export`, {
        headers: { 'x-network-id': networkId },
      });

      if (!response.ok) {
        throw new Error('Nem sikerült exportálni');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `arlista_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError(err.message || 'Hiba az exportálásnál');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Betöltés...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Árlista</h1>
          <p className="text-gray-500 mt-1">
            {isPlatformView ? 'Szolgáltatás árak megtekintése' : 'Szolgáltatás árak kezelése'}
          </p>
        </div>
        <div className="flex gap-3">
          {!isReadOnly && (
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
            >
              Excel letöltés
            </button>
          )}
          {!isPlatformView && !isReadOnly && (
            <Link
              href="/network-admin/prices/upload"
              className="px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
            >
              Excel feltöltés
            </Link>
          )}
          {!isPlatformView && !isReadOnly && hasChanges && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Mentés...' : 'Változások mentése'}
            </button>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="text-2xl font-bold text-gray-900">{servicePackages.length}</div>
          <div className="text-sm text-gray-500">Szolgáltatás</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="text-2xl font-bold text-gray-900">{vehicleTypeOrder.length}</div>
          <div className="text-sm text-gray-500">Járműtípus</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="text-2xl font-bold text-gray-900">{prices.length}</div>
          <div className="text-sm text-gray-500">Beállított ár</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="text-2xl font-bold text-gray-900">
            {Object.keys(editedPrices).length}
          </div>
          <div className="text-sm text-gray-500">Módosítva</div>
        </div>
      </div>

      {/* Exchange Rates */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl shadow-sm p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Aktuális árfolyamok (ECB)
          </h3>
          <button
            onClick={loadExchangeRates}
            disabled={ratesLoading}
            className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors disabled:opacity-50"
          >
            {ratesLoading ? 'Frissítés...' : 'Frissítés'}
          </button>
        </div>
        {ratesLoading ? (
          <div className="text-sm text-gray-500">Árfolyamok betöltése...</div>
        ) : exchangeRates.ecb.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {exchangeRates.ecb
              .filter(rate => ['USD', 'GBP', 'CHF', 'PLN', 'CZK', 'RON', 'HUF'].includes(rate.currency))
              .map(rate => (
                <div key={rate.currency} className="bg-white rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-gray-900">{rate.rate.toFixed(4)}</div>
                  <div className="text-xs text-gray-500">1 EUR = {rate.currency}</div>
                </div>
              ))}
          </div>
        ) : (
          <div className="text-sm text-gray-500">Nem sikerült betölteni az árfolyamokat</div>
        )}
        <p className="text-xs text-gray-400 mt-2 text-center">
          Forrás: Európai Központi Bank (ECB) - naponta frissül
        </p>
      </div>

      {/* Price table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="sticky left-0 bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                  Járműtípus
                </th>
                {servicePackages.map((sp) => (
                  <th
                    key={sp.id}
                    className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap"
                    title={sp.code}
                  >
                    {sp.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {vehicleTypeOrder.map((vehicleType) => (
                <tr key={vehicleType} className="hover:bg-gray-50">
                  <td className="sticky left-0 bg-white px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap border-r border-gray-100">
                    {vehicleTypeLabels[vehicleType] || vehicleType}
                  </td>
                  {servicePackages.map((sp) => {
                    const price = getPrice(sp.id, vehicleType);
                    const key = `${sp.id}_${vehicleType}`;
                    const isEdited = editedPrices[key] !== undefined;

                    return (
                      <td key={sp.id} className="px-2 py-2 text-center">
                        {isPlatformView ? (
                          <span className="inline-block w-20 px-2 py-1 text-sm text-center bg-gray-50 border border-gray-200 rounded-lg">
                            {price !== null ? price.toLocaleString('hu-HU') : '-'}
                          </span>
                        ) : (
                          <input
                            type="number"
                            value={price ?? ''}
                            onChange={(e) => handlePriceChange(sp.id, vehicleType, e.target.value)}
                            className={`w-20 px-2 py-1 text-sm text-center border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
                              isEdited
                                ? 'bg-yellow-50 border-yellow-300'
                                : 'border-gray-200'
                            }`}
                            placeholder="-"
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer with save button - only for non-platform-view */}
      {!isPlatformView && !isReadOnly && hasChanges && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Mentés...' : `Változások mentése (${Object.keys(editedPrices).length} ár)`}
          </button>
        </div>
      )}
    </div>
  );
}
