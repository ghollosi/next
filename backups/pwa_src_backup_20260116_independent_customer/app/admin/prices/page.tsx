'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const NETWORK_ID = 'cf808392-6283-4487-9fbd-e72951ca5bf8';

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
  // Nyerges szerelvenyek
  SEMI_TRUCK: 'Nyerges szerelveny',

  // Gabonaszallito
  GRAIN_CARRIER: 'Gabonaszallito',

  // Potkocsik
  TRAILER_ONLY: 'Csak potkocsi',

  // Kontenerszallito
  CONTAINER_CARRIER: 'Kontener szallito',

  // Traktor
  TRACTOR: 'Traktor',

  // Tehergepjarmuvek suly szerint
  TRUCK_1_5T: 'Tehergepjarmu 1,5 t-ig',
  TRUCK_3_5T: 'Tehergepjarmu 3,5t-ig',
  TRUCK_7_5T: 'Tehergepjarmu 7,5t-ig',
  TRUCK_12T: 'Tehergepjarmu 12t-ig',
  TRUCK_12T_PLUS: 'Tehergepjarmu 12t felett',

  // Tartalyautok
  TANK_SOLO: 'Tartalyauto (szolo)',
  TANK_12T: 'Tartalyauto 12t-ig',
  TANK_TRUCK: 'Tartalyauto',
  TANK_SEMI_TRAILER: 'Tartalyfelpotkocsi',

  // Tandem
  TANDEM_7_5T: 'Tandem 7,5t-ig',
  TANDEM_7_5T_PLUS: 'Tandem 7,5t felett',

  // Silo
  SILO: 'Silo',
  SILO_TANDEM: 'Silo (tandem)',

  // Specialis
  TIPPER_MIXER: 'Billencs, Mixer',
  CAR_CARRIER: 'Autoszallito',

  // Buszok
  MINIBUS: 'Kisbusz (8-9 szemelyes)',
  MIDIBUS: 'Nagybusz (14-15 szemelyes)',
  BUS: 'Autobusz',

  // Szemelygepkocsik
  CAR: 'Szemelygepkocsi',
  SUV_MPV: 'Egyteru, terepjaro',

  // Munkagepek
  MACHINERY: 'Munkagep',
  FORKLIFT: 'Targonca',

  // Egyeb
  MOTORCYCLE: 'Motorkerekpar',

  // Specialis mosasok
  BUILDING_PARTS: 'Epulet / Alkatresz mosas',
  CHILD_SEAT: 'Gyerekules',
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
  const [servicePackages, setServicePackages] = useState<ServicePackage[]>([]);
  const [prices, setPrices] = useState<ServicePrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editedPrices, setEditedPrices] = useState<Record<string, number>>({});
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError('');

      const [packagesRes, pricesRes] = await Promise.all([
        fetch(`${API_URL}/operator/billing/service-packages`, {
          headers: { 'x-network-id': NETWORK_ID },
        }),
        fetch(`${API_URL}/operator/billing/prices`, {
          headers: { 'x-network-id': NETWORK_ID },
        }),
      ]);

      if (!packagesRes.ok || !pricesRes.ok) {
        throw new Error('Nem sikerult betolteni az adatokat');
      }

      const packagesData = await packagesRes.json();
      const pricesData = await pricesRes.json();

      setServicePackages(packagesData);
      setPrices(pricesData);
    } catch (err: any) {
      setError(err.message || 'Hiba tortent');
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

      const response = await fetch(`${API_URL}/operator/billing/prices/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-network-id': NETWORK_ID,
        },
        body: JSON.stringify({ prices: updates }),
      });

      if (!response.ok) {
        throw new Error('Nem sikerult menteni az arakat');
      }

      const result = await response.json();

      if (result.errors && result.errors.length > 0) {
        setError(`Hibak: ${result.errors.join(', ')}`);
      }

      // Reload data
      await loadData();
      setEditedPrices({});
      setHasChanges(false);
    } catch (err: any) {
      setError(err.message || 'Hiba tortent');
    } finally {
      setSaving(false);
    }
  }

  async function handleExport() {
    try {
      const response = await fetch(`${API_URL}/operator/billing/prices/export`, {
        headers: { 'x-network-id': NETWORK_ID },
      });

      if (!response.ok) {
        throw new Error('Nem sikerult exportalni');
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
      setError(err.message || 'Hiba az exportalasnal');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Betoltes...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Arlista</h1>
          <p className="text-gray-500 mt-1">Szolgaltatas arak kezelese</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            Excel letoltes
          </button>
          <Link
            href="/admin/prices/upload"
            className="px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            Excel feltoltes
          </Link>
          {hasChanges && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Mentes...' : 'Valtozasok mentese'}
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
          <div className="text-sm text-gray-500">Szolgaltatas</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="text-2xl font-bold text-gray-900">{vehicleTypeOrder.length}</div>
          <div className="text-sm text-gray-500">Jarmutipus</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="text-2xl font-bold text-gray-900">{prices.length}</div>
          <div className="text-sm text-gray-500">Beallitott ar</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="text-2xl font-bold text-gray-900">
            {Object.keys(editedPrices).length}
          </div>
          <div className="text-sm text-gray-500">Modositva</div>
        </div>
      </div>

      {/* Price table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="sticky left-0 bg-gray-50 px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                  Jarmutipus
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
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer with save button */}
      {hasChanges && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Mentes...' : `Valtozasok mentese (${Object.keys(editedPrices).length} ar)`}
          </button>
        </div>
      )}
    </div>
  );
}
