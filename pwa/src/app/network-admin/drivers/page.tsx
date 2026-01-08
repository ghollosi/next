'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchOperatorApi } from '@/lib/network-admin-api';

interface PartnerCompany {
  id: string;
  code: string;
  name: string;
}

interface Driver {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  partnerCompany?: PartnerCompany;
  createdAt: string;
}

interface InviteData {
  inviteCode: string;
  inviteUrl?: string;
}

export default function DriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [inviteModal, setInviteModal] = useState<{
    open: boolean;
    driver: Driver | null;
    loading: boolean;
    data: InviteData | null;
    error: string;
  }>({
    open: false,
    driver: null,
    loading: false,
    data: null,
    error: '',
  });

  useEffect(() => {
    loadDrivers();
  }, []);

  const loadDrivers = async () => {
    try {
      const data = await fetchOperatorApi<Driver[]>('/operator/drivers');
      setDrivers(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load drivers');
    } finally {
      setLoading(false);
    }
  };

  const filteredDrivers = drivers.filter((driver) => {
    const fullName = `${driver.firstName} ${driver.lastName}`.toLowerCase();
    const companyName = driver.partnerCompany?.name?.toLowerCase() || '';
    const search = searchTerm.toLowerCase();
    return fullName.includes(search) || companyName.includes(search);
  });

  const openInviteModal = async (driver: Driver) => {
    setInviteModal({
      open: true,
      driver,
      loading: true,
      data: null,
      error: '',
    });

    try {
      const data = await fetchOperatorApi<InviteData>(`/operator/drivers/${driver.id}/invite`);
      setInviteModal((prev) => ({
        ...prev,
        loading: false,
        data,
      }));
    } catch (err: any) {
      setInviteModal((prev) => ({
        ...prev,
        loading: false,
        error: err.message || 'Hiba a meghívó betöltésekor',
      }));
    }
  };

  const closeInviteModal = () => {
    setInviteModal({
      open: false,
      driver: null,
      loading: false,
      data: null,
      error: '',
    });
  };

  const regenerateInvite = async () => {
    if (!inviteModal.driver) return;

    setInviteModal((prev) => ({ ...prev, loading: true, error: '' }));

    try {
      const data = await fetchOperatorApi<InviteData>(
        `/operator/drivers/${inviteModal.driver.id}/regenerate-invite`,
        { method: 'POST' }
      );
      setInviteModal((prev) => ({
        ...prev,
        loading: false,
        data,
      }));
    } catch (err: any) {
      setInviteModal((prev) => ({
        ...prev,
        loading: false,
        error: err.message || 'Hiba az újrageneráláskor',
      }));
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sofőrök</h1>
          <p className="text-gray-500">Regisztrált sofőrök kezelése</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/network-admin/drivers/approvals"
            className="px-4 py-2 bg-yellow-100 text-yellow-700 font-medium rounded-lg hover:bg-yellow-200 transition-colors"
          >
            Jóváhagyásra vár
          </Link>
          <Link
            href="/network-admin/drivers/new"
            className="px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
          >
            + Új sofőr
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <input
          type="text"
          placeholder="Keresés név vagy cég alapján..."
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

      {/* Drivers Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Betöltés...</div>
        ) : filteredDrivers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {searchTerm
              ? 'Nincs találat a keresésre.'
              : 'Nincsenek sofőrök. Hozd létre az elsőt!'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Név
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cég
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Telefon
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Regisztrálva
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Műveletek
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredDrivers.map((driver) => (
                  <tr key={driver.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 font-semibold">
                          {driver.firstName.charAt(0)}
                          {driver.lastName.charAt(0)}
                        </div>
                        <div className="ml-3">
                          <p className="font-medium text-gray-900">
                            {driver.lastName} {driver.firstName}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">
                        {driver.partnerCompany?.name || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">
                        {driver.phone || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">
                        {driver.email || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(driver.createdAt).toLocaleDateString('hu-HU')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex gap-2">
                        <Link
                          href={`/network-admin/drivers/${driver.id}`}
                          className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                        >
                          Részletek
                        </Link>
                        <button
                          onClick={() => openInviteModal(driver)}
                          className="text-gray-600 hover:text-gray-700 text-sm font-medium"
                        >
                          Meghívó
                        </button>
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
      {!loading && drivers.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">
              Összesen: <strong>{drivers.length}</strong> sofőr
            </span>
            {searchTerm && (
              <span className="text-gray-500">
                Találatok: <strong>{filteredDrivers.length}</strong>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {inviteModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Sofőr meghívó
              </h2>
              <button
                onClick={closeInviteModal}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {inviteModal.driver && (
              <p className="text-gray-600">
                Meghívó: <strong>{inviteModal.driver.lastName} {inviteModal.driver.firstName}</strong>
              </p>
            )}

            {inviteModal.loading && (
              <div className="py-8 text-center text-gray-500">
                Betöltés...
              </div>
            )}

            {inviteModal.error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm">
                {inviteModal.error}
              </div>
            )}

            {inviteModal.data && (
              <div className="space-y-4">
                {/* Invite Code */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Meghívó kód
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1 px-4 py-3 bg-gray-100 rounded-lg font-mono text-lg text-center font-bold tracking-wider">
                      {inviteModal.data.inviteCode}
                    </div>
                    <button
                      onClick={() => copyToClipboard(inviteModal.data!.inviteCode)}
                      className="px-4 py-3 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                      title="Másolás"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* QR Code placeholder */}
                <div className="bg-gray-50 rounded-xl p-6 flex flex-col items-center">
                  <div className="w-48 h-48 bg-white border-2 border-gray-200 rounded-lg flex items-center justify-center">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(inviteModal.data.inviteUrl || inviteModal.data.inviteCode)}`}
                      alt="QR Code"
                      className="w-44 h-44"
                    />
                  </div>
                  <p className="mt-3 text-sm text-gray-500 text-center">
                    Szkenneld be a QR kódot a sofőr alkalmazással
                  </p>
                </div>

                {/* URL if available */}
                {inviteModal.data.inviteUrl && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Meghívó link
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={inviteModal.data.inviteUrl}
                        className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600"
                      />
                      <button
                        onClick={() => copyToClipboard(inviteModal.data!.inviteUrl!)}
                        className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                        title="Másolás"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}

                {/* Regenerate button */}
                <button
                  onClick={regenerateInvite}
                  disabled={inviteModal.loading}
                  className="w-full py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
                >
                  Új meghívó kód generálása
                </button>
              </div>
            )}

            <button
              onClick={closeInviteModal}
              className="w-full py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
            >
              Bezárás
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
