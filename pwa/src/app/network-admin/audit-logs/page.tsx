'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { networkAdminApi } from '@/lib/network-admin-api';

interface AuditLog {
  id: string;
  action: string;
  actorType: string;
  actorId?: string;
  createdAt: string;
  previousData?: any;
  newData?: any;
  metadata?: any;
  ipAddress?: string;
  washEvent?: {
    id: string;
    status: string;
    tractorPlateManual?: string;
    trailerPlateManual?: string;
    location?: {
      name: string;
      code: string;
    };
  };
}

const ACTION_LABELS: Record<string, string> = {
  // Standard actions
  CREATE: 'Letrehozas',
  UPDATE: 'Frissites',
  START: 'Inditas',
  COMPLETE: 'Befejezve',
  REJECT: 'Elutasitva',
  AUTHORIZE: 'Engedelyezve',
  LOCK: 'Lezarva',
  DELETE: 'Torles',
  // Security events
  LOGIN_SUCCESS: 'Sikeres bejelentkezes',
  LOGIN_FAILED: 'Sikertelen bejelentkezes',
  LOGOUT: 'Kijelentkezes',
  PASSWORD_RESET_REQUEST: 'Jelszo visszaallitas keres',
  PASSWORD_RESET_COMPLETE: 'Jelszo visszaallitva',
  SESSION_CREATED: 'Session letrehozva',
  SESSION_EXPIRED: 'Session lejart',
  RATE_LIMITED: 'Rate limit tullepve',
  // Admin events
  ADMIN_CREATED: 'Admin letrehozva',
  ADMIN_UPDATED: 'Admin frissitve',
  ADMIN_DELETED: 'Admin torolve',
  PERMISSION_CHANGED: 'Jogosultsag valtozas',
  // Data events
  EXPORT: 'Export',
  IMPORT: 'Import',
};

const ACTOR_TYPE_LABELS: Record<string, string> = {
  USER: 'Felhasznalo',
  DRIVER: 'Sofor',
  SYSTEM: 'Rendszer',
  OPERATOR: 'Operator',
  PARTNER: 'Partner',
  NETWORK_ADMIN: 'Network Admin',
  PLATFORM_ADMIN: 'Platform Admin',
};

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-blue-100 text-blue-800',
  UPDATE: 'bg-orange-100 text-orange-800',
  START: 'bg-yellow-100 text-yellow-800',
  COMPLETE: 'bg-green-100 text-green-800',
  AUTHORIZE: 'bg-green-100 text-green-800',
  LOCK: 'bg-purple-100 text-purple-800',
  REJECT: 'bg-red-100 text-red-800',
  DELETE: 'bg-red-100 text-red-800',
  LOGIN_SUCCESS: 'bg-green-100 text-green-800',
  LOGIN_FAILED: 'bg-red-100 text-red-800',
  LOGOUT: 'bg-gray-100 text-gray-800',
  RATE_LIMITED: 'bg-red-100 text-red-800',
  ADMIN_CREATED: 'bg-blue-100 text-blue-800',
  ADMIN_UPDATED: 'bg-orange-100 text-orange-800',
  ADMIN_DELETED: 'bg-red-100 text-red-800',
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Filters
  const [actionFilter, setActionFilter] = useState('');
  const [actorTypeFilter, setActorTypeFilter] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [page, setPage] = useState(0);
  const limit = 50;

  useEffect(() => {
    loadLogs();
  }, [page]);

  const loadLogs = async () => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      if (actionFilter) params.append('action', actionFilter);
      if (actorTypeFilter) params.append('actorType', actorTypeFilter);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      params.append('limit', limit.toString());
      params.append('offset', (page * limit).toString());

      const result = await networkAdminApi.getAuditLogs(params.toString());
      setLogs(result.data);
      setTotal(result.total);
    } catch (err: any) {
      setError(err.message || 'Hiba tortent');
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = () => {
    setPage(0);
    loadLogs();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('hu-HU');
  };

  const getActionBadge = (action: string) => {
    const color = ACTION_COLORS[action] || 'bg-gray-100 text-gray-800';
    const label = ACTION_LABELS[action] || action;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${color}`}>
        {label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit naplo</h1>
          <p className="text-gray-500">Rendszer esemenyek es valtozasok nyomon kovetese</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Muvelet tipusa
            </label>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-primary-500 focus:ring-0 focus:outline-none text-sm"
            >
              <option value="">Mind</option>
              {Object.entries(ACTION_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vegrehajto tipusa
            </label>
            <select
              value={actorTypeFilter}
              onChange={(e) => setActorTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-primary-500 focus:ring-0 focus:outline-none text-sm"
            >
              <option value="">Mind</option>
              {Object.entries(ACTOR_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Datum tol
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-primary-500 focus:ring-0 focus:outline-none text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Datum ig
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-primary-500 focus:ring-0 focus:outline-none text-sm"
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={handleFilter}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Szures
          </button>
          <span className="text-sm text-gray-500">
            Osszesen: {total} bejegyzes
          </span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600">
          {error}
        </div>
      )}

      {/* Logs Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Betoltes...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Nincs talalat a megadott szurokkel
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Idopont
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Muvelet
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Vegrehajto
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Kapcsolodo mosas
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reszletek
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {formatDate(log.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      {getActionBadge(log.action)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">
                          {ACTOR_TYPE_LABELS[log.actorType] || log.actorType}
                        </span>
                        {log.actorId && (
                          <span className="font-mono text-xs text-gray-600">
                            {log.actorId.length > 20 ? log.actorId.substring(0, 20) + '...' : log.actorId}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {log.washEvent ? (
                        <div>
                          <div className="font-mono">
                            {log.washEvent.tractorPlateManual || '-'}
                          </div>
                          <div className="text-xs text-gray-500">
                            {log.washEvent.location?.name}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="text-primary-600 hover:text-primary-800 text-sm"
                      >
                        Megtekintes
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {total > limit && (
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Elozo
            </button>
            <span className="text-sm text-gray-500">
              {page * limit + 1} - {Math.min((page + 1) * limit, total)} / {total}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={(page + 1) * limit >= total}
              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Kovetkezo
            </button>
          </div>
        )}
      </div>

      {/* Log Detail Modal */}
      {selectedLog && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Audit bejegyzes reszletei
                  </h2>
                  <p className="text-sm text-gray-500">
                    {formatDate(selectedLog.createdAt)}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Muvelet</p>
                  <div className="mt-1">{getActionBadge(selectedLog.action)}</div>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Vegrehajto tipusa</p>
                  <p className="font-medium">{ACTOR_TYPE_LABELS[selectedLog.actorType] || selectedLog.actorType}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Vegrehajto azonosito</p>
                  <p className="font-mono text-sm">{selectedLog.actorId || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">IP cim</p>
                  <p className="font-mono text-sm">{selectedLog.ipAddress || '-'}</p>
                </div>
              </div>

              {/* Wash Event Info */}
              {selectedLog.washEvent && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Kapcsolodo mosas</h3>
                  <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Rendszam</p>
                      <p className="font-mono">{selectedLog.washEvent.tractorPlateManual || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Helyszin</p>
                      <p>{selectedLog.washEvent.location?.name || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Statusz</p>
                      <p>{selectedLog.washEvent.status}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Previous Data */}
              {selectedLog.previousData && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Korabbi adat</h3>
                  <pre className="bg-red-50 rounded-lg p-4 text-sm overflow-x-auto text-red-800">
                    {JSON.stringify(selectedLog.previousData, null, 2)}
                  </pre>
                </div>
              )}

              {/* New Data */}
              {selectedLog.newData && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Uj adat</h3>
                  <pre className="bg-green-50 rounded-lg p-4 text-sm overflow-x-auto text-green-800">
                    {JSON.stringify(selectedLog.newData, null, 2)}
                  </pre>
                </div>
              )}

              {/* Metadata */}
              {selectedLog.metadata && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Egyeb adatok</h3>
                  <pre className="bg-gray-50 rounded-lg p-4 text-sm overflow-x-auto">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
