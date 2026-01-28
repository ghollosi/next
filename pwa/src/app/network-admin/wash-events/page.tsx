'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { fetchOperatorApi } from '@/lib/network-admin-api';
import { useSubscription } from '@/contexts/SubscriptionContext';

interface WashEvent {
  id: string;
  status: string;
  tractorPlateManual?: string;
  trailerPlateManual?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  location?: { name: string; code: string; id: string };
  servicePackage?: { name: string };
  entryMode: string;
  totalPrice?: number;
  driver?: { name: string };
  partnerCompany?: { name: string };
}

interface Location {
  id: string;
  name: string;
  code: string;
}

export default function WashEventsListPage() {
  const { isReadOnly } = useSubscription();
  const [washEvents, setWashEvents] = useState<WashEvent[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // First load locations
      const locs = await fetchOperatorApi<Location[]>('/operator/locations');
      setLocations(locs);

      // Load wash events for ALL locations (no locationId filter)
      const data = await fetchOperatorApi<{ data: WashEvent[] }>('/operator/wash-events?limit=100');
      setWashEvents(data.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const filteredEvents = useMemo(() => {
    return washEvents.filter(event => {
      // Status filter
      if (statusFilter !== 'all' && event.status !== statusFilter) {
        return false;
      }

      // Location filter
      if (locationFilter !== 'all' && event.location?.id !== locationFilter) {
        return false;
      }

      // Search query (plate number, driver name, partner name)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesPlate = event.tractorPlateManual?.toLowerCase().includes(query) ||
                           event.trailerPlateManual?.toLowerCase().includes(query);
        const matchesDriver = event.driver?.name?.toLowerCase().includes(query);
        const matchesPartner = event.partnerCompany?.name?.toLowerCase().includes(query);
        if (!matchesPlate && !matchesDriver && !matchesPartner) {
          return false;
        }
      }

      // Date range filter
      if (dateFrom) {
        const eventDate = new Date(event.createdAt);
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        if (eventDate < fromDate) {
          return false;
        }
      }

      if (dateTo) {
        const eventDate = new Date(event.createdAt);
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (eventDate > toDate) {
          return false;
        }
      }

      return true;
    });
  }, [washEvents, statusFilter, locationFilter, searchQuery, dateFrom, dateTo]);

  const clearFilters = () => {
    setStatusFilter('all');
    setLocationFilter('all');
    setSearchQuery('');
    setDateFrom('');
    setDateTo('');
  };

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
          <h1 className="text-2xl font-bold text-gray-900">Mosások</h1>
          <p className="text-gray-500">Összes mosás kezelése és megtekintése</p>
        </div>
        {!isReadOnly && (
          <Link
            href="/network-admin/wash-events/new"
            className="px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
          >
            + Új mosás
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 space-y-4">
        {/* Search and Location Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Rendszam, sofor, ceg keresese..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:border-primary-500 focus:ring-0 focus:outline-none text-sm"
            />
          </div>

          {/* Location Filter */}
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-primary-500 focus:ring-0 focus:outline-none text-sm"
          >
            <option value="all">Minden helyszin</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name} ({loc.code})
              </option>
            ))}
          </select>

          {/* Date Range */}
          <div className="flex gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:border-primary-500 focus:ring-0 focus:outline-none text-sm"
              placeholder="Tol"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:border-primary-500 focus:ring-0 focus:outline-none text-sm"
              placeholder="Ig"
            />
          </div>
        </div>

        {/* Status Filter Row */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-500 mr-2">Statusz:</span>
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
              {status === 'all' ? 'Mind' : status.replace('_', ' ')}
            </button>
          ))}

          {/* Clear filters button */}
          {(statusFilter !== 'all' || locationFilter !== 'all' || searchQuery || dateFrom || dateTo) && (
            <button
              onClick={clearFilters}
              className="ml-auto px-4 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Szurok torlese
            </button>
          )}
        </div>

        {/* Results count */}
        <div className="text-sm text-gray-500">
          {filteredEvents.length} mosas talalhato
          {filteredEvents.length !== washEvents.length && ` (ossz: ${washEvents.length})`}
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
          <div className="p-8 text-center text-gray-500">Betöltés...</div>
        ) : filteredEvents.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Nincs mosás. Hozd létre az elsőt!
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
                    Státusz
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Helyszín
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rendszámok
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Típus
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Létrehozva
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Műveletek
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
                        {event.location?.name || 'Ismeretlen'}
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
                        {event.entryMode === 'QR_DRIVER' ? '📱 Sofőr' : '👤 Manuális'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(event.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {!isReadOnly && (
                        <Link
                          href={`/network-admin/wash-events/${event.id}`}
                          className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                        >
                          Megtekintés
                        </Link>
                      )}
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
