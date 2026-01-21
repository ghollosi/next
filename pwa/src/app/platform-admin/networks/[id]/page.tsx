'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { platformApi, getPlatformAdmin } from '@/lib/platform-api';
import AddressInput, { AddressData } from '@/components/address/AddressInput';

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
  // Platform számlázási adatok
  billingCompanyName?: string;
  billingAddress?: string;
  billingCity?: string;
  billingZipCode?: string;
  billingCountry?: string;
  billingTaxNumber?: string;
  billingEuVatNumber?: string;
  billingEmail?: string;
  billingDataComplete: boolean;
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

interface NetworkLocation {
  id: string;
  name: string;
  code: string;
  address?: string;
  city?: string;
  zipCode?: string;
  email?: string;
  phone?: string;
  operationType: 'OWN' | 'SUBCONTRACTOR';
  isActive: boolean;
  washEventCount: number;
  // Alvállalkozói adatok
  subcontractorCompanyName?: string;
  subcontractorTaxNumber?: string;
  subcontractorAddress?: string;
  subcontractorCity?: string;
  subcontractorZipCode?: string;
  subcontractorContactName?: string;
  subcontractorContactPhone?: string;
  subcontractorContactEmail?: string;
  subcontractorBankAccount?: string;
}

export default function NetworkDetailPage() {
  const params = useParams();
  const router = useRouter();
  const networkId = params.id as string;
  const admin = getPlatformAdmin();
  const isOwner = admin?.role === 'PLATFORM_OWNER';

  const [network, setNetwork] = useState<NetworkDetail | null>(null);
  const [admins, setAdmins] = useState<NetworkAdmin[]>([]);
  const [locations, setLocations] = useState<NetworkLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'pricing' | 'billing' | 'companyData' | 'admins' | 'locations'>('details');
  const [selectedLocation, setSelectedLocation] = useState<NetworkLocation | null>(null);

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

  // Billing state (Platform felé irányuló számlázási adatok)
  const [billingCompanyName, setBillingCompanyName] = useState('');
  const [billingAddressData, setBillingAddressData] = useState<AddressData>({
    postalCode: '',
    city: '',
    street: '',
    country: 'HU',
  });
  const [billingTaxNumber, setBillingTaxNumber] = useState('');
  const [billingEuVatNumber, setBillingEuVatNumber] = useState('');
  const [billingEmail, setBillingEmail] = useState('');

  // Admin modal state
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminRole, setAdminRole] = useState('NETWORK_ADMIN');

  // Company data state
  const [allowCustomCompanyDataProvider, setAllowCustomCompanyDataProvider] = useState(false);
  const [platformHasService, setPlatformHasService] = useState(false);
  const [platformServiceProvider, setPlatformServiceProvider] = useState('NONE');
  const [platformServiceMonthlyFee, setPlatformServiceMonthlyFee] = useState<number | null>(null);
  const [companyDataLoading, setCompanyDataLoading] = useState(false);

  useEffect(() => {
    loadNetwork();
  }, [networkId]);

  const loadNetwork = async () => {
    try {
      setLoading(true);
      const [networkData, adminsData, locationsData] = await Promise.all([
        platformApi.getNetwork(networkId),
        platformApi.listNetworkAdmins(networkId),
        platformApi.listNetworkLocations(networkId),
      ]);
      setNetwork(networkData);
      setAdmins(adminsData);
      setLocations(locationsData);

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

      // Initialize billing fields
      setBillingCompanyName(networkData.billingCompanyName || '');
      setBillingAddressData({
        postalCode: networkData.billingZipCode || '',
        city: networkData.billingCity || '',
        street: networkData.billingAddress || '',
        country: networkData.billingCountry || 'HU',
      });
      setBillingTaxNumber(networkData.billingTaxNumber || '');
      setBillingEuVatNumber(networkData.billingEuVatNumber || '');
      setBillingEmail(networkData.billingEmail || '');

      // Load company data settings
      try {
        const companyDataSettings = await platformApi.getNetworkCompanyDataSettings(networkId);
        setAllowCustomCompanyDataProvider(companyDataSettings.allowCustomCompanyDataProvider || false);
        setPlatformHasService(companyDataSettings.platformHasService || false);
        setPlatformServiceProvider(companyDataSettings.platformServiceProvider || 'NONE');
        setPlatformServiceMonthlyFee(companyDataSettings.platformServiceMonthlyFee);
      } catch (companyDataErr) {
        console.warn('Could not load company data settings:', companyDataErr);
      }
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

  const handleSaveBilling = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const updated = await platformApi.updateNetwork(networkId, {
        billingCompanyName: billingCompanyName || undefined,
        billingAddress: billingAddressData.street || undefined,
        billingCity: billingAddressData.city || undefined,
        billingZipCode: billingAddressData.postalCode || undefined,
        billingCountry: billingAddressData.country,
        billingTaxNumber: billingTaxNumber || undefined,
        billingEuVatNumber: billingEuVatNumber || undefined,
        billingEmail: billingEmail || undefined,
      } as any);
      setNetwork(updated);
      setSuccess('Számlázási adatok mentve!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba történt');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCompanyData = async () => {
    setCompanyDataLoading(true);
    setError('');
    setSuccess('');

    try {
      await platformApi.updateNetworkCompanyDataSettings(networkId, {
        allowCustomCompanyDataProvider,
      });
      setSuccess('Cégadatbázis beállítások mentve!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba történt');
    } finally {
      setCompanyDataLoading(false);
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

    if (adminPassword !== adminPasswordConfirm) {
      setError('A két jelszó nem egyezik');
      setSaving(false);
      return;
    }

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
      setAdminPasswordConfirm('');
      setShowAdminPassword(false);
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
          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
            {network.country === 'HU' ? '🇭🇺 Magyarország' :
             network.country === 'AT' ? '🇦🇹 Ausztria' :
             network.country === 'SK' ? '🇸🇰 Szlovákia' :
             network.country === 'RO' ? '🇷🇴 Románia' :
             network.country === 'DE' ? '🇩🇪 Németország' :
             network.country === 'PL' ? '🇵🇱 Lengyelország' :
             network.country === 'CZ' ? '🇨🇿 Csehország' :
             network.country === 'HR' ? '🇭🇷 Horvátország' :
             network.country === 'SI' ? '🇸🇮 Szlovénia' :
             network.country === 'RS' ? '🇷🇸 Szerbia' :
             network.country}
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
            onClick={() => setActiveTab('billing')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'billing'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2">
              Számlázás
              {!network.billingDataComplete && (
                <span className="w-2 h-2 bg-orange-400 rounded-full" title="Hiányos adatok" />
              )}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('companyData')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'companyData'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            Cégadatbázis
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
          <button
            onClick={() => setActiveTab('locations')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'locations'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            Helyszínek ({locations.length})
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

      {/* Billing tab */}
      {activeTab === 'billing' && (
        <div className="space-y-6">
          {/* Billing status */}
          {!network.billingDataComplete && (
            <div className="bg-orange-900/30 border border-orange-700 rounded-lg p-4">
              <h3 className="text-sm font-medium text-orange-300 mb-1">Hiányos számlázási adatok</h3>
              <p className="text-sm text-orange-200">
                A számlázási adatok nem teljesek. Kérjük, töltsd ki a kötelező mezőket a számlák kiállításához.
              </p>
            </div>
          )}

          {/* Billing form */}
          <div className="bg-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Platform számlázási adatok</h2>
            <p className="text-sm text-gray-400 mb-6">
              Ezeket az adatokat használjuk a Platform által a Network felé kiállított számlákhoz.
            </p>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Cégnév <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={billingCompanyName}
                  onChange={(e) => setBillingCompanyName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Példa Kft."
                />
              </div>

              {/* Address Input with autocomplete */}
              <div className="[&_label]:text-gray-300 [&_input]:bg-gray-700 [&_input]:border-gray-600 [&_input]:text-white [&_input]:placeholder-gray-400 [&_select]:bg-gray-700 [&_select]:border-gray-600 [&_select]:text-white">
                <AddressInput
                  value={billingAddressData}
                  onChange={setBillingAddressData}
                  defaultCountry="HU"
                  showCountry={true}
                  required={true}
                  labels={{
                    postalCode: 'Iranyitoszam',
                    city: 'Varos',
                    street: 'Cim (utca, hazszam)',
                    country: 'Orszag',
                  }}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Adószám <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={billingTaxNumber}
                    onChange={(e) => setBillingTaxNumber(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="12345678-1-23"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    EU ÁFA szám
                  </label>
                  <input
                    type="text"
                    value={billingEuVatNumber}
                    onChange={(e) => setBillingEuVatNumber(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="HU12345678"
                  />
                  <p className="text-xs text-gray-500 mt-1">Csak EU-n belüli ügyleteknél szükséges</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Számla email
                  </label>
                  <input
                    type="email"
                    value={billingEmail}
                    onChange={(e) => setBillingEmail(e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="szamla@example.com"
                  />
                  <p className="text-xs text-gray-500 mt-1">Ide küldjük a számlákat</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={handleSaveBilling}
                disabled={saving}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors font-medium"
              >
                {saving ? 'Mentés...' : 'Számlázási adatok mentése'}
              </button>
            </div>
          </div>

          {/* Info box */}
          <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-300 mb-1">Mire szolgálnak ezek az adatok?</h3>
            <ul className="text-sm text-blue-200 list-disc list-inside space-y-1">
              <li>A Platform a havi díjat és mosásonkénti díjat ezen adatokra állítja ki</li>
              <li>Ez a Network cégadatai a Platform felé, nem a Network saját ügyfelei felé</li>
              <li>A kötelező mezők (*) kitöltése nélkül nem lehet számlát kiállítani</li>
              <li>A számlákat a megadott email címre küldjük</li>
            </ul>
          </div>
        </div>
      )}

      {/* Company Data tab */}
      {activeTab === 'companyData' && (
        <div className="space-y-6">
          {/* Platform service status */}
          <div className="bg-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Platform cégadatbázis szolgáltatás</h2>

            {platformHasService ? (
              <div className="bg-green-900/30 border border-green-700 rounded-lg p-4 mb-6">
                <div className="flex items-center gap-3">
                  <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <div>
                    <p className="text-green-300 font-medium">
                      {platformServiceProvider === 'OPTEN' ? 'Opten' : platformServiceProvider} - Vemiax Platform szolgáltatás
                    </p>
                    <p className="text-green-200 text-sm">
                      Ez a Network a Platform központi cégadatbázis szolgáltatását használja.
                      {platformServiceMonthlyFee && platformServiceMonthlyFee > 0 && (
                        <> Havi díj: {formatCurrency(platformServiceMonthlyFee)}</>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-gray-700/50 border border-gray-600 rounded-lg p-4 mb-6">
                <div className="flex items-center gap-3">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                  <div>
                    <p className="text-gray-300 font-medium">Nincs Platform szolgáltatás</p>
                    <p className="text-gray-400 text-sm">
                      A Platform nem biztosít központi cégadatbázis szolgáltatást. Állítsd be a Platform Settings oldalon.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Allow custom provider checkbox */}
            <div className="border-t border-gray-700 pt-6">
              <h3 className="text-md font-semibold text-white mb-4">Saját szolgáltató engedélyezése</h3>
              <label className="flex items-start gap-4 p-4 rounded-lg border border-gray-700 hover:border-gray-600 cursor-pointer transition-all">
                <input
                  type="checkbox"
                  checked={allowCustomCompanyDataProvider}
                  onChange={(e) => setAllowCustomCompanyDataProvider(e.target.checked)}
                  className="mt-0.5 w-5 h-5 rounded border-gray-600 bg-gray-700 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="text-white font-medium">Saját cégadatbázis szolgáltató engedélyezése</span>
                  <p className="text-sm text-gray-400 mt-1">
                    Ha bekapcsolod, ez a Network saját Opten/Bisnode fiókot állíthat be a Network Admin felületen.
                    Ebben az esetben nem a Platform központi szolgáltatását fogják használni.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Save button */}
          <div className="flex justify-end">
            <button
              onClick={handleSaveCompanyData}
              disabled={companyDataLoading}
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors font-medium"
            >
              {companyDataLoading ? 'Mentés...' : 'Beállítások mentése'}
            </button>
          </div>

          {/* Info box */}
          <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-300 mb-1">Hogyan működik?</h3>
            <ul className="text-sm text-blue-200 list-disc list-inside space-y-1">
              <li><strong>Alapértelmezetten:</strong> A Network a Platform központi szolgáltatását használja (ha be van állítva)</li>
              <li><strong>Saját szolgáltató engedélyezve:</strong> A Network Admin saját API kulcsokat állíthat be</li>
              <li>A Platform szolgáltatás havi díja automatikusan hozzáadódik a Network számlájához</li>
              <li>A Network Admin felületen megjelenik az aktív szolgáltatás neve és forrása</li>
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

      {/* Locations tab */}
      {activeTab === 'locations' && (
        <div className="space-y-4">
          <div className="bg-gray-800 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Név</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Cím</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Email</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Típus</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Státusz</th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-gray-400">Mosások</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {locations.map((location) => (
                  <tr key={location.id} className="hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-white font-medium">{location.name}</div>
                      <div className="text-gray-500 text-xs font-mono">{location.code}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-300 text-sm">
                      {location.address && <div>{location.address}</div>}
                      {location.city && <div>{location.zipCode} {location.city}</div>}
                    </td>
                    <td className="px-6 py-4 text-gray-300 text-sm">{location.email || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        location.operationType === 'OWN' ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'
                      }`}>
                        {location.operationType === 'OWN' ? 'Saját' : 'Alvállalkozó'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        location.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {location.isActive ? 'Aktív' : 'Inaktív'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-300">{location.washEventCount.toLocaleString('hu-HU')}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => setSelectedLocation(location)}
                        className="text-indigo-400 hover:text-indigo-300 text-sm"
                      >
                        Részletek
                      </button>
                    </td>
                  </tr>
                ))}
                {locations.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                      Még nincs helyszín
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Location detail modal */}
      {selectedLocation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">{selectedLocation.name}</h2>
                <p className="text-sm text-gray-400 font-mono">{selectedLocation.code}</p>
              </div>
              <button onClick={() => setSelectedLocation(null)} className="text-gray-400 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Alapadatok */}
              <div>
                <h3 className="text-md font-semibold text-white mb-3">Alapadatok</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Cím:</span>
                    <p className="text-white">{selectedLocation.address || '-'}</p>
                  </div>
                  <div>
                    <span className="text-gray-400">Város:</span>
                    <p className="text-white">{selectedLocation.zipCode} {selectedLocation.city || '-'}</p>
                  </div>
                  <div>
                    <span className="text-gray-400">Email:</span>
                    <p className="text-white">{selectedLocation.email || '-'}</p>
                  </div>
                  <div>
                    <span className="text-gray-400">Telefon:</span>
                    <p className="text-white">{selectedLocation.phone || '-'}</p>
                  </div>
                  <div>
                    <span className="text-gray-400">Típus:</span>
                    <p className={selectedLocation.operationType === 'OWN' ? 'text-blue-400' : 'text-orange-400'}>
                      {selectedLocation.operationType === 'OWN' ? 'Saját üzemeltetés' : 'Alvállalkozó'}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-400">Státusz:</span>
                    <p className={selectedLocation.isActive ? 'text-green-400' : 'text-red-400'}>
                      {selectedLocation.isActive ? 'Aktív' : 'Inaktív'}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-400">Összes mosás:</span>
                    <p className="text-white">{selectedLocation.washEventCount.toLocaleString('hu-HU')}</p>
                  </div>
                </div>
              </div>

              {/* Alvállalkozói cégadatok */}
              {selectedLocation.operationType === 'SUBCONTRACTOR' && (
                <div className="pt-4 border-t border-gray-700">
                  <h3 className="text-md font-semibold text-white mb-3">Alvállalkozó cégadatok</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Cégnév:</span>
                      <p className="text-white">{selectedLocation.subcontractorCompanyName || '-'}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Adószám:</span>
                      <p className="text-white">{selectedLocation.subcontractorTaxNumber || '-'}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Székhely:</span>
                      <p className="text-white">
                        {selectedLocation.subcontractorAddress || '-'}
                        {selectedLocation.subcontractorCity && (
                          <>, {selectedLocation.subcontractorZipCode} {selectedLocation.subcontractorCity}</>
                        )}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-400">Bankszámla:</span>
                      <p className="text-white">{selectedLocation.subcontractorBankAccount || '-'}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Kapcsolattartó:</span>
                      <p className="text-white">{selectedLocation.subcontractorContactName || '-'}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Kapcs. telefon:</span>
                      <p className="text-white">{selectedLocation.subcontractorContactPhone || '-'}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Kapcs. email:</span>
                      <p className="text-white">{selectedLocation.subcontractorContactEmail || '-'}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-700 flex justify-end">
              <button
                onClick={() => setSelectedLocation(null)}
                className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
              >
                Bezárás
              </button>
            </div>
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
                <div className="relative">
                  <input
                    type={showAdminPassword ? 'text' : 'password'}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    required
                    minLength={8}
                    className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-12"
                    placeholder="Min. 8 karakter"
                    style={{ WebkitTextSecurity: showAdminPassword ? 'none' : 'disc' } as any}
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword(!showAdminPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showAdminPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Jelszó megerősítése *
                </label>
                <input
                  type={showAdminPassword ? 'text' : 'password'}
                  value={adminPasswordConfirm}
                  onChange={(e) => setAdminPasswordConfirm(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Írd be újra a jelszót"
                  style={{ WebkitTextSecurity: showAdminPassword ? 'none' : 'disc' } as any}
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
