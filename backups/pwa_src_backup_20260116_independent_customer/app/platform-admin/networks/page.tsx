'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { platformApi } from '@/lib/platform-api';

// Platform View storage key - must match network-admin layout
const PLATFORM_VIEW_KEY = 'vsys_platform_view';

interface Network {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  subscriptionStatus: 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
  trialEndsAt?: string;
  country: string;
  defaultCurrency: string;
  createdAt: string;
  locationCount: number;
  driverCount: number;
  washEventCount: number;
}

export default function NetworksPage() {
  const router = useRouter();
  const [networks, setNetworks] = useState<Network[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadNetworks();
  }, []);

  const handleViewNetwork = (network: Network) => {
    // Store Platform View data in sessionStorage
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(PLATFORM_VIEW_KEY, JSON.stringify({
        networkId: network.id,
        networkName: network.name,
      }));
    }
    // Navigate to Network Admin dashboard
    router.push('/network-admin/dashboard');
  };

  const loadNetworks = async () => {
    try {
      const data = await platformApi.listNetworks();
      setNetworks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba történt');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-500/20 text-green-400';
      case 'TRIAL': return 'bg-yellow-500/20 text-yellow-400';
      case 'SUSPENDED': return 'bg-red-500/20 text-red-400';
      case 'CANCELLED': return 'bg-gray-500/20 text-gray-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'Aktív';
      case 'TRIAL': return 'Trial';
      case 'SUSPENDED': return 'Felfüggesztve';
      case 'CANCELLED': return 'Lemondva';
      default: return status;
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('hu-HU');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Hálózatok</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Új hálózat
        </button>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 text-red-300">
          {error}
        </div>
      )}

      {/* Networks table */}
      <div className="bg-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Hálózat</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Státusz</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Ország</th>
                <th className="text-right px-6 py-4 text-sm font-medium text-gray-400">Helyszínek</th>
                <th className="text-right px-6 py-4 text-sm font-medium text-gray-400">Sofőrök</th>
                <th className="text-right px-6 py-4 text-sm font-medium text-gray-400">Mosások</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Létrehozva</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {networks.map((network) => (
                <tr key={network.id} className="hover:bg-gray-700/50 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-white">{network.name}</p>
                      <p className="text-sm text-gray-400">{network.slug}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(network.subscriptionStatus)}`}>
                      {getStatusLabel(network.subscriptionStatus)}
                    </span>
                    {network.subscriptionStatus === 'TRIAL' && network.trialEndsAt && (
                      <p className="text-xs text-gray-500 mt-1">
                        Lejár: {formatDate(network.trialEndsAt)}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-gray-300">{network.country}</span>
                    <span className="text-gray-500 ml-1">({network.defaultCurrency})</span>
                  </td>
                  <td className="px-6 py-4 text-right text-gray-300">
                    {network.locationCount}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-300">
                    {network.driverCount}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-300">
                    {network.washEventCount.toLocaleString('hu-HU')}
                  </td>
                  <td className="px-6 py-4 text-gray-400 text-sm">
                    {formatDate(network.createdAt)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleViewNetwork(network)}
                        className="text-purple-400 hover:text-purple-300 text-sm font-medium flex items-center gap-1"
                        title="Network Admin oldalak megtekintése"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        Megtekintés
                      </button>
                      <Link
                        href={`/platform-admin/networks/${network.id}`}
                        className="text-indigo-400 hover:text-indigo-300 text-sm font-medium"
                      >
                        Részletek
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {networks.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                    Még nincs hálózat létrehozva
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateNetworkModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadNetworks();
          }}
        />
      )}
    </div>
  );
}

function CreateNetworkModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [country, setCountry] = useState('HU');
  const [currency, setCurrency] = useState('HUF');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleNameChange = (value: string) => {
    setName(value);
    // Auto-generate slug from name
    const autoSlug = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    setSlug(autoSlug);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await platformApi.createNetwork({
        name,
        slug,
        country,
        defaultCurrency: currency,
        ownerEmail: ownerEmail || undefined,
        ownerName: ownerName || undefined,
        ownerPassword: ownerPassword || undefined,
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba történt');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Új hálózat létrehozása</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Hálózat neve *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              required
              className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Pl. Wash Center Kft."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Slug (URL azonosító) *
            </label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              required
              className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="wash-center"
            />
            <p className="text-xs text-gray-500 mt-1">Csak kisbetűk, számok és kötőjel</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Ország
              </label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="HU">Magyarország</option>
                <option value="AT">Ausztria</option>
                <option value="SK">Szlovákia</option>
                <option value="RO">Románia</option>
                <option value="DE">Németország</option>
                <option value="PL">Lengyelország</option>
                <option value="CZ">Csehország</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Pénznem
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="HUF">HUF - Magyar forint</option>
                <option value="EUR">EUR - Euró</option>
              </select>
            </div>
          </div>

          <div className="border-t border-gray-700 pt-4 mt-4">
            <p className="text-sm font-medium text-gray-300 mb-3">Network Admin (opcionális)</p>

            <div className="space-y-3">
              <input
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="admin@example.com"
              />
              <input
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Admin neve"
              />
              <input
                type="password"
                value={ownerPassword}
                onChange={(e) => setOwnerPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Jelszó (min. 8 karakter)"
                minLength={8}
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-900/50 border border-red-500 rounded-lg px-4 py-3 text-red-300 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors font-medium"
            >
              Mégse
            </button>
            <button
              type="submit"
              disabled={loading || !name || !slug}
              className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {loading ? 'Létrehozás...' : 'Létrehozás'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
