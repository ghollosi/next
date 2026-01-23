'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.vemiax.com';

interface Statement {
  id: string;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  washCount: number;
  totalAmount: string;
  currency: string;
  status: 'GENERATED' | 'INVOICE_PENDING' | 'INVOICED' | 'PAID';
  sentAt?: string;
  sentToEmail?: string;
  createdAt: string;
  invoice?: {
    id: string;
    invoiceNumber?: string;
    status: string;
    total: string;
  };
}

interface StatementDetails extends Statement {
  washEvents: Array<{
    id: string;
    completedAt: string;
    tractorPlateManual?: string;
    trailerPlateManual?: string;
    finalPrice?: string;
    services: Array<{
      servicePackage: { name: string };
      totalPrice: string;
    }>;
    partnerCompany?: { name: string; code: string };
    driver?: { firstName: string; lastName: string };
  }>;
}

export default function StatementsPage() {
  const router = useRouter();
  const [statements, setStatements] = useState<Statement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedStatement, setSelectedStatement] = useState<StatementDetails | null>(null);
  const [creatingInvoice, setCreatingInvoice] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);

  const getHeaders = useCallback(() => {
    const session = localStorage.getItem('operator_session');
    const locId = locationId || localStorage.getItem('operator_location_id');
    return {
      'x-operator-session': session || '',
      'x-location-id': locId || '',
      'Content-Type': 'application/json',
    };
  }, [locationId]);

  const loadStatements = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/location-billing/statements`, {
        headers: getHeaders(),
      });

      if (response.status === 401) {
        router.replace('/operator-portal/login');
        return;
      }

      if (!response.ok) {
        throw new Error('Kimutatások betöltése sikertelen');
      }

      const data = await response.json();
      setStatements(data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba történt');
    } finally {
      setLoading(false);
    }
  }, [getHeaders, router]);

  useEffect(() => {
    const session = localStorage.getItem('operator_session');
    const info = localStorage.getItem('operator_info');

    if (!session || !info) {
      router.replace('/operator-portal/login');
      return;
    }

    const parsedInfo = JSON.parse(info);
    setLocationId(parsedInfo.locationId);
    localStorage.setItem('operator_location_id', parsedInfo.locationId);

    loadStatements();
  }, [router, loadStatements]);

  const loadStatementDetails = async (statementId: string) => {
    try {
      const response = await fetch(`${API_URL}/location-billing/statements/${statementId}`, {
        headers: getHeaders(),
      });

      if (!response.ok) {
        throw new Error('Részletek betöltése sikertelen');
      }

      const data = await response.json();
      setSelectedStatement(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba történt');
    }
  };

  const createInvoice = async (statementId: string) => {
    setCreatingInvoice(statementId);
    setError('');

    try {
      const response = await fetch(`${API_URL}/location-billing/statements/${statementId}/create-invoice`, {
        method: 'POST',
        headers: getHeaders(),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Számla létrehozása sikertelen');
      }

      // Reload statements
      loadStatements();
      setSelectedStatement(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba történt');
    } finally {
      setCreatingInvoice(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { bg: string; text: string; label: string }> = {
      GENERATED: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Kimutatás kész' },
      INVOICE_PENDING: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Számla készül' },
      INVOICED: { bg: 'bg-green-100', text: 'text-green-800', label: 'Számla kiállítva' },
      PAID: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Kifizetve' },
    };
    const { bg, text, label } = config[status] || config.GENERATED;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${bg} ${text}`}>
        {label}
      </span>
    );
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('hu-HU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatMoney = (amount: string | number, currency: string = 'HUF') => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('hu-HU', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(num);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-green-600 text-white px-4 py-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/operator-portal/dashboard"
              className="text-green-200 hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-xl font-bold">Kimutatások</h1>
              <p className="text-green-200 text-sm">Network felé számlázási kimutatások</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-600">
            {error}
          </div>
        )}

        {/* Statement Details Modal */}
        {selectedStatement && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">{selectedStatement.periodLabel}</h2>
                  <p className="text-sm text-gray-500">
                    {formatDate(selectedStatement.periodStart)} - {formatDate(selectedStatement.periodEnd)}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedStatement(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6">
                {/* Summary */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-gray-900">{selectedStatement.washCount}</div>
                    <div className="text-sm text-gray-500">Mosások száma</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="text-2xl font-bold text-green-700">
                      {formatMoney(selectedStatement.totalAmount, selectedStatement.currency)}
                    </div>
                    <div className="text-sm text-gray-500">Összesen</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="mb-1">{getStatusBadge(selectedStatement.status)}</div>
                    <div className="text-sm text-gray-500">Státusz</div>
                  </div>
                </div>

                {/* Wash Events Table */}
                <h3 className="font-semibold text-gray-900 mb-3">Mosások részletezése</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left">Dátum</th>
                        <th className="px-4 py-2 text-left">Rendszám</th>
                        <th className="px-4 py-2 text-left">Sofőr</th>
                        <th className="px-4 py-2 text-left">Partner</th>
                        <th className="px-4 py-2 text-left">Szolgáltatás</th>
                        <th className="px-4 py-2 text-right">Összeg</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {selectedStatement.washEvents?.map((event) => (
                        <tr key={event.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2">
                            {new Date(event.completedAt).toLocaleDateString('hu-HU')}
                          </td>
                          <td className="px-4 py-2 font-mono">
                            {event.tractorPlateManual}
                            {event.trailerPlateManual && ` + ${event.trailerPlateManual}`}
                          </td>
                          <td className="px-4 py-2">
                            {event.driver
                              ? `${event.driver.firstName} ${event.driver.lastName}`
                              : '-'}
                          </td>
                          <td className="px-4 py-2">
                            {event.partnerCompany?.name || 'Walk-in'}
                          </td>
                          <td className="px-4 py-2">
                            {event.services?.map((s) => s.servicePackage.name).join(', ') || '-'}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {formatMoney(
                              event.services?.reduce((sum, s) => sum + parseFloat(s.totalPrice), 0) ||
                                parseFloat(event.finalPrice || '0')
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Actions */}
                <div className="mt-6 pt-6 border-t flex justify-between items-center">
                  <div className="text-sm text-gray-500">
                    Számla szöveg: <strong>"{selectedStatement.periodLabel} járműmosás gyűjtőszámla"</strong>
                  </div>
                  {selectedStatement.status === 'GENERATED' && (
                    <button
                      onClick={() => createInvoice(selectedStatement.id)}
                      disabled={creatingInvoice === selectedStatement.id}
                      className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      {creatingInvoice === selectedStatement.id ? 'Létrehozás...' : 'Számla létrehozása'}
                    </button>
                  )}
                  {selectedStatement.invoice && (
                    <Link
                      href={`/operator-portal/billing/invoices?id=${selectedStatement.invoice.id}`}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Számla megtekintése ({selectedStatement.invoice.invoiceNumber || 'Előkészített'})
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Statements List */}
        {loading ? (
          <div className="text-center py-8 text-gray-500">Betöltés...</div>
        ) : statements.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <div className="text-gray-400 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="text-lg text-gray-600 font-medium">Nincsenek kimutatások</div>
            <div className="text-sm text-gray-400 mt-1">
              A kimutatások minden hónap 1-jén automatikusan generálódnak
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Időszak</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mosások</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Összeg</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Státusz</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Számla</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Műveletek</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {statements.map((statement) => (
                  <tr key={statement.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{statement.periodLabel}</div>
                      <div className="text-xs text-gray-500">
                        {formatDate(statement.periodStart)} - {formatDate(statement.periodEnd)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {statement.washCount} db
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {formatMoney(statement.totalAmount, statement.currency)}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(statement.status)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {statement.invoice ? (
                        <span className="text-blue-600">
                          {statement.invoice.invoiceNumber || 'Előkészítve'}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => loadStatementDetails(statement.id)}
                        className="text-green-600 hover:text-green-800 mr-3"
                      >
                        Részletek
                      </button>
                      {statement.status === 'GENERATED' && (
                        <button
                          onClick={() => createInvoice(statement.id)}
                          disabled={creatingInvoice === statement.id}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          {creatingInvoice === statement.id ? '...' : 'Számla'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Info Box */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h3 className="font-semibold text-blue-800 mb-2">Kimutatások és számlázás</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>A kimutatások minden hónap 1-jén automatikusan generálódnak az előző hónap mosásaiból</li>
            <li>A kimutatás alapján kell kiállítania a számlát a Network felé</li>
            <li>Számla szöveg: <strong>"[hónap] járműmosás gyűjtőszámla"</strong></li>
            <li>A számla összegének egyeznie kell a kimutatásban szereplő összeggel</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
