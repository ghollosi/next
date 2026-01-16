'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchOperatorApi } from '@/lib/network-admin-api';

interface PartnerCompany {
  id: string;
  code: string;
  name: string;
  taxNumber?: string;
  billingAddress?: string;
  contactEmail?: string;
  contactPhone?: string;
  isActive: boolean;
  driverCount?: number;
  vehicleCount?: number;
  createdAt: string;
}

export default function PartnersPage() {
  const [partners, setPartners] = useState<PartnerCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadPartners();
  }, []);

  const loadPartners = async () => {
    try {
      const data = await fetchOperatorApi<PartnerCompany[]>('/operator/partner-companies');
      setPartners(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load partner companies');
    } finally {
      setLoading(false);
    }
  };

  const filteredPartners = partners.filter((partner) => {
    const search = searchTerm.toLowerCase();
    return (
      partner.name.toLowerCase().includes(search) ||
      partner.code.toLowerCase().includes(search) ||
      partner.taxNumber?.toLowerCase().includes(search)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Partner cégek</h1>
          <p className="text-gray-500">Fuvarozó cégek kezelése</p>
        </div>
        <Link
          href="/network-admin/partners/new"
          className="px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
        >
          + Uj partner
        </Link>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <input
          type="text"
          placeholder="Keresés név, kód vagy adószám alapján..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
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
            {searchTerm
              ? 'Nincs találat a keresésre.'
              : 'Nincsenek partner cégek. Hozd létre az elsőt!'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cég
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Kód
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Adószám
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Elérhetőség
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
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold">
                          {partner.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="ml-3">
                          <p className="font-medium text-gray-900">{partner.name}</p>
                          {partner.billingAddress && (
                            <p className="text-xs text-gray-500">{partner.billingAddress}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-mono text-sm text-gray-600">{partner.code}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">{partner.taxNumber || '-'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm">
                        {partner.contactEmail && (
                          <p className="text-gray-600">{partner.contactEmail}</p>
                        )}
                        {partner.contactPhone && (
                          <p className="text-gray-500">{partner.contactPhone}</p>
                        )}
                        {!partner.contactEmail && !partner.contactPhone && (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          partner.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {partner.isActive ? 'Aktív' : 'Inaktív'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        href={`/network-admin/partners/${partner.id}`}
                        className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                      >
                        Részletek
                      </Link>
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
          <div className="flex items-center justify-between text-sm flex-wrap gap-4">
            <span className="text-gray-500">
              Összesen: <strong>{partners.length}</strong> partner cég
            </span>
            <span className="text-green-600">
              Aktív: <strong>{partners.filter((p) => p.isActive).length}</strong>
            </span>
            {searchTerm && (
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
