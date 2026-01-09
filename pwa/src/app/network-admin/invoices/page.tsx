'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { networkAdminApi } from '@/lib/network-admin-api';

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
  partnerCompany: { id: string; name: string; code: string };
  itemCount: number;
  externalId?: string;
  pdfUrl?: string;
}

interface InvoiceSummary {
  totalCount: number;
  totalAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  overdueAmount: number;
  draftAmount: number;
  byStatus: Record<string, { count: number; amount: number }>;
}

interface PartnerCompany {
  id: string;
  name: string;
  code?: string;
}

interface InvoiceDetail {
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
  externalId?: string;
  pdfUrl?: string;
  partnerCompany: {
    id: string;
    name: string;
    code: string;
    taxNumber?: string;
    billingAddress?: string;
    email?: string;
  };
  items: {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    vatRate: number;
  }[];
  washEvents: {
    id: string;
    status: string;
    tractorPlate?: string;
    locationName?: string;
    createdAt: string;
    totalPrice: number;
  }[];
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [summary, setSummary] = useState<InvoiceSummary | null>(null);
  const [partners, setPartners] = useState<PartnerCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 3);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState('');
  const [partnerFilter, setPartnerFilter] = useState('');

  // New invoice modal
  const [showNewInvoiceModal, setShowNewInvoiceModal] = useState(false);
  const [newInvoiceData, setNewInvoiceData] = useState({
    partnerCompanyId: '',
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    dueDays: 15,
  });
  const [creatingInvoice, setCreatingInvoice] = useState(false);

  // Invoice detail modal
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    loadData();
    loadPartners();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [invoicesRes, summaryRes] = await Promise.all([
        networkAdminApi.listInvoices({
          startDate,
          endDate,
          status: statusFilter || undefined,
          partnerCompanyId: partnerFilter || undefined,
        }),
        networkAdminApi.getInvoiceSummary({ startDate, endDate }),
      ]);
      setInvoices(invoicesRes.data);
      setSummary(summaryRes);
    } catch (err: any) {
      setError(err.message || 'Hiba tortent az adatok betoltesenel');
    } finally {
      setLoading(false);
    }
  };

  const loadPartners = async () => {
    try {
      const res = await networkAdminApi.listPartnerCompanies();
      setPartners(res);
    } catch (err) {
      console.error('Failed to load partners', err);
    }
  };

  const handleFilter = () => {
    loadData();
  };

  const handlePrepareInvoice = async () => {
    if (!newInvoiceData.partnerCompanyId) {
      setError('Valassz partnert');
      return;
    }
    setCreatingInvoice(true);
    setError('');
    try {
      const result = await networkAdminApi.prepareInvoice({
        partnerCompanyId: newInvoiceData.partnerCompanyId,
        startDate: newInvoiceData.startDate,
        endDate: newInvoiceData.endDate,
        dueDays: newInvoiceData.dueDays,
      });
      setShowNewInvoiceModal(false);
      loadData();
      // Show the new invoice
      handleViewInvoice(result.id);
    } catch (err: any) {
      setError(err.message || 'Hiba a szamla keszitesenel');
    } finally {
      setCreatingInvoice(false);
    }
  };

  const handleViewInvoice = async (invoiceId: string) => {
    setLoadingDetail(true);
    try {
      const detail = await networkAdminApi.getInvoice(invoiceId);
      setSelectedInvoice(detail);
    } catch (err: any) {
      setError(err.message || 'Hiba a szamla betoltesenel');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleIssueInvoice = async (invoiceId: string) => {
    if (!confirm('Biztosan kiallitod a szamlat? Ez utan mar nem modosithato.')) return;
    try {
      await networkAdminApi.issueInvoice(invoiceId);
      loadData();
      if (selectedInvoice?.id === invoiceId) {
        handleViewInvoice(invoiceId);
      }
    } catch (err: any) {
      setError(err.message || 'Hiba a szamla kiallitasanal');
    }
  };

  const handleMarkPaid = async (invoiceId: string) => {
    try {
      await networkAdminApi.markInvoicePaid(invoiceId);
      loadData();
      if (selectedInvoice?.id === invoiceId) {
        handleViewInvoice(invoiceId);
      }
    } catch (err: any) {
      setError(err.message || 'Hiba a fizetes rogzitesenel');
    }
  };

  const handleCancelInvoice = async (invoiceId: string) => {
    const reason = prompt('Stornoalas oka (opcionalis):');
    if (reason === null) return;
    try {
      await networkAdminApi.cancelInvoice(invoiceId, reason || undefined);
      loadData();
      setSelectedInvoice(null);
    } catch (err: any) {
      setError(err.message || 'Hiba a szamla stornoalasanal');
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!confirm('Biztosan torlod a piszkozatot?')) return;
    try {
      await networkAdminApi.deleteInvoice(invoiceId);
      loadData();
      setSelectedInvoice(null);
    } catch (err: any) {
      setError(err.message || 'Hiba a szamla torlesenel');
    }
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
      OVERDUE: 'Lejart',
      CANCELLED: 'Sztornozva',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100'}`}>
        {labels[status] || status}
      </span>
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Szamlak</h1>
          <p className="text-gray-500 mt-1">Partner szamlak kezelese</p>
        </div>
        <button
          onClick={() => setShowNewInvoiceModal(true)}
          className="px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
        >
          + Uj szamla keszitese
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          {error}
          <button onClick={() => setError('')} className="ml-2 text-red-500 hover:text-red-700">
            &times;
          </button>
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="text-2xl font-bold text-gray-900">{summary.totalCount}</div>
            <div className="text-sm text-gray-500">Osszes szamla</div>
            <div className="text-xs text-gray-400">{formatCurrency(summary.totalAmount)}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="text-2xl font-bold text-green-600">{formatCurrency(summary.paidAmount)}</div>
            <div className="text-sm text-gray-500">Fizetve</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="text-2xl font-bold text-yellow-600">{formatCurrency(summary.unpaidAmount)}</div>
            <div className="text-sm text-gray-500">Fizetendo</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="text-2xl font-bold text-red-600">{formatCurrency(summary.overdueAmount)}</div>
            <div className="text-sm text-gray-500">Lejart</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="text-2xl font-bold text-gray-400">{formatCurrency(summary.draftAmount)}</div>
            <div className="text-sm text-gray-500">Piszkozat</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kezdo datum</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Befejezo datum</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Statusz</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Mind</option>
              <option value="DRAFT">Piszkozat</option>
              <option value="ISSUED">Kiallitva</option>
              <option value="SENT">Elkuldve</option>
              <option value="PAID">Fizetve</option>
              <option value="OVERDUE">Lejart</option>
              <option value="CANCELLED">Sztornozva</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Partner</label>
            <select
              value={partnerFilter}
              onChange={(e) => setPartnerFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Mind</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleFilter}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Szures
          </button>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Betoltes...</div>
        ) : invoices.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Nincs talalat</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Szamlaszam</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Partner</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kiallitas</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hatarido</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Osszeg</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statusz</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Muvelet</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono text-gray-900">
                      {invoice.invoiceNumber || invoice.id.substring(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{invoice.partnerCompany.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {new Date(invoice.issueDate).toLocaleDateString('hu-HU')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {new Date(invoice.dueDate).toLocaleDateString('hu-HU')}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                      {formatCurrency(invoice.total, invoice.currency)}
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(invoice.status)}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleViewInvoice(invoice.id)}
                        className="text-primary-600 hover:text-primary-800 text-sm mr-2"
                      >
                        Reszletek
                      </button>
                      {invoice.status === 'DRAFT' && (
                        <button
                          onClick={() => handleIssueInvoice(invoice.id)}
                          className="text-green-600 hover:text-green-800 text-sm"
                        >
                          Kiallitas
                        </button>
                      )}
                      {['ISSUED', 'SENT', 'OVERDUE'].includes(invoice.status) && (
                        <button
                          onClick={() => handleMarkPaid(invoice.id)}
                          className="text-green-600 hover:text-green-800 text-sm"
                        >
                          Fizetve
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Invoice Modal */}
      {showNewInvoiceModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowNewInvoiceModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Uj szamla keszitese</h2>
              <p className="text-sm text-gray-500 mt-1">Valaszd ki a partnert es az idoszakot</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Partner ceg *</label>
                <select
                  value={newInvoiceData.partnerCompanyId}
                  onChange={(e) => setNewInvoiceData({ ...newInvoiceData, partnerCompanyId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">Valassz partnert...</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Idoszak kezdete</label>
                  <input
                    type="date"
                    value={newInvoiceData.startDate}
                    onChange={(e) => setNewInvoiceData({ ...newInvoiceData, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Idoszak vege</label>
                  <input
                    type="date"
                    value={newInvoiceData.endDate}
                    onChange={(e) => setNewInvoiceData({ ...newInvoiceData, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fizetesi hatarido (nap)</label>
                <input
                  type="number"
                  value={newInvoiceData.dueDays}
                  onChange={(e) => setNewInvoiceData({ ...newInvoiceData, dueDays: parseInt(e.target.value) || 15 })}
                  min="1"
                  max="90"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex gap-3 justify-end">
              <button
                onClick={() => setShowNewInvoiceModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Megse
              </button>
              <button
                onClick={handlePrepareInvoice}
                disabled={creatingInvoice || !newInvoiceData.partnerCompanyId}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                {creatingInvoice ? 'Keszites...' : 'Szamla keszitese'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedInvoice(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {loadingDetail ? (
              <div className="p-8 text-center text-gray-500">Betoltes...</div>
            ) : (
              <>
                {/* Header */}
                <div className="p-6 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">
                        Szamla {selectedInvoice.invoiceNumber || selectedInvoice.id.substring(0, 8)}
                      </h2>
                      <p className="text-sm text-gray-500">{selectedInvoice.partnerCompany.name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(selectedInvoice.status)}
                      <button
                        onClick={() => setSelectedInvoice(null)}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                  {/* Partner Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Partner</p>
                      <p className="font-medium">{selectedInvoice.partnerCompany.name}</p>
                      {selectedInvoice.partnerCompany.taxNumber && (
                        <p className="text-sm text-gray-500">Adoszam: {selectedInvoice.partnerCompany.taxNumber}</p>
                      )}
                      {selectedInvoice.partnerCompany.billingAddress && (
                        <p className="text-sm text-gray-500">{selectedInvoice.partnerCompany.billingAddress}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Kiallitas datuma</p>
                      <p className="font-medium">{new Date(selectedInvoice.issueDate).toLocaleDateString('hu-HU')}</p>
                      <p className="text-sm text-gray-500 mt-2">Fizetesi hatarido</p>
                      <p className="font-medium">{new Date(selectedInvoice.dueDate).toLocaleDateString('hu-HU')}</p>
                      {selectedInvoice.paidDate && (
                        <>
                          <p className="text-sm text-gray-500 mt-2">Fizetve</p>
                          <p className="font-medium text-green-600">
                            {new Date(selectedInvoice.paidDate).toLocaleDateString('hu-HU')}
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Items */}
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
                              <td className="px-3 py-2 text-sm text-right">
                                {formatCurrency(item.unitPrice, selectedInvoice.currency)}
                              </td>
                              <td className="px-3 py-2 text-sm text-center">{item.quantity}</td>
                              <td className="px-3 py-2 text-sm text-right">
                                {formatCurrency(item.totalPrice, selectedInvoice.currency)}
                              </td>
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

                  {/* Wash Events */}
                  {selectedInvoice.washEvents.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        Kapcsolodo mosasok ({selectedInvoice.washEvents.length} db)
                      </h3>
                      <div className="border border-gray-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Datum</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Rendszam</th>
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Helyszin</th>
                              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Osszeg</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {selectedInvoice.washEvents.map((event) => (
                              <tr key={event.id}>
                                <td className="px-3 py-2 text-sm">
                                  {new Date(event.createdAt).toLocaleDateString('hu-HU')}
                                </td>
                                <td className="px-3 py-2 text-sm font-mono">{event.tractorPlate || '-'}</td>
                                <td className="px-3 py-2 text-sm">{event.locationName || '-'}</td>
                                <td className="px-3 py-2 text-sm text-right">
                                  {formatCurrency(event.totalPrice, selectedInvoice.currency)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 flex-wrap">
                    {selectedInvoice.status === 'DRAFT' && (
                      <>
                        <button
                          onClick={() => handleIssueInvoice(selectedInvoice.id)}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                          Szamla kiallitasa
                        </button>
                        <button
                          onClick={() => handleDeleteInvoice(selectedInvoice.id)}
                          className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                        >
                          Piszkozat torlese
                        </button>
                      </>
                    )}
                    {['ISSUED', 'SENT', 'OVERDUE'].includes(selectedInvoice.status) && (
                      <>
                        <button
                          onClick={() => handleMarkPaid(selectedInvoice.id)}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                          Fizetve
                        </button>
                        <button
                          onClick={() => handleCancelInvoice(selectedInvoice.id)}
                          className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                        >
                          Sztornozas
                        </button>
                      </>
                    )}
                    {selectedInvoice.pdfUrl && (
                      <a
                        href={selectedInvoice.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                      >
                        PDF megtekintes
                      </a>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
