'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface WashEvent {
  id: string;
  status: string;
  tractorPlateManual?: string;
  trailerPlateManual?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  location?: { name: string; code: string };
  servicePackage?: { name: string };
  entryMode: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const NETWORK_ID = 'cf808392-6283-4487-9fbd-e72951ca5bf8'; // Demo network

export default function WashEventsListPage() {
  const [washEvents, setWashEvents] = useState<WashEvent[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // First load locations
      const locResponse = await fetch(`${API_URL}/operator/locations`, {
        headers: { 'x-network-id': NETWORK_ID },
      });

      if (locResponse.ok) {
        const locs = await locResponse.json();
        setLocations(locs);

        // Load wash events for ALL locations (no locationId filter)
        const eventsResponse = await fetch(
          `${API_URL}/operator/wash-events?limit=100`,
          { headers: { 'x-network-id': NETWORK_ID } }
        );

        if (eventsResponse.ok) {
          const data = await eventsResponse.json();
          setWashEvents(data.data || []);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const filteredEvents = statusFilter === 'all'
    ? washEvents
    : washEvents.filter(e => e.status === statusFilter);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const statusColors: Record<string, string> = {
    CREATED: 'bg-yellow-100 text-yellow-700',
    AUTHORIZED: 'bg-blue-100 text-blue-700',
    IN_PROGRESS: 'bg-indigo-100 text-indigo-700',
    COMPLETED: 'bg-green-100 text-green-700',
    LOCKED: 'bg-gray-100 text-gray-700',
    REJECTED: 'bg-red-100 text-red-700',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Wash Events</h1>
          <p className="text-gray-500">Manage and monitor all wash events</p>
        </div>
        <Link
          href="/admin/wash-events/new"
          className="px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
        >
          + New Wash Event
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex flex-wrap gap-2">
          {['all', 'CREATED', 'IN_PROGRESS', 'COMPLETED', 'LOCKED'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
                ${statusFilter === status
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              {status === 'all' ? 'All' : status.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : filteredEvents.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No wash events found. Create your first one!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Plates
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Mode
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredEvents.map((event) => (
                  <tr key={event.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-mono text-sm text-gray-600">
                        #{event.id.slice(0, 8)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[event.status] || 'bg-gray-100 text-gray-700'}`}>
                        {event.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">
                        {event.location?.name || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-mono text-sm">
                        {event.tractorPlateManual || '-'}
                        {event.trailerPlateManual && ` / ${event.trailerPlateManual}`}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-xs text-gray-500">
                        {event.entryMode === 'QR_DRIVER' ? '📱 Driver' : '👤 Manual'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(event.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        href={`/admin/wash-events/${event.id}`}
                        className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
