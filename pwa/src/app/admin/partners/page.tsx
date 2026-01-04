'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface PartnerCompany {
  id: string;
  code: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  isActive: boolean;
  billingType: 'CONTRACT' | 'CASH';
  billingCycle?: 'MONTHLY' | 'WEEKLY';
  billingName?: string;
  billingAddress?: string;
  billingCity?: string;
  billingZipCode?: string;
  taxNumber?: string;
  createdAt: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const NETWORK_ID = 'cf808392-6283-4487-9fbd-e72951ca5bf8';

export default function PartnersPage() {
  const [partners, setPartners] = useState<PartnerCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'CONTRACT' | 'CASH'>('ALL');

  useEffect(() => {
    loadPartners();
  }, []);

  const loadPartners = async () => {
    try {
      const response = await fetch(`${API_URL}/operator/partner-companies`, {
        headers: { 'x-network-id': NETWORK_ID },
      });

      if (response.ok) {
        const data = await response.json();
        setPartners(data);
      } else {
        throw new Error('Nem sikerült betölteni a partnereket');
      }
    } catch (err: any) {
      setError(err.message || 'Hiba történt');
    } finally {
      setLoading(false);
    }
  };

  const filteredPartners = partners.filter((partner) => {
    const matchesSearch =
      partner.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      partner.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      partner.taxNumber?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType =
      filterType === 'ALL' || partner.billingType === filterType;

    return matchesSearch && matchesType;
  });

  const contractPartners = partners.filter((p) => p.billingType === 'CONTRACT');
  const cashPartners = partners.filter((p) => p.billingType === 'CASH');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Partner cégek</h1>
          <p className="text-gray-500">Szerződéses és készpénzes partnerek kezelése</p>
        </div>
        <Link
          href="/admin/partners/new"
          className="px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
        >
          + Új partner
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-2xl font-bold text-gray-900">{partners.length}</p>
          <p className="text-sm text-gray-500">Összes partner</p>
        </div>
        <div className="bg-blue-50 rounded-xl shadow-sm p-4">
          <p className="text-2xl font-bold text-blue-700">{contractPartners.length}</p>
          <p className="text-sm text-blue-600">Szerződéses</p>
        </div>
        <div className="bg-green-50 rounded-xl shadow-sm p-4">
          <p className="text-2xl font-bold text-green-700">{cashPartners.length}</p>
          <p className="text-sm text-green-600">Készpénzes</p>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-xl shadow-sm p-4 flex gap-4">
        <input
          type="text"
          placeholder="Keresés név, kód vagy adószám alapján..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as 'ALL' | 'CONTRACT' | 'CASH')}
          className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        >
          <option value="ALL">Összes típus</option>
          <option value="CONTRACT">Szerződéses</option>
          <option value="CASH">Készpénzes</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600">
          {error}
        </div>
      )}

      {/* Partners Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Betöltés...</div>
        ) : filteredPartners.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {searchTerm || filterType !== 'ALL'
              ? 'Nincs találat a keresésre.'
              : 'Nincsenek partnerek. Hozd létre az elsőt!'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Partner
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Típus
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Számlázási ciklus
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Adószám
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Kapcsolat
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Státusz
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Műveletek
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredPartners.map((partner) => (
                  <tr key={partner.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <p className="font-medium text-gray-900">{partner.name}</p>
                        <p className="text-sm text-gray-500 font-mono">{partner.code}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                          partner.billingType === 'CONTRACT'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {partner.billingType === 'CONTRACT' ? 'Szerződéses' : 'Készpénzes'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {partner.billingType === 'CONTRACT' ? (
                        partner.billingCycle === 'WEEKLY' ? 'Heti' : 'Havi'
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-mono">
                      {partner.taxNumber || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm">
                        {partner.contactName && (
                          <p className="text-gray-900">{partner.contactName}</p>
                        )}
                        {partner.email && (
                          <p className="text-gray-500">{partner.email}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                          partner.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {partner.isActive ? 'Aktív' : 'Inaktív'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex gap-2">
                        <Link
                          href={`/admin/partners/${partner.id}`}
                          className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                        >
                          Részletek
                        </Link>
                        <Link
                          href={`/admin/partners/${partner.id}/edit`}
                          className="text-gray-600 hover:text-gray-700 text-sm font-medium"
                        >
                          Szerkesztés
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary */}
      {!loading && partners.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">
              Összesen: <strong>{partners.length}</strong> partner
            </span>
            {(searchTerm || filterType !== 'ALL') && (
              <span className="text-gray-500">
                Találatok: <strong>{filteredPartners.length}</strong>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
