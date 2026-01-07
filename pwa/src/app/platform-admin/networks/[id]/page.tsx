'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { platformApi, getPlatformAdmin } from '@/lib/platform-api';

interface NetworkDetail {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  subscriptionStatus: 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
  trialEndsAt?: string;
  subscriptionStartAt?: string;
  subscriptionEndAt?: string;
  country: string;
  timezone: string;
  defaultCurrency: string;
  defaultLanguage: string;
  createdAt: string;
  locationCount: number;
  driverCount: number;
  washEventCount: number;
  partnerCompanyCount: number;
  // Egyedi árazás
  customMonthlyFee?: number | null;
  customPerWashFee?: number | null;
  pricingNotes?: string | null;
  platformMonthlyFee?: number;
  platformPerWashFee?: number;
  effectiveMonthlyFee: number;
  effectivePerWashFee: number;
}

interface NetworkAdmin {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

export default function NetworkDetailPage() {
  const params = useParams();
  const router = useRouter();
  const networkId = params.id as string;
  const admin = getPlatformAdmin();
  const isOwner = admin?.role === 'PLATFORM_OWNER';

  const [network, setNetwork] = useState<NetworkDetail | null>(null);
  const [admins, setAdmins] = useState<NetworkAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'pricing' | 'admins'>('details');

  // Edit form state
  const [editMode, setEditMode] = useState(false);
  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [subscriptionStatus, setSubscriptionStatus] = useState('TRIAL');
  const [trialEndsAt, setTrialEndsAt] = useState('');
  const [country, setCountry] = useState('HU');
  const [timezone, setTimezone] = useState('Europe/Budapest');
  const [defaultCurrency, setDefaultCurrency] = useState('HUF');

  // Pricing state
  const [useCustomPricing, setUseCustomPricing] = useState(false);
  const [customMonthlyFee, setCustomMonthlyFee] = useState<string>('');
  const [customPerWashFee, setCustomPerWashFee] = useState<string>('');
  const [pricingNotes, setPricingNotes] = useState('');

  // Admin modal state
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminRole, setAdminRole] = useState('NETWORK_ADMIN');

  useEffect(() => {
    loadNetwork();
  }, [networkId]);

  const loadNetwork = async () => {
    try {
      setLoading(true);
      const [networkData, adminsData] = await Promise.all([
        platformApi.getNetwork(networkId),
        platformApi.listNetworkAdmins(networkId),
      ]);
      setNetwork(networkData);
      setAdmins(adminsData);

      // Initialize form fields
      setName(networkData.name);
      setIsActive(networkData.isActive);
      setSubscriptionStatus(networkData.subscriptionStatus);
      setTrialEndsAt(networkData.trialEndsAt ? networkData.trialEndsAt.split('T')[0] : '');
      setCountry(networkData.country);
      setTimezone(networkData.timezone);
      setDefaultCurrency(networkData.defaultCurrency);

      // Initialize pricing fields
      const hasCustomPricing = networkData.customMonthlyFee !== null || networkData.customPerWashFee !== null;
      setUseCustomPricing(hasCustomPricing);
      setCustomMonthlyFee(networkData.customMonthlyFee?.toString() || '');
      setCustomPerWashFee(networkData.customPerWashFee?.toString() || '');
      setPricingNotes(networkData.pricingNotes || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba történt');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const updated = await platformApi.updateNetwork(networkId, {
        name,
        isActive,
        subscriptionStatus: subscriptionStatus as any,
        trialEndsAt: trialEndsAt || undefined,
        country,
        timezone,
        defaultCurrency,
      });
      setNetwork(updated);
      setEditMode(false);
      setSuccess('Hálózat mentve!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba történt');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Biztosan törölni szeretnéd ezt a hálózatot? Ez a művelet nem vonható vissza.')) {
      return;
    }

    try {
      await platformApi.deleteNetwork(networkId);
      router.push('/platform-admin/networks');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba történt');
    }
  };

  const handleSavePricing = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const updated = await platformApi.updateNetwork(networkId, {
        customMonthlyFee: useCustomPricing && customMonthlyFee ? parseFloat(customMonthlyFee) : null,
        customPerWashFee: useCustomPricing && customPerWashFee ? parseFloat(customPerWashFee) : null,
        pricingNotes: pricingNotes || null,
      } as any);
      setNetwork(updated);
      setSuccess('Árazás mentve!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba történt');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hu-HU', {
      style: 'currency',
      currency: 'HUF',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const newAdmin = await platformApi.createNetworkAdmin(networkId, {
        email: adminEmail,
        name: adminName,
        password: adminPassword,
        role: adminRole,
      });
      setAdmins([newAdmin, ...admins]);
      setShowAdminModal(false);
      setAdminEmail('');
      setAdminName('');
      setAdminPassword('');
      setAdminRole('NETWORK_ADMIN');
      setSuccess('Admin létrehozva!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba történt');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAdminActive = async (adminId: string, currentActive: boolean) => {
    try {
      const updated = await platformApi.updateNetworkAdmin(networkId, adminId, {
        isActive: !currentActive,
      });
      setAdmins(admins.map(a => a.id === adminId ? updated : a));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba történt');
    }
  };

  const handleDeleteAdmin = async (adminId: string) => {
    if (!confirm('Biztosan törölni szeretnéd ezt az admint?')) {
      return;
    }

    try {
      await platformApi.deleteNetworkAdmin(networkId, adminId);
      setAdmins(admins.filter(a => a.id !== adminId));
      setSuccess('Admin törölve!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba történt');
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

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'NETWORK_OWNER': return 'Owner';
      case 'NETWORK_ADMIN': return 'Admin';
      case 'NETWORK_OPERATOR': return 'Operator';
      default: return role;
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

  if (!network) {
    return (
      <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 text-red-300">
        Hálózat nem található
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/platform-admin/networks"
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">{network.name}</h1>
            <p className="text-gray-400 text-sm">{network.slug}</p>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(network.subscriptionStatus)}`}>
            {getStatusLabel(network.subscriptionStatus)}
          </span>
        </div>
        <div className="flex gap-3">
          {editMode ? (
            <>
              <button
                onClick={() => setEditMode(false)}
                className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors text-sm font-medium"
              >
                Mégse
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors text-sm font-medium"
              >
                {saving ? 'Mentés...' : 'Mentés'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditMode(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
              >
                Szerkesztés
              </button>
              {isOwner && (
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                >
                  Törlés
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 text-red-300">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-900/50 border border-green-500 rounded-lg p-4 text-green-300">
          {success}
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-xl p-4">
          <p className="text-2xl font-bold text-white">{network.locationCount}</p>
          <p className="text-sm text-gray-400">Helyszín</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4">
          <p className="text-2xl font-bold text-white">{network.driverCount}</p>
          <p className="text-sm text-gray-400">Sofőr</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4">
          <p className="text-2xl font-bold text-white">{network.partnerCompanyCount}</p>
          <p className="text-sm text-gray-400">Partner cég</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4">
          <p className="text-2xl font-bold text-white">{network.washEventCount.toLocaleString('hu-HU')}</p>
          <p className="text-sm text-gray-400">Összes mosás</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-700">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('details')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'details'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            Részletek
          </button>
          <button
            onClick={() => setActiveTab('pricing')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'pricing'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            Árazás
          </button>
          <button
            onClick={() => setActiveTab('admins')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'admins'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            Adminok ({admins.length})
          </button>
        </nav>
      </div>

      {/* Details tab */}
      {activeTab === 'details' && (
        <div className="bg-gray-800 rounded-xl p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Hálózat neve
              </label>
              {editMode ? (
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              ) : (
                <p className="text-white">{network.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Slug
              </label>
              <p className="text-gray-400">{network.slug}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Státusz
              </label>
              {editMode ? (
                <select
                  value={subscriptionStatus}
                  onChange={(e) => setSubscriptionStatus(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="TRIAL">Trial</option>
                  <option value="ACTIVE">Aktív</option>
                  <option value="SUSPENDED">Felfüggesztve</option>
                  <option value="CANCELLED">Lemondva</option>
                </select>
              ) : (
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(network.subscriptionStatus)}`}>
                  {getStatusLabel(network.subscriptionStatus)}
                </span>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Aktív
              </label>
              {editMode ? (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-gray-300">Igen</span>
                </label>
              ) : (
                <p className={network.isActive ? 'text-green-400' : 'text-red-400'}>
                  {network.isActive ? 'Igen' : 'Nem'}
                </p>
              )}
            </div>

            {subscriptionStatus === 'TRIAL' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Trial lejárat
                </label>
                {editMode ? (
                  <input
                    type="date"
                    value={trialEndsAt}
                    onChange={(e) => setTrialEndsAt(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                ) : (
                  <p className="text-white">{formatDate(network.trialEndsAt)}</p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Ország
              </label>
              {editMode ? (
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
              ) : (
                <p className="text-white">{network.country}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Pénznem
              </label>
              {editMode ? (
                <select
                  value={defaultCurrency}
                  onChange={(e) => setDefaultCurrency(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="HUF">HUF - Magyar forint</option>
                  <option value="EUR">EUR - Euró</option>
                </select>
              ) : (
                <p className="text-white">{network.defaultCurrency}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Időzóna
              </label>
              {editMode ? (
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Europe/Budapest">Europe/Budapest</option>
                  <option value="Europe/Vienna">Europe/Vienna</option>
                  <option value="Europe/Berlin">Europe/Berlin</option>
                  <option value="Europe/Warsaw">Europe/Warsaw</option>
                  <option value="Europe/Prague">Europe/Prague</option>
                  <option value="Europe/Bucharest">Europe/Bucharest</option>
                </select>
              ) : (
                <p className="text-white">{network.timezone}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Létrehozva
              </label>
              <p className="text-gray-400">{formatDate(network.createdAt)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Pricing tab */}
      {activeTab === 'pricing' && (
        <div className="space-y-6">
          {/* Current pricing info */}
          <div className="bg-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Jelenlegi árazás</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-700/50 rounded-lg p-4">
                <p className="text-sm text-gray-400 mb-1">Havi alapdíj</p>
                <p className="text-2xl font-bold text-white">
                  {formatCurrency(network.effectiveMonthlyFee)}
                </p>
                {network.customMonthlyFee !== null && (
                  <p className="text-xs text-indigo-400 mt-1">Egyedi ár (platform: {formatCurrency(network.platformMonthlyFee || 0)})</p>
                )}
              </div>
              <div className="bg-gray-700/50 rounded-lg p-4">
                <p className="text-sm text-gray-400 mb-1">Mosásonkénti díj</p>
                <p className="text-2xl font-bold text-white">
                  {formatCurrency(network.effectivePerWashFee)}
                </p>
                {network.customPerWashFee !== null && (
                  <p className="text-xs text-indigo-400 mt-1">Egyedi ár (platform: {formatCurrency(network.platformPerWashFee || 0)})</p>
                )}
              </div>
            </div>
          </div>

          {/* Custom pricing settings */}
          <div className="bg-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Egyedi árazás beállítása</h2>

            <div className="space-y-6">
              <div>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={useCustomPricing}
                    onChange={(e) => setUseCustomPricing(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-white">Egyedi árazás használata</span>
                </label>
                <p className="text-sm text-gray-400 mt-1 ml-8">
                  Ha bekapcsolod, ez a hálózat egyedi árakat kap a platform alapértelmezett helyett.
                </p>
              </div>

              {useCustomPricing && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-700">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Egyedi havi alapdíj (HUF)
                    </label>
                    <input
                      type="number"
                      value={customMonthlyFee}
                      onChange={(e) => setCustomMonthlyFee(e.target.value)}
                      placeholder={network.platformMonthlyFee?.toString() || '0'}
                      className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Platform alapértelmezett: {formatCurrency(network.platformMonthlyFee || 0)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Egyedi mosásonkénti díj (HUF)
                    </label>
                    <input
                      type="number"
                      value={customPerWashFee}
                      onChange={(e) => setCustomPerWashFee(e.target.value)}
                      placeholder={network.platformPerWashFee?.toString() || '0'}
                      className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Platform alapértelmezett: {formatCurrency(network.platformPerWashFee || 0)}</p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Megjegyzések
                </label>
                <textarea
                  value={pricingNotes}
                  onChange={(e) => setPricingNotes(e.target.value)}
                  rows={3}
                  placeholder="Pl. Kedvezményes ár a korai regisztráció miatt..."
                  className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleSavePricing}
                  disabled={saving}
                  className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors font-medium"
                >
                  {saving ? 'Mentés...' : 'Árazás mentése'}
                </button>
              </div>
            </div>
          </div>

          {/* Info box */}
          <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-300 mb-1">Hogyan működik az egyedi árazás?</h3>
            <ul className="text-sm text-blue-200 list-disc list-inside space-y-1">
              <li>Ha nincs egyedi ár beállítva, a platform alapértelmezett árai érvényesek</li>
              <li>Az egyedi árak felülírják a platform alapértelmezett árait</li>
              <li>A Network Admin a saját subscription oldalán az egyedi árakat látja</li>
              <li>A Stripe számlázás továbbra is a platform árakat használja, a különbözetet manuálisan kell kezelni</li>
            </ul>
          </div>
        </div>
      )}

      {/* Admins tab */}
      {activeTab === 'admins' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowAdminModal(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Új admin
            </button>
          </div>

          <div className="bg-gray-800 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Név</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Email</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Szerepkör</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Státusz</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Utolsó belépés</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {admins.map((admin) => (
                  <tr key={admin.id} className="hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 text-white font-medium">{admin.name}</td>
                    <td className="px-6 py-4 text-gray-300">{admin.email}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        admin.role === 'NETWORK_OWNER' ? 'bg-purple-500/20 text-purple-400' :
                        admin.role === 'NETWORK_ADMIN' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {getRoleLabel(admin.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleAdminActive(admin.id, admin.isActive)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          admin.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {admin.isActive ? 'Aktív' : 'Inaktív'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-sm">
                      {admin.lastLoginAt ? formatDate(admin.lastLoginAt) : 'Még nem lépett be'}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleDeleteAdmin(admin.id)}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        Törlés
                      </button>
                    </td>
                  </tr>
                ))}
                {admins.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                      Még nincs admin hozzáadva
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create admin modal */}
      {showAdminModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Új admin hozzáadása</h2>
              <button onClick={() => setShowAdminModal(false)} className="text-gray-400 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateAdmin} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="admin@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Név *
                </label>
                <input
                  type="text"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Admin neve"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Jelszó *
                </label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Min. 8 karakter"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Szerepkör
                </label>
                <select
                  value={adminRole}
                  onChange={(e) => setAdminRole(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="NETWORK_OWNER">Owner</option>
                  <option value="NETWORK_ADMIN">Admin</option>
                  <option value="NETWORK_OPERATOR">Operator</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdminModal(false)}
                  className="flex-1 px-4 py-2.5 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors font-medium"
                >
                  Mégse
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {saving ? 'Létrehozás...' : 'Létrehozás'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
