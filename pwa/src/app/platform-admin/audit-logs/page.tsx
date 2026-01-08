'use client';

import { useState, useEffect } from 'react';
import { platformApi, getPlatformToken } from '@/lib/platform-api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

interface Network {
  id: string;
  name: string;
  slug: string;
}

interface AuditLog {
  id: string;
  networkId: string;
  action: string;
  actorType: string;
  actorId?: string;
  previousData?: any;
  newData?: any;
  metadata?: any;
  createdAt: string;
  washEvent?: {
    id: string;
    status: string;
  };
}

const ACTION_LABELS: Record<string, string> = {
  WASH_CREATED: 'Mosas letrehozva',
  WASH_STARTED: 'Mosas elkezdve',
  WASH_COMPLETED: 'Mosas befejezve',
  WASH_CANCELLED: 'Mosas visszavonva',
  WASH_LOCKED: 'Mosas lezarva',
  PRICE_CHANGED: 'Ar modositva',
  PARTNER_CREATED: 'Partner letrehozva',
  PARTNER_UPDATED: 'Partner frissitve',
  DRIVER_CREATED: 'Sofor letrehozva',
  DRIVER_UPDATED: 'Sofor frissitve',
  LOCATION_CREATED: 'Helyszin letrehozva',
  LOCATION_UPDATED: 'Helyszin frissitve',
  INVOICE_GENERATED: 'Szamla generalva',
  INVOICE_SENT: 'Szamla elkuldve',
  SETTINGS_UPDATED: 'Beallitasok frissitve',
};

const ACTOR_TYPE_LABELS: Record<string, string> = {
  USER: 'Felhasznalo',
  DRIVER: 'Sofor',
  SYSTEM: 'Rendszer',
};

export default function PlatformAuditLogsPage() {
  const [networks, setNetworks] = useState<Network[]>([]);
  const [selectedNetwork, setSelectedNetwork] = useState<string>('');
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 50;

  // Filters
  const [actionFilter, setActionFilter] = useState('');
  const [actorTypeFilter, setActorTypeFilter] = useState('');

  useEffect(() => {
    loadNetworks();
  }, []);

  useEffect(() => {
    if (selectedNetwork) {
      loadAuditLogs();
    }
  }, [selectedNetwork, page, actionFilter, actorTypeFilter]);

  async function loadNetworks() {
    try {
      setLoading(true);
      const networks = await platformApi.listNetworks();
      setNetworks(networks || []);
    } catch (err: any) {
      setError(err.message || 'Halozatok betoltese sikertelen');
    } finally {
      setLoading(false);
    }
  }

  async function loadAuditLogs() {
    if (!selectedNetwork) return;

    try {
      setLogsLoading(true);
      setError('');

      const token = getPlatformToken();
      const params = new URLSearchParams();
      params.append('limit', limit.toString());
      params.append('offset', ((page - 1) * limit).toString());
      if (actionFilter) params.append('action', actionFilter);
      if (actorTypeFilter) params.append('actorType', actorTypeFilter);

      const response = await fetch(
        `${API_URL}/platform-admin/networks/${selectedNetwork}/audit-logs?${params}`,
        {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          setAuditLogs([]);
          setTotal(0);
          return;
        }
        throw new Error('Audit naplo betoltese sikertelen');
      }

      const data = await response.json();
      setAuditLogs(data.data || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      // If audit logs endpoint doesn't exist yet, show empty state
      if (err.message?.includes('404') || err.message?.includes('Not Found')) {
        setAuditLogs([]);
        setTotal(0);
      } else {
        setError(err.message || 'Audit naplo betoltese sikertelen');
      }
    } finally {
      setLogsLoading(false);
    }
  }

  const totalPages = Math.ceil(total / limit);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-400">Betoltes...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Audit naplo</h1>
        <p className="text-gray-400 mt-1">Halozatok audit naploinak megtekintese</p>
      </div>

      {/* Network selector */}
      <div className="bg-gray-800 rounded-xl p-4">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Valassz halozatot
        </label>
        <select
          value={selectedNetwork}
          onChange={(e) => {
            setSelectedNetwork(e.target.value);
            setPage(1);
          }}
          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="">Valassz...</option>
          {networks.map((network) => (
            <option key={network.id} value={network.id}>
              {network.name} ({network.slug})
            </option>
          ))}
        </select>
      </div>

      {selectedNetwork && (
        <>
          {/* Filters */}
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Esemeny tipus
                </label>
                <select
                  value={actionFilter}
                  onChange={(e) => {
                    setActionFilter(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm"
                >
                  <option value="">Mind</option>
                  {Object.entries(ACTION_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Vegrehajto tipus
                </label>
                <select
                  value={actorTypeFilter}
                  onChange={(e) => {
                    setActorTypeFilter(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm"
                >
                  <option value="">Mind</option>
                  {Object.entries(ACTOR_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setActionFilter('');
                    setActorTypeFilter('');
                    setPage(1);
                  }}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors text-sm"
                >
                  Szurok torlese
                </button>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-gray-800 rounded-xl p-4">
              <div className="text-2xl font-bold text-white">{total}</div>
              <div className="text-sm text-gray-400">Osszes bejegyzes</div>
            </div>
            <div className="bg-gray-800 rounded-xl p-4">
              <div className="text-2xl font-bold text-white">{auditLogs.length}</div>
              <div className="text-sm text-gray-400">Megjelenitett</div>
            </div>
            <div className="bg-gray-800 rounded-xl p-4">
              <div className="text-2xl font-bold text-white">{page}</div>
              <div className="text-sm text-gray-400">Oldal / {totalPages || 1}</div>
            </div>
            <div className="bg-gray-800 rounded-xl p-4">
              <div className="text-2xl font-bold text-white">{networks.length}</div>
              <div className="text-sm text-gray-400">Halozat</div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-900/50 border border-red-700 rounded-xl p-4 text-red-300">
              {error}
            </div>
          )}

          {/* Audit logs table */}
          <div className="bg-gray-800 rounded-xl overflow-hidden">
            {logsLoading ? (
              <div className="p-8 text-center text-gray-400">Betoltes...</div>
            ) : auditLogs.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                Nincs talalat a megadott szurokkel
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-700">
                  <thead className="bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Idopont
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Esemeny
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Vegrehajto
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Mosas ID
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Reszletek
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-700/50">
                        <td className="px-4 py-3 text-sm text-gray-300 whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString('hu-HU')}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-indigo-900/50 text-indigo-300">
                            {ACTION_LABELS[log.action] || log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300">
                          <span className="text-gray-400">
                            {ACTOR_TYPE_LABELS[log.actorType] || log.actorType}
                          </span>
                          {log.actorId && (
                            <span className="ml-1 text-gray-500 text-xs">
                              ({log.actorId.substring(0, 8)}...)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300 font-mono">
                          {log.washEvent?.id ? (
                            <span className="text-indigo-400">
                              {log.washEvent.id.substring(0, 8)}...
                            </span>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-400">
                          {log.metadata ? (
                            <details className="cursor-pointer">
                              <summary className="text-indigo-400 hover:text-indigo-300">
                                Megtekintes
                              </summary>
                              <pre className="mt-2 text-xs bg-gray-900 p-2 rounded overflow-x-auto max-w-xs">
                                {JSON.stringify(log.metadata, null, 2)}
                              </pre>
                            </details>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-gray-700 flex items-center justify-between">
                <div className="text-sm text-gray-400">
                  {(page - 1) * limit + 1} - {Math.min(page * limit, total)} / {total}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 bg-gray-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 transition-colors"
                  >
                    Elozo
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1 bg-gray-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 transition-colors"
                  >
                    Kovetkezo
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Info box when no network selected */}
      {!selectedNetwork && (
        <div className="bg-gray-800 rounded-xl p-8 text-center">
          <div className="text-gray-400 mb-2">
            Valassz egy halozatot az audit naplo megtekinteshez
          </div>
          <div className="text-sm text-gray-500">
            A platform adminkent barmely halozat audit naplojat megtekintheted
          </div>
        </div>
      )}
    </div>
  );
}
