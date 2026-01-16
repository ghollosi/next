'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  vatRate: number;
}

interface Invoice {
  id: string;
  invoiceNumber?: string;
  status: string;
  issueDate: string;
  dueDate: string;
  paidDate?: string;
  subtotal: number;
  vatAmount: number;
  total: number;
  currency: string;
  paymentMethod?: string;
  externalInvoiceId?: string;
  externalInvoiceUrl?: string;
  items: InvoiceItem[];
}

interface InvoiceSummary {
  totalCount: number;
  totalAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  overdueAmount: number;
  byStatus: Record<string, { count: number; amount: number }>;
}

interface PartnerInfo {
  partnerId: string;
  partnerName: string;
  partnerCode: string;
}

export default function PartnerInvoicesPage() {
  const router = useRouter();
  const [partnerInfo, setPartnerInfo] = useState<PartnerInfo | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [summary, setSummary] = useState<InvoiceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Filters
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 3);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    const session = localStorage.getItem('partner_session');
    const info = localStorage.getItem('partner_info');

    if (!session || !info) {
      router.replace('/partner/login');
      return;
    }

    setPartnerInfo(JSON.parse(info));
    loadData(session);
  }, [router]);

  const loadData = async (session?: string) => {
    const sessionId = session || localStorage.getItem('partner_session');
    if (!sessionId) return;

    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (statusFilter) params.append('status', statusFilter);

      const [invoicesRes, summaryRes] = await Promise.all([
        fetch(`${API_URL}/partner-portal/invoices?${params}`, {
          headers: { 'x-partner-session': sessionId },
        }),
        fetch(`${API_URL}/partner-portal/invoices/summary?${params}`, {
          headers: { 'x-partner-session': sessionId },
        }),
      ]);

      if (!invoicesRes.ok || !summaryRes.ok) {
        if (invoicesRes.status === 401 || summaryRes.status === 401) {
          localStorage.removeItem('partner_session');
          localStorage.removeItem('partner_info');
          router.replace('/partner/login');
          return;
        }
        throw new Error('Adatok betoltese sikertelen');
      }

      const invoicesData = await invoicesRes.json();
      const summaryData = await summaryRes.json();

      setInvoices(invoicesData.data || []);
      setSummary(summaryData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba tortent');
    } finally {
      setLoading(false);
    }
  };

  const handleFilter = () => {
    loadData();
  };

  const formatCurrency = (amount: number, currency: string = 'HUF') => {
    return new Intl.NumberFormat('hu-HU', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-800',
      ISSUED: 'bg-blue-100 text-blue-800',
      SENT: 'bg-indigo-100 text-indigo-800',
      PAID: 'bg-green-100 text-green-800',
      OVERDUE: 'bg-red-100 text-red-800',
      CANCELLED: 'bg-gray-100 text-gray-500',
    };
    const labels: Record<string, string> = {
      DRAFT: 'Piszkozat',
      ISSUED: 'Kiallitva',
      SENT: 'Elkuldve',
      PAID: 'Fizetve',
      OVERDUE: 'Lejartt',
      CANCELLED: 'Sztornozva',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100'}`}>
        {labels[status] || status}
      </span>
    );
  };

  if (!partnerInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Betoltes...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-blue-600 text-white px-4 py-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{partnerInfo.partnerName}</h1>
            <p className="text-blue-200 text-sm">Szamlak</p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/partner/dashboard"
              className="px-4 py-2 bg-blue-700 hover:bg-blue-800 rounded-lg text-sm transition-colors"
            >
              Vissza
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="text-3xl font-bold text-blue-600">
                {formatCurrency(summary.totalAmount)}
              </div>
              <div className="text-sm text-gray-500">Osszes szamla</div>
              <div className="text-xs text-gray-400 mt-1">{summary.totalCount} db</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="text-3xl font-bold text-green-600">
                {formatCurrency(summary.paidAmount)}
              </div>
              <div className="text-sm text-gray-500">Fizetve</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="text-3xl font-bold text-yellow-600">
                {formatCurrency(summary.unpaidAmount)}
              </div>
              <div className="text-sm text-gray-500">Fizetendo</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="text-3xl font-bold text-red-600">
                {formatCurrency(summary.overdueAmount)}
              </div>
              <div className="text-sm text-gray-500">Lejart</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kezdo datum
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Befejezo datum
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Statusz
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Mind</option>
                <option value="DRAFT">Piszkozat</option>
                <option value="ISSUED">Kiallitva</option>
                <option value="SENT">Elkuldve</option>
                <option value="PAID">Fizetve</option>
                <option value="OVERDUE">Lejart</option>
              </select>
            </div>
            <button
              onClick={handleFilter}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Szures
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-600">
            {error}
          </div>
        )}

        {/* Invoices Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">Szamlak</h2>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-500">Betoltes...</div>
          ) : invoices.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              Nincs talalat a megadott szurokkel
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Szamlaszam
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Kiallitas
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Hatarido
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Netto
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      AFA
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Brutto
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Statusz
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Muvelet
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-mono text-gray-900">
                        {invoice.invoiceNumber || invoice.id.substring(0, 8)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {new Date(invoice.issueDate).toLocaleDateString('hu-HU')}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {new Date(invoice.dueDate).toLocaleDateString('hu-HU')}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right">
                        {formatCurrency(invoice.subtotal, invoice.currency)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 text-right">
                        {formatCurrency(invoice.vatAmount, invoice.currency)}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                        {formatCurrency(invoice.total, invoice.currency)}
                      </td>
                      <td className="px-4 py-3">
                        {getStatusBadge(invoice.status)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setSelectedInvoice(invoice)}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          Reszletek
                        </button>
                        {invoice.externalInvoiceUrl && (
                          <a
                            href={invoice.externalInvoiceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 text-green-600 hover:text-green-800 text-sm"
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
        </div>
      </main>

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedInvoice(null)}
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
                    Szamla reszletek
                  </h2>
                  <p className="text-sm text-gray-500 font-mono">
                    {selectedInvoice.invoiceNumber || selectedInvoice.id}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedInvoice(null)}
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
              {/* Invoice Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Kiallitas datuma</p>
                  <p className="font-medium">{new Date(selectedInvoice.issueDate).toLocaleDateString('hu-HU')}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Fizetesi hatarido</p>
                  <p className="font-medium">{new Date(selectedInvoice.dueDate).toLocaleDateString('hu-HU')}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Statusz</p>
                  <div className="mt-1">{getStatusBadge(selectedInvoice.status)}</div>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Fizetesi mod</p>
                  <p className="font-medium">{selectedInvoice.paymentMethod || '-'}</p>
                </div>
              </div>

              {/* Invoice Items */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Tetelek</h3>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Megnevezes</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Egysegar</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">Db</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Osszeg</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {selectedInvoice.items.map((item) => (
                        <tr key={item.id}>
                          <td className="px-3 py-2 text-sm">{item.description}</td>
                          <td className="px-3 py-2 text-sm text-right">{formatCurrency(item.unitPrice, selectedInvoice.currency)}</td>
                          <td className="px-3 py-2 text-sm text-center">{item.quantity}</td>
                          <td className="px-3 py-2 text-sm text-right">{formatCurrency(item.totalPrice, selectedInvoice.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Netto osszeg:</span>
                  <span className="font-medium">{formatCurrency(selectedInvoice.subtotal, selectedInvoice.currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">AFA (27%):</span>
                  <span className="font-medium">{formatCurrency(selectedInvoice.vatAmount, selectedInvoice.currency)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-200">
                  <span className="font-semibold text-gray-900">Brutto osszeg:</span>
                  <span className="font-bold text-lg">{formatCurrency(selectedInvoice.total, selectedInvoice.currency)}</span>
                </div>
              </div>

              {/* External link */}
              {selectedInvoice.externalInvoiceUrl && (
                <a
                  href={selectedInvoice.externalInvoiceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full py-3 text-center bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Szamla megtekintese (PDF)
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
