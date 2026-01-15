'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, getDriver, DriverInfo } from '@/lib/session';
import { api, Vehicle, VehicleCategory } from '@/lib/api';

export default function VehiclesPage() {
  const router = useRouter();
  const [driver, setDriver] = useState<DriverInfo | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [solos, setSolos] = useState<Vehicle[]>([]);
  const [tractors, setTractors] = useState<Vehicle[]>([]);
  const [trailers, setTrailers] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Új jármű form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCategory, setNewCategory] = useState<VehicleCategory>('SOLO');
  const [newPlateNumber, setNewPlateNumber] = useState('');
  const [newNickname, setNewNickname] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const session = getSession();
    const driverInfo = getDriver();

    if (!session || !driverInfo) {
      router.replace('/login');
      return;
    }

    setSessionId(session);
    setDriver(driverInfo);
    loadVehicles(session);
  }, [router]);

  const loadVehicles = async (session: string) => {
    try {
      const data = await api.getVehicles(session);
      setSolos(data.solos || []);
      setTractors(data.tractors || []);
      setTrailers(data.trailers || []);
    } catch (err: any) {
      setError(err.message || 'Nem sikerult betolteni a jarmuveket');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  const handleAddVehicle = async () => {
    if (!sessionId || !newPlateNumber.trim()) return;

    setIsSaving(true);
    setError('');

    try {
      await api.createVehicle(sessionId, {
        category: newCategory,
        plateNumber: newPlateNumber.trim(),
        nickname: newNickname.trim() || undefined,
      });

      // Újratöltjük a listát
      await loadVehicles(sessionId);

      // Form reset
      setShowAddForm(false);
      setNewPlateNumber('');
      setNewNickname('');
      setNewCategory('SOLO');
    } catch (err: any) {
      setError(err.message || 'Nem sikerult menteni a jarmut');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteVehicle = async (vehicleId: string) => {
    if (!sessionId) return;
    if (!confirm('Biztosan torlod ezt a jarmut?')) return;

    try {
      await api.deleteVehicle(sessionId, vehicleId);
      await loadVehicles(sessionId);
    } catch (err: any) {
      setError(err.message || 'Nem sikerult torolni a jarmut');
    }
  };

  const getCategoryLabel = (category: VehicleCategory) => {
    switch (category) {
      case 'SOLO': return 'Szolo jarmu';
      case 'TRACTOR': return 'Vontato';
      case 'TRAILER': return 'Vontatmany';
    }
  };

  const getCategoryIcon = (category: VehicleCategory) => {
    switch (category) {
      case 'SOLO': return '🚗';
      case 'TRACTOR': return '🚛';
      case 'TRAILER': return '🚚';
    }
  };

  const getCategoryColor = (category: VehicleCategory) => {
    switch (category) {
      case 'SOLO': return { bg: 'bg-green-100', text: 'text-green-600' };
      case 'TRACTOR': return { bg: 'bg-blue-100', text: 'text-blue-600' };
      case 'TRAILER': return { bg: 'bg-orange-100', text: 'text-orange-600' };
    }
  };

  if (!driver) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Betoltes...</div>
      </div>
    );
  }

  const totalVehicles = solos.length + tractors.length + trailers.length;

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
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Jarmuveim</h1>
            <p className="text-primary-200 text-sm">
              {totalVehicles} jarmu
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </header>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* Add Vehicle Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-2xl p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Uj jarmu hozzaadasa</h2>
              <button
                onClick={() => setShowAddForm(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Category Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Kategoria
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['SOLO', 'TRACTOR', 'TRAILER'] as VehicleCategory[]).map((cat) => {
                  const colors = getCategoryColor(cat);
                  const isSelected = newCategory === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => setNewCategory(cat)}
                      className={`p-3 rounded-xl border-2 transition-all ${
                        isSelected
                          ? `border-primary-500 ${colors.bg}`
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <span className="text-2xl block mb-1">{getCategoryIcon(cat)}</span>
                      <span className={`text-xs font-medium ${isSelected ? colors.text : 'text-gray-600'}`}>
                        {getCategoryLabel(cat)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Plate Number */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rendszam *
              </label>
              <input
                type="text"
                value={newPlateNumber}
                onChange={(e) => setNewPlateNumber(e.target.value.toUpperCase())}
                placeholder="ABC-123"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono text-lg"
                autoCapitalize="characters"
              />
            </div>

            {/* Nickname */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Becenev (opcionalis)
              </label>
              <input
                type="text"
                value={newNickname}
                onChange={(e) => setNewNickname(e.target.value)}
                placeholder="pl. Kek Scania"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            {/* Save Button */}
            <button
              onClick={handleAddVehicle}
              disabled={!newPlateNumber.trim() || isSaving}
              className="w-full py-4 bg-primary-600 text-white rounded-xl font-semibold
                       disabled:bg-gray-300 disabled:cursor-not-allowed
                       hover:bg-primary-700 active:bg-primary-800 transition-colors"
            >
              {isSaving ? 'Mentes...' : 'Jarmu mentese'}
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 px-4 py-6 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <svg className="animate-spin w-8 h-8 text-primary-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        ) : totalVehicles === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Nincs mentett jarmu</h3>
            <p className="text-gray-500 mb-4">Adj hozza jarmuvet a gyors mosohoz.</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="px-6 py-3 bg-primary-600 text-white rounded-xl font-semibold
                       hover:bg-primary-700 active:bg-primary-800 transition-colors"
            >
              Jarmu hozzaadasa
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Szóló járművek */}
            {solos.length > 0 && (
              <VehicleSection
                title="Szolo jarmuvek"
                icon="🚗"
                vehicles={solos}
                colorClass="green"
                onDelete={handleDeleteVehicle}
              />
            )}

            {/* Vontatók */}
            {tractors.length > 0 && (
              <VehicleSection
                title="Vontatok"
                icon="🚛"
                vehicles={tractors}
                colorClass="blue"
                onDelete={handleDeleteVehicle}
              />
            )}

            {/* Vontatmányok */}
            {trailers.length > 0 && (
              <VehicleSection
                title="Vontatmanyok"
                icon="🚚"
                vehicles={trailers}
                colorClass="orange"
                onDelete={handleDeleteVehicle}
              />
            )}
          </div>
        )}
      </div>

      {/* Add Button (floating) */}
      {totalVehicles > 0 && (
        <div className="px-4 pb-4">
          <button
            onClick={() => setShowAddForm(true)}
            className="w-full py-4 bg-primary-600 text-white rounded-xl font-semibold
                     flex items-center justify-center gap-2
                     hover:bg-primary-700 active:bg-primary-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Uj jarmu hozzaadasa
          </button>
        </div>
      )}

      {/* Bottom Safe Area */}
      <div className="safe-area-bottom" />
    </div>
  );
}

// Vehicle Section Component
function VehicleSection({
  title,
  icon,
  vehicles,
  colorClass,
  onDelete,
}: {
  title: string;
  icon: string;
  vehicles: Vehicle[];
  colorClass: 'green' | 'blue' | 'orange';
  onDelete: (id: string) => void;
}) {
  const colors = {
    green: { bg: 'bg-green-100', text: 'text-green-600' },
    blue: { bg: 'bg-blue-100', text: 'text-blue-600' },
    orange: { bg: 'bg-orange-100', text: 'text-orange-600' },
  }[colorClass];

  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
        <span className="text-2xl">{icon}</span>
        {title} ({vehicles.length})
      </h2>
      <div className="space-y-3">
        {vehicles.map((vehicle) => (
          <div
            key={vehicle.id}
            className="bg-white rounded-xl shadow-sm p-4"
          >
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 ${colors.bg} rounded-xl flex items-center justify-center`}>
                <span className="text-2xl">{icon}</span>
              </div>
              <div className="flex-1">
                <p className="font-mono text-xl font-bold text-gray-800">
                  {vehicle.plateNumber}
                </p>
                {vehicle.nickname && (
                  <p className="text-sm text-gray-500">
                    {vehicle.nickname}
                  </p>
                )}
              </div>
              <button
                onClick={() => onDelete(vehicle.id)}
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
