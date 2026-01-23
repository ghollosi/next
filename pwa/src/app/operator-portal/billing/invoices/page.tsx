'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.vemiax.com';

interface LocationInvoice {
  id: string;
  invoiceType: 'WALK_IN' | 'PARTNER' | 'NETWORK';
  invoiceNumber?: string;
  periodLabel?: string;
  subtotal: string;
  vatAmount: string;
  total: string;
  currency: string;
  status: 'DRAFT' | 'ISSUED' | 'SENT' | 'PAID' | 'CANCELLED' | 'OVERDUE';
  issueDate?: string;
  dueDate?: string;
  paidDate?: string;
  paymentMethod?: string;
  buyerName: string;
  providerPdfUrl?: string;
  createdAt: string;
  locationPartner?: {
    id: string;
    name: string;
    code: string;
  };
  _count?: {
    items: number;
    washEvents: number;
  };
}

export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<LocationInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState({
    invoiceType: '',
    status: '',
  });
  const [issuingInvoice, setIssuingInvoice] = useState<string | null>(null);
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

  const loadInvoices = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filter.invoiceType) params.append('invoiceType', filter.invoiceType);
      if (filter.status) params.append('status', filter.status);

      const response = await fetch(`${API_URL}/location-billing/invoices?${params}`, {
        headers: getHeaders(),
      });

      if (response.status === 401) {
        router.replace('/operator-portal/login');
        return;
      }

      if (!response.ok) {
        throw new Error('Számlák betöltése sikertelen');
      }

      const data = await response.json();
      setInvoices(data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba történt');
    } finally {
      setLoading(false);
    }
  }, [filter, getHeaders, router]);

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

    loadInvoices();
  }, [router, loadInvoices]);

  const issueInvoice = async (invoiceId: string) => {
    setIssuingInvoice(invoiceId);
    setError('');

    try {
      const response = await fetch(`${API_URL}/location-billing/invoices/${invoiceId}/issue`, {
        method: 'POST',
        headers: getHeaders(),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Számla kiállítása sikertelen');
      }

      loadInvoices();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba történt');
    } finally {
      setIssuingInvoice(null);
    }
  };

  const markAsPaid = async (invoiceId: string) => {
    try {
      const response = await fetch(`${API_URL}/location-billing/invoices/${invoiceId}/mark-paid`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Művelet sikertelen');
      }

      loadInvoices();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba történt');
    }
  };

  const getInvoiceTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      WALK_IN: 'Walk-in',
      PARTNER: 'Partner',
      NETWORK: 'Network',
    };
    return labels[type] || type;
  };

  const getInvoiceTypeBadge = (type: string) => {
    const config: Record<string, { bg: string; text: string }> = {
      WALK_IN: { bg: 'bg-gray-100', text: 'text-gray-800' },
      PARTNER: { bg: 'bg-blue-100', text: 'text-blue-800' },
      NETWORK: { bg: 'bg-purple-100', text: 'text-purple-800' },
    };
    const { bg, text } = config[type] || config.WALK_IN;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${bg} ${text}`}>
        {getInvoiceTypeLabel(type)}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { bg: string; text: string; label: string }> = {
      DRAFT: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Előkészített' },
      ISSUED: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Kiállított' },
      SENT: { bg: 'bg-indigo-100', text: 'text-indigo-800', label: 'Elküldött' },
      PAID: { bg: 'bg-green-100', text: 'text-green-800', label: 'Kifizetve' },
      CANCELLED: { bg: 'bg-red-100', text: 'text-red-800', label: 'Sztornózott' },
      OVERDUE: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Lejárt' },
    };
    const { bg, text, label } = config[status] || config.DRAFT;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${bg} ${text}`}>
        {label}
      </span>
    );
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('hu-HU');
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
              <h1 className="text-xl font-bold">Számlák</h1>
              <p className="text-green-200 text-sm">Kiállított számlák kezelése</p>
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

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Típus</label>
              <select
                value={filter.invoiceType}
                onChange={(e) => setFilter({ ...filter, invoiceType: e.target.value })}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
              >
                <option value="">Mind</option>
                <option value="WALK_IN">Walk-in</option>
                <option value="PARTNER">Partner</option>
                <option value="NETWORK">Network</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Státusz</label>
              <select
                value={filter.status}
                onChange={(e) => setFilter({ ...filter, status: e.target.value })}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
              >
                <option value="">Mind</option>
                <option value="DRAFT">Előkészített</option>
                <option value="ISSUED">Kiállított</option>
                <option value="PAID">Kifizetve</option>
                <option value="OVERDUE">Lejárt</option>
                <option value="CANCELLED">Sztornózott</option>
              </select>
            </div>
          </div>
        </div>

        {/* Invoices List */}
        {loading ? (
          <div className="text-center py-8 text-gray-500">Betöltés...</div>
        ) : invoices.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <div className="text-gray-400 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="text-lg text-gray-600 font-medium">Nincsenek számlák</div>
            <div className="text-sm text-gray-400 mt-1">
              A kiállított számlák itt jelennek meg
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Számlaszám</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Típus</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vevő</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Összeg</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dátum</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Státusz</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Műveletek</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-mono text-sm font-medium text-gray-900">
                        {invoice.invoiceNumber || 'DRAFT'}
                      </div>
                      {invoice.periodLabel && (
                        <div className="text-xs text-gray-500">{invoice.periodLabel}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {getInvoiceTypeBadge(invoice.invoiceType)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{invoice.buyerName}</div>
                      {invoice.locationPartner && (
                        <div className="text-xs text-gray-500">
                          {invoice.locationPartner.code}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {formatMoney(invoice.total, invoice.currency)}
                      </div>
                      <div className="text-xs text-gray-500">
                        Nettó: {formatMoney(invoice.subtotal, invoice.currency)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {invoice.issueDate ? (
                        <>
                          <div>{formatDate(invoice.issueDate)}</div>
                          {invoice.dueDate && (
                            <div className="text-xs text-gray-400">
                              Határidő: {formatDate(invoice.dueDate)}
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(invoice.status)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm space-x-2">
                      {invoice.status === 'DRAFT' && (
                        <button
                          onClick={() => issueInvoice(invoice.id)}
                          disabled={issuingInvoice === invoice.id}
                          className="text-green-600 hover:text-green-800"
                        >
                          {issuingInvoice === invoice.id ? '...' : 'Kiállítás'}
                        </button>
                      )}
                      {invoice.status === 'ISSUED' && (
                        <button
                          onClick={() => markAsPaid(invoice.id)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          Fizetve
                        </button>
                      )}
                      {invoice.providerPdfUrl && (
                        <a
                          href={invoice.providerPdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-600 hover:text-gray-800"
                        >
                          PDF
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Legend */}
        <div className="mt-6 bg-gray-50 border border-gray-200 rounded-xl p-4">
          <h3 className="font-semibold text-gray-700 mb-2">Számla típusok</h3>
          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              {getInvoiceTypeBadge('WALK_IN')}
              <span>Walk-in ügyfél helyszíni számlája</span>
            </div>
            <div className="flex items-center gap-2">
              {getInvoiceTypeBadge('PARTNER')}
              <span>Saját partner felé gyűjtőszámla</span>
            </div>
            <div className="flex items-center gap-2">
              {getInvoiceTypeBadge('NETWORK')}
              <span>Network felé kiállított számla</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
