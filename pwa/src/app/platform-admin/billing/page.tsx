'use client';

import { useState, useEffect } from 'react';
import { platformApi, getPlatformAdmin, PlatformInvoice } from '@/lib/platform-api';

type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'SENT' | 'PAID' | 'CANCELLED' | 'OVERDUE';

interface BillingSummary {
  invoicesByStatus: { status: InvoiceStatus; count: number; total: number }[];
  thisMonthRevenue: number;
  lastMonthRevenue: number;
  outstandingAmount: number;
  outstandingCount: number;
  activeNetworks: number;
}

interface Network {
  id: string;
  name: string;
  slug: string;
}

interface UsagePreview {
  network: Network;
  periodStart: string;
  periodEnd: string;
  baseMonthlyFee: number;
  washCount: number;
  perWashFee: number;
  washTotal: number;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  currency: string;
}

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: 'Piszkozat',
  ISSUED: 'Kiállított',
  SENT: 'Elküldött',
  PAID: 'Kifizetve',
  CANCELLED: 'Sztornózott',
  OVERDUE: 'Lejárt',
};

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  DRAFT: 'bg-gray-500/20 text-gray-400',
  ISSUED: 'bg-blue-500/20 text-blue-400',
  SENT: 'bg-indigo-500/20 text-indigo-400',
  PAID: 'bg-green-500/20 text-green-400',
  CANCELLED: 'bg-red-500/20 text-red-400',
  OVERDUE: 'bg-orange-500/20 text-orange-400',
};

function formatCurrency(amount: number, currency = 'HUF'): string {
  return new Intl.NumberFormat('hu-HU', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('hu-HU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export default function PlatformBillingPage() {
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [invoices, setInvoices] = useState<PlatformInvoice[]>([]);
  const [networks, setNetworks] = useState<Network[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filter state
  const [filterStatus, setFilterStatus] = useState<InvoiceStatus | ''>('');
  const [filterNetwork, setFilterNetwork] = useState('');

  // Create invoice modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedNetworkId, setSelectedNetworkId] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [usagePreview, setUsagePreview] = useState<UsagePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  // Generate monthly modal
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateYear, setGenerateYear] = useState(new Date().getFullYear());
  const [generateMonth, setGenerateMonth] = useState(new Date().getMonth()); // Previous month
  const [generating, setGenerating] = useState(false);

  const admin = getPlatformAdmin();
  const isOwner = admin?.role === 'PLATFORM_OWNER';

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadInvoices();
  }, [filterStatus, filterNetwork]);

  const loadData = async () => {
    try {
      const [summaryData, networksData] = await Promise.all([
        platformApi.getBillingSummary(),
        platformApi.listNetworks(),
      ]);
      setSummary(summaryData);
      setNetworks(networksData);
      await loadInvoices();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba történt');
    } finally {
      setLoading(false);
    }
  };

  const loadInvoices = async () => {
    try {
      const filters: Record<string, string> = {};
      if (filterStatus) filters.status = filterStatus;
      if (filterNetwork) filters.networkId = filterNetwork;

      const data = await platformApi.getInvoices(filters);
      setInvoices(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba a számlák betöltésekor');
    }
  };

  const loadUsagePreview = async () => {
    if (!selectedNetworkId || !periodStart || !periodEnd) return;

    setPreviewLoading(true);
    try {
      const preview = await platformApi.getUsagePreview(selectedNetworkId, periodStart, periodEnd);
      setUsagePreview(preview);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba az előnézet betöltésekor');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleCreateInvoice = async () => {
    if (!selectedNetworkId || !periodStart || !periodEnd) {
      setError('Kérlek válaszd ki a hálózatot és az időszakot');
      return;
    }

    setCreating(true);
    setError('');

    try {
      await platformApi.createInvoice({
        networkId: selectedNetworkId,
        periodStart,
        periodEnd,
      });
      setSuccess('Számla piszkozat létrehozva');
      setShowCreateModal(false);
      resetCreateModal();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba a számla létrehozásakor');
    } finally {
      setCreating(false);
    }
  };

  const handleIssueInvoice = async (id: string) => {
    if (!confirm('Biztosan kiállítod a számlát? Ez elküldi a számlázó szolgáltatónak.')) return;

    try {
      await platformApi.issueInvoice(id);
      setSuccess('Számla kiállítva');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba a számla kiállításakor');
    }
  };

  const handleMarkPaid = async (id: string) => {
    try {
      await platformApi.markInvoicePaid(id);
      setSuccess('Számla kifizetve jelölve');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba a státusz módosításakor');
    }
  };

  const handleCancelInvoice = async (id: string) => {
    const reason = prompt('Sztornózás oka (opcionális):');
    if (reason === null) return; // User cancelled

    try {
      await platformApi.cancelInvoice(id, reason || undefined);
      setSuccess('Számla sztornózva');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba a sztornózáskor');
    }
  };

  const handleGenerateMonthly = async () => {
    if (!confirm(`Biztosan generálod a ${generateYear}. ${MONTH_NAMES[generateMonth - 1]} havi számlákat minden aktív hálózatnak?`)) {
      return;
    }

    setGenerating(true);
    setError('');

    try {
      const result = await platformApi.generateMonthlyInvoices(generateYear, generateMonth);
      setSuccess(`${result.created} db számla piszkozat létrehozva`);
      setShowGenerateModal(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba a generálásnál');
    } finally {
      setGenerating(false);
    }
  };

  const handleProcessOverdue = async () => {
    try {
      const result = await platformApi.processOverdueInvoices();
      setSuccess(`${result.processed} db számla lejártnak jelölve`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba a feldolgozáskor');
    }
  };

  const resetCreateModal = () => {
    setSelectedNetworkId('');
    setPeriodStart('');
    setPeriodEnd('');
    setUsagePreview(null);
  };

  // Set default period to previous month
  useEffect(() => {
    const now = new Date();
    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    setPeriodStart(firstDayLastMonth.toISOString().split('T')[0]);
    setPeriodEnd(lastDayLastMonth.toISOString().split('T')[0]);

    // Set generate modal defaults
    setGenerateMonth(now.getMonth() === 0 ? 12 : now.getMonth());
    setGenerateYear(now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear());
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Számlázás</h1>
        <div className="flex gap-3">
          <button
            onClick={handleProcessOverdue}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm"
          >
            Lejártak feldolgozása
          </button>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
          >
            Havi számlák generálása
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
          >
            + Új számla
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 text-red-300">
          {error}
          <button onClick={() => setError('')} className="float-right text-red-400 hover:text-red-300">&times;</button>
        </div>
      )}

      {success && (
        <div className="bg-green-900/50 border border-green-500 rounded-lg p-4 text-green-300">
          {success}
          <button onClick={() => setSuccess('')} className="float-right text-green-400 hover:text-green-300">&times;</button>
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-800 rounded-xl p-5">
            <p className="text-sm text-gray-400">Aktív hálózatok</p>
            <p className="text-2xl font-bold text-white mt-1">{summary.activeNetworks}</p>
          </div>
          <div className="bg-gray-800 rounded-xl p-5">
            <p className="text-sm text-gray-400">Ez havi bevétel</p>
            <p className="text-2xl font-bold text-green-400 mt-1">{formatCurrency(summary.thisMonthRevenue)}</p>
            <p className="text-xs text-gray-500 mt-1">
              Előző hónap: {formatCurrency(summary.lastMonthRevenue)}
            </p>
          </div>
          <div className="bg-gray-800 rounded-xl p-5">
            <p className="text-sm text-gray-400">Kintlévőség</p>
            <p className="text-2xl font-bold text-orange-400 mt-1">{formatCurrency(summary.outstandingAmount)}</p>
            <p className="text-xs text-gray-500 mt-1">
              {summary.outstandingCount} db számla
            </p>
          </div>
          <div className="bg-gray-800 rounded-xl p-5">
            <p className="text-sm text-gray-400">Státusz szerinti bontás</p>
            <div className="mt-2 space-y-1">
              {summary.invoicesByStatus.map((item) => (
                <div key={item.status} className="flex justify-between text-sm">
                  <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[item.status]}`}>
                    {STATUS_LABELS[item.status]}
                  </span>
                  <span className="text-gray-300">{item.count} db</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-gray-800 rounded-xl p-4 flex flex-wrap gap-4 items-center">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Státusz</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as InvoiceStatus | '')}
            className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Mind</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Hálózat</label>
          <select
            value={filterNetwork}
            onChange={(e) => setFilterNetwork(e.target.value)}
            className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Mind</option>
            {networks.map((n) => (
              <option key={n.id} value={n.id}>{n.name}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => { setFilterStatus(''); setFilterNetwork(''); }}
          className="mt-5 px-3 py-2 text-sm text-gray-400 hover:text-white"
        >
          Szűrők törlése
        </button>
      </div>

      {/* Invoices Table */}
      <div className="bg-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Számlaszám</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Hálózat</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Időszak</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Összeg</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">Státusz</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Határidő</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Műveletek</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    Nincsenek számlák
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-700/30">
                    <td className="px-4 py-3 text-sm text-white">
                      {invoice.invoiceNumber || <span className="text-gray-500">-</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {invoice.buyerName || invoice.network?.name || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {formatDate(invoice.periodStart)} - {formatDate(invoice.periodEnd)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-white font-medium">
                      {formatCurrency(Number(invoice.total), invoice.currency)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[invoice.status]}`}>
                        {STATUS_LABELS[invoice.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {invoice.dueDate ? formatDate(invoice.dueDate) : '-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {invoice.status === 'DRAFT' && (
                          <>
                            <button
                              onClick={() => handleIssueInvoice(invoice.id)}
                              className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                            >
                              Kiállít
                            </button>
                            <button
                              onClick={() => handleCancelInvoice(invoice.id)}
                              className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                            >
                              Törlés
                            </button>
                          </>
                        )}
                        {(invoice.status === 'ISSUED' || invoice.status === 'SENT' || invoice.status === 'OVERDUE') && (
                          <>
                            <button
                              onClick={() => handleMarkPaid(invoice.id)}
                              className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                            >
                              Kifizetve
                            </button>
                            <button
                              onClick={() => handleCancelInvoice(invoice.id)}
                              className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                            >
                              Sztornó
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Invoice Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold text-white mb-4">Új számla létrehozása</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Hálózat</label>
                <select
                  value={selectedNetworkId}
                  onChange={(e) => { setSelectedNetworkId(e.target.value); setUsagePreview(null); }}
                  className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Válassz hálózatot...</option>
                  {networks.map((n) => (
                    <option key={n.id} value={n.id}>{n.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Időszak kezdete</label>
                  <input
                    type="date"
                    value={periodStart}
                    onChange={(e) => { setPeriodStart(e.target.value); setUsagePreview(null); }}
                    className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Időszak vége</label>
                  <input
                    type="date"
                    value={periodEnd}
                    onChange={(e) => { setPeriodEnd(e.target.value); setUsagePreview(null); }}
                    className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <button
                onClick={loadUsagePreview}
                disabled={!selectedNetworkId || !periodStart || !periodEnd || previewLoading}
                className="w-full py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {previewLoading ? 'Betöltés...' : 'Előnézet betöltése'}
              </button>

              {usagePreview && (
                <div className="bg-gray-700/50 rounded-lg p-4 space-y-2">
                  <h3 className="text-sm font-medium text-white">Számla előnézet</h3>
                  <div className="text-sm text-gray-300 space-y-1">
                    <div className="flex justify-between">
                      <span>Havi alap díj:</span>
                      <span>{formatCurrency(usagePreview.baseMonthlyFee)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Mosások ({usagePreview.washCount} db &times; {formatCurrency(usagePreview.perWashFee)}):</span>
                      <span>{formatCurrency(usagePreview.washTotal)}</span>
                    </div>
                    <div className="border-t border-gray-600 my-2" />
                    <div className="flex justify-between">
                      <span>Nettó:</span>
                      <span>{formatCurrency(usagePreview.subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>ÁFA ({usagePreview.vatRate}%):</span>
                      <span>{formatCurrency(usagePreview.vatAmount)}</span>
                    </div>
                    <div className="flex justify-between text-white font-medium">
                      <span>Bruttó:</span>
                      <span>{formatCurrency(usagePreview.total)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { setShowCreateModal(false); resetCreateModal(); }}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500"
              >
                Mégse
              </button>
              <button
                onClick={handleCreateInvoice}
                disabled={!selectedNetworkId || !periodStart || !periodEnd || creating}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? 'Létrehozás...' : 'Létrehozás'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generate Monthly Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl max-w-md w-full p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Havi számlák generálása</h2>
            <p className="text-sm text-gray-400 mb-4">
              Ez a művelet minden aktív hálózatnak létrehoz egy számla piszkozatot a kiválasztott hónapra.
            </p>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Év</label>
                <input
                  type="number"
                  value={generateYear}
                  onChange={(e) => setGenerateYear(parseInt(e.target.value))}
                  min={2020}
                  max={2100}
                  className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Hónap</label>
                <select
                  value={generateMonth}
                  onChange={(e) => setGenerateMonth(parseInt(e.target.value))}
                  className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {MONTH_NAMES.map((name, index) => (
                    <option key={index} value={index + 1}>{name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowGenerateModal(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500"
              >
                Mégse
              </button>
              <button
                onClick={handleGenerateMonthly}
                disabled={generating}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {generating ? 'Generálás...' : 'Generálás'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const MONTH_NAMES = [
  'Január', 'Február', 'Március', 'Április', 'Május', 'Június',
  'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December',
];
