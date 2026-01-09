'use client';

import { useEffect, useState, useMemo } from 'react';
import { reportsApi } from '@/lib/network-admin-api';
import { fetchOperatorApi } from '@/lib/network-admin-api';

interface Location {
  id: string;
  name: string;
  code: string;
}

interface PartnerCompany {
  id: string;
  name: string;
}

type ReportType = 'wash-stats' | 'revenue' | 'locations' | 'partners' | 'services';
type GroupBy = 'day' | 'week' | 'month' | 'location' | 'partner';

export default function ReportsPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [locations, setLocations] = useState<Location[]>([]);
  const [partners, setPartners] = useState<PartnerCompany[]>([]);

  // Filters
  const [reportType, setReportType] = useState<ReportType>('wash-stats');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [locationFilter, setLocationFilter] = useState('all');
  const [partnerFilter, setPartnerFilter] = useState('all');
  const [groupBy, setGroupBy] = useState<GroupBy>('day');

  // Report data
  const [washStats, setWashStats] = useState<any>(null);
  const [revenueData, setRevenueData] = useState<any>(null);
  const [locationPerf, setLocationPerf] = useState<any>(null);
  const [partnerSummary, setPartnerSummary] = useState<any>(null);
  const [serviceBreakdown, setServiceBreakdown] = useState<any>(null);

  useEffect(() => {
    loadFilters();
  }, []);

  useEffect(() => {
    loadReport();
  }, [reportType, dateFrom, dateTo, locationFilter, partnerFilter, groupBy]);

  const loadFilters = async () => {
    try {
      const [locs, parts] = await Promise.all([
        fetchOperatorApi<Location[]>('/operator/locations'),
        fetchOperatorApi<PartnerCompany[]>('/operator/partner-companies'),
      ]);
      setLocations(locs);
      setPartners(parts);
    } catch (err: any) {
      console.error('Failed to load filters:', err);
    }
  };

  const loadReport = async () => {
    setLoading(true);
    setError('');

    try {
      const options = {
        startDate: dateFrom,
        endDate: dateTo,
        locationId: locationFilter !== 'all' ? locationFilter : undefined,
        partnerCompanyId: partnerFilter !== 'all' ? partnerFilter : undefined,
        groupBy,
      };

      switch (reportType) {
        case 'wash-stats':
          const stats = await reportsApi.getWashStatistics(options);
          setWashStats(stats);
          break;
        case 'revenue':
          const revenue = await reportsApi.getRevenueReport(options);
          setRevenueData(revenue);
          break;
        case 'locations':
          const locPerf = await reportsApi.getLocationPerformance({
            startDate: dateFrom,
            endDate: dateTo,
          });
          setLocationPerf(locPerf);
          break;
        case 'partners':
          const partSum = await reportsApi.getPartnerSummary({
            startDate: dateFrom,
            endDate: dateTo,
          });
          setPartnerSummary(partSum);
          break;
        case 'services':
          const svcBreak = await reportsApi.getServiceBreakdown({
            startDate: dateFrom,
            endDate: dateTo,
            locationId: locationFilter !== 'all' ? locationFilter : undefined,
          });
          setServiceBreakdown(svcBreak);
          break;
      }
    } catch (err: any) {
      setError(err.message || 'Hiba a riport betoltesekor');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      const result = await reportsApi.exportCsv({
        startDate: dateFrom,
        endDate: dateTo,
        locationId: locationFilter !== 'all' ? locationFilter : undefined,
        partnerCompanyId: partnerFilter !== 'all' ? partnerFilter : undefined,
      });

      // Create and download CSV file
      const blob = new Blob([result.content], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = result.filename;
      link.click();
    } catch (err: any) {
      setError(err.message || 'Hiba az exportalaskor');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hu-HU', {
      style: 'currency',
      currency: 'HUF',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const reportTabs = [
    { id: 'wash-stats', label: 'Mosasi statisztikak', icon: '🚿' },
    { id: 'revenue', label: 'Bevetel', icon: '💰' },
    { id: 'locations', label: 'Helyszinek', icon: '📍' },
    { id: 'partners', label: 'Partnerek', icon: '🏢' },
    { id: 'services', label: 'Szolgaltatasok', icon: '🔧' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Riportok</h1>
          <p className="text-gray-500">Mosasi statisztikak es bevételi kimutatások</p>
        </div>
        <button
          onClick={handleExportCsv}
          className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          CSV Export
        </button>
      </div>

      {/* Report Type Tabs */}
      <div className="bg-white rounded-xl shadow-sm p-2">
        <div className="flex flex-wrap gap-2">
          {reportTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setReportType(tab.id as ReportType)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                ${reportType === tab.id
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kezdo datum</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-primary-500 focus:ring-0 focus:outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Zaro datum</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-primary-500 focus:ring-0 focus:outline-none text-sm"
            />
          </div>

          {/* Location Filter */}
          {(reportType === 'wash-stats' || reportType === 'revenue' || reportType === 'services') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Helyszin</label>
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-primary-500 focus:ring-0 focus:outline-none text-sm"
              >
                <option value="all">Minden helyszin</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Partner Filter */}
          {(reportType === 'wash-stats' || reportType === 'revenue') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Partner</label>
              <select
                value={partnerFilter}
                onChange={(e) => setPartnerFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-primary-500 focus:ring-0 focus:outline-none text-sm"
              >
                <option value="all">Minden partner</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Group By */}
          {(reportType === 'wash-stats' || reportType === 'revenue') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Csoportositas</label>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as GroupBy)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-primary-500 focus:ring-0 focus:outline-none text-sm"
              >
                <option value="day">Naponta</option>
                <option value="week">Hetente</option>
                <option value="month">Havonta</option>
                <option value="location">Helyszinenkent</option>
                <option value="partner">Partnerenkent</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-500">
          Betoltes...
        </div>
      )}

      {/* Wash Statistics Report */}
      {!loading && reportType === 'wash-stats' && washStats && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="text-sm text-gray-500 mb-1">Osszes mosas</div>
              <div className="text-3xl font-bold text-gray-900">{washStats.summary.totalWashes}</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="text-sm text-gray-500 mb-1">Osszes bevetel</div>
              <div className="text-3xl font-bold text-green-600">{formatCurrency(washStats.summary.totalRevenue)}</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="text-sm text-gray-500 mb-1">Atlagos ar</div>
              <div className="text-3xl font-bold text-blue-600">{formatCurrency(washStats.summary.averagePrice)}</div>
            </div>
          </div>

          {/* Grouped Data Table */}
          {washStats.groupedData.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">Reszletes adatok</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        {groupBy === 'day' ? 'Datum' : groupBy === 'week' ? 'Het' : groupBy === 'month' ? 'Honap' : groupBy === 'location' ? 'Helyszin' : 'Partner'}
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Mosasok</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Bevetel</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {washStats.groupedData.map((row: any, idx: number) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-900">{row.label}</td>
                        <td className="px-6 py-4 text-sm text-gray-900 text-right">{row.count}</td>
                        <td className="px-6 py-4 text-sm text-gray-900 text-right">{formatCurrency(row.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Status Breakdown */}
          {washStats.statusBreakdown.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Statusz szerinti megoszlas</h3>
              <div className="flex flex-wrap gap-4">
                {washStats.statusBreakdown.map((s: any) => (
                  <div key={s.status} className="bg-gray-100 px-4 py-2 rounded-lg">
                    <span className="text-sm text-gray-500">{s.status.replace('_', ' ')}: </span>
                    <span className="font-semibold">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Revenue Report */}
      {!loading && reportType === 'revenue' && revenueData && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="text-sm text-gray-500 mb-1">Brutto bevetel</div>
              <div className="text-3xl font-bold text-green-600">{formatCurrency(revenueData.summary.grossRevenue)}</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="text-sm text-gray-500 mb-1">Netto bevetel</div>
              <div className="text-3xl font-bold text-blue-600">{formatCurrency(revenueData.summary.netRevenue)}</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="text-sm text-gray-500 mb-1">AFA</div>
              <div className="text-3xl font-bold text-gray-600">{formatCurrency(revenueData.summary.vatAmount)}</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="text-sm text-gray-500 mb-1">Mosasok szama</div>
              <div className="text-3xl font-bold text-gray-900">{revenueData.summary.washCount}</div>
            </div>
          </div>

          {/* Cash vs Contract Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Keszpenzes ugyfelek</h3>
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-2xl font-bold text-gray-900">{revenueData.breakdown.cash.count}</div>
                  <div className="text-sm text-gray-500">mosas</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-green-600">{formatCurrency(revenueData.breakdown.cash.revenue)}</div>
                  <div className="text-sm text-gray-500">bevetel</div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Szerzodeses partnerek</h3>
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-2xl font-bold text-gray-900">{revenueData.breakdown.contract.count}</div>
                  <div className="text-sm text-gray-500">mosas</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-600">{formatCurrency(revenueData.breakdown.contract.revenue)}</div>
                  <div className="text-sm text-gray-500">bevetel</div>
                </div>
              </div>
            </div>
          </div>

          {/* Daily Trend */}
          {revenueData.dailyTrend.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Napi bevetel trend</h3>
              <div className="overflow-x-auto">
                <div className="flex gap-1 min-w-max">
                  {revenueData.dailyTrend.map((day: any) => {
                    const maxRevenue = Math.max(...revenueData.dailyTrend.map((d: any) => d.revenue));
                    const height = maxRevenue > 0 ? (day.revenue / maxRevenue) * 100 : 0;
                    return (
                      <div key={day.date} className="flex flex-col items-center">
                        <div className="h-24 w-8 bg-gray-100 rounded relative flex items-end">
                          <div
                            className="w-full bg-primary-500 rounded"
                            style={{ height: `${height}%` }}
                            title={`${day.date}: ${formatCurrency(day.revenue)}`}
                          />
                        </div>
                        <div className="text-xs text-gray-500 mt-1 transform -rotate-45 origin-left">
                          {day.date.substring(5)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Location Performance Report */}
      {!loading && reportType === 'locations' && locationPerf && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="text-sm text-gray-500 mb-1">Helyszinek szama</div>
              <div className="text-3xl font-bold text-gray-900">{locationPerf.summary.totalLocations}</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="text-sm text-gray-500 mb-1">Osszes mosas</div>
              <div className="text-3xl font-bold text-blue-600">{locationPerf.summary.totalWashes}</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="text-sm text-gray-500 mb-1">Osszes bevetel</div>
              <div className="text-3xl font-bold text-green-600">{formatCurrency(locationPerf.summary.totalRevenue)}</div>
            </div>
          </div>

          {/* Locations Table */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Helyszin teljesitmeny</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Helyszin</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kod</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Mosasok</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Bevetel</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Atlag ar</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Atl. ido (perc)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {locationPerf.locations.map((loc: any) => (
                    <tr key={loc.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{loc.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{loc.code}</td>
                      <td className="px-6 py-4 text-sm text-gray-900 text-right">{loc.washCount}</td>
                      <td className="px-6 py-4 text-sm text-green-600 font-medium text-right">{formatCurrency(loc.revenue)}</td>
                      <td className="px-6 py-4 text-sm text-gray-900 text-right">{formatCurrency(loc.averagePrice)}</td>
                      <td className="px-6 py-4 text-sm text-gray-900 text-right">{loc.averageDurationMinutes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Partner Summary Report */}
      {!loading && reportType === 'partners' && partnerSummary && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="text-sm text-gray-500 mb-1">Partner cegek</div>
              <div className="text-3xl font-bold text-gray-900">{partnerSummary.summary.totalPartners}</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="text-sm text-gray-500 mb-1">Szerzodeses bevetel</div>
              <div className="text-3xl font-bold text-blue-600">{formatCurrency(partnerSummary.summary.totalContractRevenue)}</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="text-sm text-gray-500 mb-1">Keszpenzes bevetel</div>
              <div className="text-3xl font-bold text-green-600">{formatCurrency(partnerSummary.summary.totalCashRevenue)}</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="text-sm text-gray-500 mb-1">Szamlazatlan osszeg</div>
              <div className="text-3xl font-bold text-orange-600">{formatCurrency(partnerSummary.summary.totalUnbilledAmount)}</div>
            </div>
          </div>

          {/* Cash Summary */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Keszpenzes ugyfelek</h3>
            <div className="flex gap-8">
              <div>
                <div className="text-2xl font-bold">{partnerSummary.cash.washCount}</div>
                <div className="text-sm text-gray-500">mosas</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{formatCurrency(partnerSummary.cash.revenue)}</div>
                <div className="text-sm text-gray-500">bevetel</div>
              </div>
            </div>
          </div>

          {/* Partners Table */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Partner cegek</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Partner</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipus</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Mosasok</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Bevetel</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Szamlazott</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Szamlazatlan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {partnerSummary.partners.map((p: any) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{p.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          p.billingType === 'CONTRACT' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {p.billingType === 'CONTRACT' ? 'Szerzodeses' : 'Keszpenzes'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 text-right">{p.washCount}</td>
                      <td className="px-6 py-4 text-sm text-green-600 font-medium text-right">{formatCurrency(p.revenue)}</td>
                      <td className="px-6 py-4 text-sm text-gray-900 text-right">{formatCurrency(p.billedAmount)}</td>
                      <td className="px-6 py-4 text-sm text-orange-600 font-medium text-right">{formatCurrency(p.unbilledAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Service Breakdown Report */}
      {!loading && reportType === 'services' && serviceBreakdown && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="text-sm text-gray-500 mb-1">Szolgaltatasok</div>
              <div className="text-3xl font-bold text-gray-900">{serviceBreakdown.summary.totalServices}</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="text-sm text-gray-500 mb-1">Osszes vegzett</div>
              <div className="text-3xl font-bold text-blue-600">{serviceBreakdown.summary.totalCount}</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="text-sm text-gray-500 mb-1">Osszes bevetel</div>
              <div className="text-3xl font-bold text-green-600">{formatCurrency(serviceBreakdown.summary.totalRevenue)}</div>
            </div>
          </div>

          {/* Services Table */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Szolgaltatas bontás</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Szolgaltatas</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kod</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Darab</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Bevetel</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Atlag ar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {serviceBreakdown.services.map((svc: any) => (
                    <tr key={svc.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{svc.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{svc.code}</td>
                      <td className="px-6 py-4 text-sm text-gray-900 text-right">{svc.count}</td>
                      <td className="px-6 py-4 text-sm text-green-600 font-medium text-right">{formatCurrency(svc.revenue)}</td>
                      <td className="px-6 py-4 text-sm text-gray-900 text-right">{formatCurrency(svc.averagePrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
