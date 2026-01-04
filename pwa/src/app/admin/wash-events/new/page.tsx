'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export default function NewWashEventPage() {
  const router = useRouter();
  const [locations, setLocations] = useState<Location[]>([]);
  const [services, setServices] = useState<ServicePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [tractorPlate, setTractorPlate] = useState('');
  const [trailerPlate, setTrailerPlate] = useState('');
  const [driverName, setDriverName] = useState('');

  useEffect(() => {
    loadFormData();
  }, []);

  const loadFormData = async () => {
    try {
      // Load locations
      const locResponse = await fetch(`${API_URL}/locations`, {
        headers: { 'x-network-id': 'demo' },
      });
      if (locResponse.ok) {
        const locData = await locResponse.json();
        setLocations(locData);
        if (locData.length > 0) {
          setSelectedLocationId(locData[0].id);
        }
      }

      // Load service packages
      const svcResponse = await fetch(`${API_URL}/service-packages`, {
        headers: { 'x-network-id': 'demo' },
      });
      if (svcResponse.ok) {
        const svcData = await svcResponse.json();
        setServices(svcData);
        if (svcData.length > 0) {
          setSelectedServiceId(svcData[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load form data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/wash-events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-network-id': 'demo',
        },
        body: JSON.stringify({
          entryMode: 'MANUAL_OPERATOR',
          locationId: selectedLocationId,
          servicePackageId: selectedServiceId,
          tractorPlateManual: tractorPlate.toUpperCase(),
          trailerPlateManual: trailerPlate.toUpperCase() || undefined,
          driverNameManual: driverName || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to create wash event');
      }

      const washEvent = await response.json();
      router.push(`/admin/wash-events/${washEvent.id}`);
    } catch (err: any) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/admin/wash-events"
          className="text-primary-600 hover:text-primary-700 text-sm font-medium"
        >
          ← Back to Wash Events
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">New Wash Event</h1>
        <p className="text-gray-500">Create a manual wash entry</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 space-y-6">
        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Location *
          </label>
          <select
            value={selectedLocationId}
            onChange={(e) => setSelectedLocationId(e.target.value)}
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
            Service Package *
          </label>
          <select
            value={selectedServiceId}
            onChange={(e) => setSelectedServiceId(e.target.value)}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            {services.map((svc) => (
              <option key={svc.id} value={svc.id}>
                {svc.name} ({svc.code})
              </option>
            ))}
          </select>
        </div>

        {/* Tractor Plate */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tractor Plate Number *
          </label>
          <input
            type="text"
            value={tractorPlate}
            onChange={(e) => setTractorPlate(e.target.value.toUpperCase())}
            required
            placeholder="ABC1234"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono uppercase"
          />
        </div>

        {/* Trailer Plate */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Trailer Plate Number (optional)
          </label>
          <input
            type="text"
            value={trailerPlate}
            onChange={(e) => setTrailerPlate(e.target.value.toUpperCase())}
            placeholder="XYZ5678"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono uppercase"
          />
        </div>

        {/* Driver Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Driver Name (optional)
          </label>
          <input
            type="text"
            value={driverName}
            onChange={(e) => setDriverName(e.target.value)}
            placeholder="John Doe"
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
            href="/admin/wash-events"
            className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl text-center hover:bg-gray-200 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting || !selectedLocationId || !selectedServiceId || !tractorPlate}
            className="flex-1 py-3 bg-primary-600 text-white font-medium rounded-xl
                       hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed
                       transition-colors"
          >
            {submitting ? 'Creating...' : 'Create Wash Event'}
          </button>
        </div>
      </form>
    </div>
  );
}
