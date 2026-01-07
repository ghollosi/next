'use client';

import { useEffect, useState } from 'react';
import { networkAdminApi } from '@/lib/network-admin-api';

interface Settings {
  network: {
    id: string;
    name: string;
    slug: string;
    country: string;
    timezone: string;
    defaultCurrency: string;
    defaultLanguage: string;
  };
  company: {
    companyName: string;
    companyAddress: string;
    companyCity: string;
    companyZipCode: string;
    companyCountry: string;
    taxNumber: string;
    euVatNumber: string;
    bankAccountNumber: string;
    bankAccountIban: string;
    bankName: string;
  };
  contact: {
    contactEmail: string;
    contactPhone: string;
  };
  invoicing: {
    invoiceProvider: string;
    szamlazzAgentKey: string;
    billingoApiKey: string;
    billingoBlockId: string;
    navOnlineUser: string;
    navOnlineTaxNum: string;
  };
  email: {
    emailProvider: string;
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpFromEmail: string;
    smtpFromName: string;
    resendApiKey: string;
  };
  sms: {
    smsProvider: string;
    twilioPhoneNumber: string;
    twilioAccountSid: string;
  };
  business: {
    allowCashPayment: boolean;
    allowCardPayment: boolean;
    allowFuelCards: boolean;
    autoApproveDrivers: boolean;
    requireEmailVerify: boolean;
    requirePhoneVerify: boolean;
    allowSelfRegistration: boolean;
  };
}

interface VatRate {
  id: string;
  name: string;
  rate: number;
  code: string;
  isDefault: boolean;
  isActive: boolean;
}

interface Currency {
  id: string;
  currencyCode: string;
  currencyName: string;
  currencySymbol: string;
  isDefault: boolean;
  isActive: boolean;
}

type TabType = 'company' | 'regional' | 'invoicing' | 'notifications' | 'business';

const COUNTRIES = [
  { code: 'HU', name: 'Magyarország' },
  { code: 'SK', name: 'Szlovákia' },
  { code: 'RO', name: 'Románia' },
  { code: 'AT', name: 'Ausztria' },
  { code: 'DE', name: 'Németország' },
  { code: 'PL', name: 'Lengyelország' },
  { code: 'CZ', name: 'Csehország' },
  { code: 'HR', name: 'Horvátország' },
  { code: 'SI', name: 'Szlovénia' },
  { code: 'RS', name: 'Szerbia' },
];

const TIMEZONES = [
  { code: 'Europe/Budapest', name: 'Budapest (CET/CEST)' },
  { code: 'Europe/Bratislava', name: 'Pozsony (CET/CEST)' },
  { code: 'Europe/Bucharest', name: 'Bukarest (EET/EEST)' },
  { code: 'Europe/Vienna', name: 'Bécs (CET/CEST)' },
  { code: 'Europe/Berlin', name: 'Berlin (CET/CEST)' },
  { code: 'Europe/Warsaw', name: 'Varsó (CET/CEST)' },
  { code: 'Europe/Prague', name: 'Prága (CET/CEST)' },
  { code: 'Europe/Zagreb', name: 'Zágráb (CET/CEST)' },
  { code: 'Europe/Ljubljana', name: 'Ljubljana (CET/CEST)' },
  { code: 'Europe/Belgrade', name: 'Belgrád (CET/CEST)' },
];

const CURRENCIES = [
  { code: 'HUF', name: 'Magyar forint', symbol: 'Ft' },
  { code: 'EUR', name: 'Euró', symbol: '€' },
  { code: 'RON', name: 'Román lej', symbol: 'lei' },
  { code: 'PLN', name: 'Lengyel zloty', symbol: 'zł' },
  { code: 'CZK', name: 'Cseh korona', symbol: 'Kč' },
  { code: 'RSD', name: 'Szerb dinár', symbol: 'din' },
  { code: 'HRK', name: 'Horvát kuna', symbol: 'kn' },
];

const INVOICE_PROVIDERS = [
  { code: 'none', name: 'Nincs (manuális számlázás)' },
  { code: 'szamlazz', name: 'Számlázz.hu' },
  { code: 'billingo', name: 'Billingo' },
];


export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('company');

  const [settings, setSettings] = useState<Settings | null>(null);
  const [vatRates, setVatRates] = useState<VatRate[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);

  // New VAT rate form
  const [newVatRate, setNewVatRate] = useState({ name: '', rate: 0, code: '' });
  const [showNewVatForm, setShowNewVatForm] = useState(false);

  // New currency form
  const [newCurrency, setNewCurrency] = useState({ currencyCode: '', currencyName: '', currencySymbol: '' });
  const [showNewCurrencyForm, setShowNewCurrencyForm] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const [settingsData, vatData, currencyData] = await Promise.all([
        networkAdminApi.getSettings(),
        networkAdminApi.listVatRates(),
        networkAdminApi.listCurrencies(),
      ]);
      setSettings(settingsData);
      setVatRates(vatData);
      setCurrencies(currencyData);
    } catch (err: any) {
      setError(err.message || 'Hiba történt a beállítások betöltésekor');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      await networkAdminApi.updateSettings(settings);
      setSuccess('Beállítások sikeresen mentve!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Hiba történt a mentés során');
    } finally {
      setSaving(false);
    }
  };

  const updateSettings = (section: keyof Settings, field: string, value: any) => {
    if (!settings) return;
    setSettings({
      ...settings,
      [section]: {
        ...settings[section],
        [field]: value,
      },
    });
  };

  // VAT Rate handlers
  const handleAddVatRate = async () => {
    try {
      const created = await networkAdminApi.createVatRate(newVatRate);
      setVatRates([...vatRates, created]);
      setNewVatRate({ name: '', rate: 0, code: '' });
      setShowNewVatForm(false);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteVatRate = async (id: string) => {
    if (!confirm('Biztosan törölni szeretnéd ezt az ÁFA kulcsot?')) return;
    try {
      await networkAdminApi.deleteVatRate(id);
      setVatRates(vatRates.filter(v => v.id !== id));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSetDefaultVatRate = async (id: string) => {
    try {
      await networkAdminApi.updateVatRate(id, { isDefault: true });
      setVatRates(vatRates.map(v => ({ ...v, isDefault: v.id === id })));
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Currency handlers
  const handleAddCurrency = async () => {
    try {
      const created = await networkAdminApi.addCurrency(newCurrency);
      setCurrencies([...currencies, created]);
      setNewCurrency({ currencyCode: '', currencyName: '', currencySymbol: '' });
      setShowNewCurrencyForm(false);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRemoveCurrency = async (id: string) => {
    if (!confirm('Biztosan törölni szeretnéd ezt a pénznemet?')) return;
    try {
      await networkAdminApi.removeCurrency(id);
      setCurrencies(currencies.filter(c => c.id !== id));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSetDefaultCurrency = async (id: string) => {
    try {
      await networkAdminApi.updateCurrency(id, { isDefault: true });
      setCurrencies(currencies.map(c => ({ ...c, isDefault: c.id === id })));
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Betöltés...</div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
        Nem sikerült betölteni a beállításokat
      </div>
    );
  }

  const tabs = [
    { id: 'company' as TabType, label: 'Cégadatok', icon: '🏢' },
    { id: 'regional' as TabType, label: 'Regionális', icon: '🌍' },
    { id: 'invoicing' as TabType, label: 'Számlázás', icon: '📄' },
    { id: 'notifications' as TabType, label: 'Értesítések', icon: '📧' },
    { id: 'business' as TabType, label: 'Üzleti szabályok', icon: '⚙️' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Beállítások</h1>
        <p className="text-gray-500 mt-1">Hálózat és cég beállításai</p>
      </div>

      {/* Error/Success messages */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-green-700">
          {success}
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-1 p-2 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors
                  ${activeTab === tab.id
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100'
                  }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Company Tab */}
          {activeTab === 'company' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cégnév *
                  </label>
                  <input
                    type="text"
                    value={settings.company.companyName || ''}
                    onChange={(e) => updateSettings('company', 'companyName', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Példa Kft."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Adószám *
                  </label>
                  <input
                    type="text"
                    value={settings.company.taxNumber || ''}
                    onChange={(e) => updateSettings('company', 'taxNumber', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="12345678-2-42"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    EU ÁFA szám
                  </label>
                  <input
                    type="text"
                    value={settings.company.euVatNumber || ''}
                    onChange={(e) => updateSettings('company', 'euVatNumber', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="HU12345678"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ország
                  </label>
                  <select
                    value={settings.company.companyCountry || ''}
                    onChange={(e) => updateSettings('company', 'companyCountry', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">Válassz...</option>
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cím
                </label>
                <input
                  type="text"
                  value={settings.company.companyAddress || ''}
                  onChange={(e) => updateSettings('company', 'companyAddress', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Utca, házszám"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Irányítószám
                  </label>
                  <input
                    type="text"
                    value={settings.company.companyZipCode || ''}
                    onChange={(e) => updateSettings('company', 'companyZipCode', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="1234"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Város
                  </label>
                  <input
                    type="text"
                    value={settings.company.companyCity || ''}
                    onChange={(e) => updateSettings('company', 'companyCity', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Budapest"
                  />
                </div>
              </div>

              <hr className="my-6" />
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Bankszámla adatok</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bank neve
                  </label>
                  <input
                    type="text"
                    value={settings.company.bankName || ''}
                    onChange={(e) => updateSettings('company', 'bankName', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="OTP Bank"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Számlaszám
                  </label>
                  <input
                    type="text"
                    value={settings.company.bankAccountNumber || ''}
                    onChange={(e) => updateSettings('company', 'bankAccountNumber', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="11111111-22222222-33333333"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  IBAN
                </label>
                <input
                  type="text"
                  value={settings.company.bankAccountIban || ''}
                  onChange={(e) => updateSettings('company', 'bankAccountIban', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="HU12 1234 5678 9012 3456 7890 1234"
                />
              </div>

              <hr className="my-6" />
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Kapcsolattartó</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={settings.contact.contactEmail || ''}
                    onChange={(e) => updateSettings('contact', 'contactEmail', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="info@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Telefon
                  </label>
                  <input
                    type="tel"
                    value={settings.contact.contactPhone || ''}
                    onChange={(e) => updateSettings('contact', 'contactPhone', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="+36 1 234 5678"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Regional Tab */}
          {activeTab === 'regional' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ország
                  </label>
                  <select
                    value={settings.network.country || ''}
                    onChange={(e) => updateSettings('network', 'country', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">Válassz...</option>
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Időzóna
                  </label>
                  <select
                    value={settings.network.timezone || ''}
                    onChange={(e) => updateSettings('network', 'timezone', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">Válassz...</option>
                    {TIMEZONES.map((tz) => (
                      <option key={tz.code} value={tz.code}>{tz.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Alapértelmezett pénznem
                  </label>
                  <select
                    value={settings.network.defaultCurrency || ''}
                    onChange={(e) => updateSettings('network', 'defaultCurrency', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">Válassz...</option>
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>{c.name} ({c.symbol})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nyelv
                  </label>
                  <select
                    value={settings.network.defaultLanguage || 'hu'}
                    onChange={(e) => updateSettings('network', 'defaultLanguage', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="hu">Magyar</option>
                    <option value="en">English</option>
                    <option value="de">Deutsch</option>
                    <option value="sk">Slovenčina</option>
                    <option value="ro">Română</option>
                  </select>
                </div>
              </div>

              <hr className="my-6" />

              {/* VAT Rates */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">ÁFA kulcsok</h3>
                  <button
                    onClick={() => setShowNewVatForm(true)}
                    className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700"
                  >
                    + Új ÁFA kulcs
                  </button>
                </div>

                {showNewVatForm && (
                  <div className="bg-gray-50 rounded-xl p-4 mb-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <input
                        type="text"
                        value={newVatRate.name}
                        onChange={(e) => setNewVatRate({ ...newVatRate, name: e.target.value })}
                        placeholder="Megnevezés (pl. Normál)"
                        className="px-3 py-2 border border-gray-300 rounded-lg"
                      />
                      <input
                        type="number"
                        value={newVatRate.rate}
                        onChange={(e) => setNewVatRate({ ...newVatRate, rate: parseFloat(e.target.value) })}
                        placeholder="Kulcs (%)"
                        className="px-3 py-2 border border-gray-300 rounded-lg"
                      />
                      <input
                        type="text"
                        value={newVatRate.code}
                        onChange={(e) => setNewVatRate({ ...newVatRate, code: e.target.value })}
                        placeholder="Kód (pl. 27)"
                        className="px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddVatRate}
                        className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700"
                      >
                        Hozzáadás
                      </button>
                      <button
                        onClick={() => setShowNewVatForm(false)}
                        className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300"
                      >
                        Mégse
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {vatRates.length === 0 ? (
                    <p className="text-gray-500 text-sm">Nincs még ÁFA kulcs definiálva</p>
                  ) : (
                    vatRates.map((vat) => (
                      <div
                        key={vat.id}
                        className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3"
                      >
                        <div className="flex items-center gap-4">
                          <span className="font-medium">{vat.name}</span>
                          <span className="text-gray-600">{vat.rate}%</span>
                          {vat.code && <span className="text-gray-400 text-sm">({vat.code})</span>}
                          {vat.isDefault && (
                            <span className="px-2 py-1 bg-primary-100 text-primary-700 text-xs font-medium rounded">
                              Alapértelmezett
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {!vat.isDefault && (
                            <button
                              onClick={() => handleSetDefaultVatRate(vat.id)}
                              className="text-sm text-primary-600 hover:text-primary-700"
                            >
                              Alapértelmezett
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteVatRate(vat.id)}
                            className="text-sm text-red-600 hover:text-red-700"
                          >
                            Törlés
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <hr className="my-6" />

              {/* Currencies */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Pénznemek</h3>
                  <button
                    onClick={() => setShowNewCurrencyForm(true)}
                    className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700"
                  >
                    + Új pénznem
                  </button>
                </div>

                {showNewCurrencyForm && (
                  <div className="bg-gray-50 rounded-xl p-4 mb-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <select
                        value={newCurrency.currencyCode}
                        onChange={(e) => {
                          const selected = CURRENCIES.find(c => c.code === e.target.value);
                          setNewCurrency({
                            currencyCode: e.target.value,
                            currencyName: selected?.name || '',
                            currencySymbol: selected?.symbol || '',
                          });
                        }}
                        className="px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        <option value="">Válassz pénznemet...</option>
                        {CURRENCIES.map((c) => (
                          <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={newCurrency.currencyName}
                        onChange={(e) => setNewCurrency({ ...newCurrency, currencyName: e.target.value })}
                        placeholder="Megnevezés"
                        className="px-3 py-2 border border-gray-300 rounded-lg"
                      />
                      <input
                        type="text"
                        value={newCurrency.currencySymbol}
                        onChange={(e) => setNewCurrency({ ...newCurrency, currencySymbol: e.target.value })}
                        placeholder="Szimbólum"
                        className="px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddCurrency}
                        className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700"
                      >
                        Hozzáadás
                      </button>
                      <button
                        onClick={() => setShowNewCurrencyForm(false)}
                        className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300"
                      >
                        Mégse
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {currencies.length === 0 ? (
                    <p className="text-gray-500 text-sm">Nincs még pénznem definiálva</p>
                  ) : (
                    currencies.map((curr) => (
                      <div
                        key={curr.id}
                        className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3"
                      >
                        <div className="flex items-center gap-4">
                          <span className="font-medium">{curr.currencyCode}</span>
                          <span className="text-gray-600">{curr.currencyName}</span>
                          <span className="text-gray-400">({curr.currencySymbol})</span>
                          {curr.isDefault && (
                            <span className="px-2 py-1 bg-primary-100 text-primary-700 text-xs font-medium rounded">
                              Alapértelmezett
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {!curr.isDefault && (
                            <button
                              onClick={() => handleSetDefaultCurrency(curr.id)}
                              className="text-sm text-primary-600 hover:text-primary-700"
                            >
                              Alapértelmezett
                            </button>
                          )}
                          <button
                            onClick={() => handleRemoveCurrency(curr.id)}
                            className="text-sm text-red-600 hover:text-red-700"
                          >
                            Törlés
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Invoicing Tab */}
          {activeTab === 'invoicing' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Számlázó rendszer
                </label>
                <select
                  value={settings.invoicing.invoiceProvider || 'none'}
                  onChange={(e) => updateSettings('invoicing', 'invoiceProvider', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  {INVOICE_PROVIDERS.map((p) => (
                    <option key={p.code} value={p.code}>{p.name}</option>
                  ))}
                </select>
              </div>

              {settings.invoicing.invoiceProvider === 'szamlazz' && (
                <div className="bg-blue-50 rounded-xl p-4 space-y-4">
                  <h4 className="font-semibold text-blue-900">Számlázz.hu beállítások</h4>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Agent kulcs
                    </label>
                    <input
                      type="password"
                      value={settings.invoicing.szamlazzAgentKey || ''}
                      onChange={(e) => updateSettings('invoicing', 'szamlazzAgentKey', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="Agent kulcs a Számlázz.hu-tól"
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      A Számlázz.hu admin felületén található Beállítások &gt; API menüpont alatt
                    </p>
                  </div>
                </div>
              )}

              {settings.invoicing.invoiceProvider === 'billingo' && (
                <div className="bg-green-50 rounded-xl p-4 space-y-4">
                  <h4 className="font-semibold text-green-900">Billingo beállítások</h4>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      API kulcs
                    </label>
                    <input
                      type="password"
                      value={settings.invoicing.billingoApiKey || ''}
                      onChange={(e) => updateSettings('invoicing', 'billingoApiKey', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="Billingo API kulcs"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Számlatömb ID
                    </label>
                    <input
                      type="text"
                      value={settings.invoicing.billingoBlockId || ''}
                      onChange={(e) => updateSettings('invoicing', 'billingoBlockId', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="Számlatömb azonosító"
                    />
                  </div>
                </div>
              )}

              <hr className="my-6" />
              <h3 className="text-lg font-semibold text-gray-900 mb-4">NAV Online Számla</h3>
              <p className="text-sm text-gray-500 mb-4">
                A NAV Online Számla rendszerhez való csatlakozáshoz szükséges adatok.
                Ez kötelező minden 100.000 Ft feletti számlához.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    NAV felhasználónév
                  </label>
                  <input
                    type="text"
                    value={settings.invoicing.navOnlineUser || ''}
                    onChange={(e) => updateSettings('invoicing', 'navOnlineUser', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="NAV technikai felhasználó"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Adószám (NAV)
                  </label>
                  <input
                    type="text"
                    value={settings.invoicing.navOnlineTaxNum || ''}
                    onChange={(e) => updateSettings('invoicing', 'navOnlineTaxNum', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="12345678"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Email beállítások</h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email szolgáltató
                </label>
                <select
                  value={settings.email.emailProvider || 'none'}
                  onChange={(e) => updateSettings('email', 'emailProvider', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="none">Nincs (email küldés letiltva)</option>
                  <option value="smtp">SMTP szerver</option>
                  <option value="resend">Resend</option>
                </select>
              </div>

              {settings.email.emailProvider === 'smtp' && (
                <div className="bg-gray-50 rounded-xl p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        SMTP szerver
                      </label>
                      <input
                        type="text"
                        value={settings.email.smtpHost || ''}
                        onChange={(e) => updateSettings('email', 'smtpHost', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl"
                        placeholder="smtp.example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Port
                      </label>
                      <input
                        type="number"
                        value={settings.email.smtpPort || 587}
                        onChange={(e) => updateSettings('email', 'smtpPort', parseInt(e.target.value))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      SMTP felhasználó
                    </label>
                    <input
                      type="text"
                      value={settings.email.smtpUser || ''}
                      onChange={(e) => updateSettings('email', 'smtpUser', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl"
                      placeholder="user@example.com"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Feladó email
                      </label>
                      <input
                        type="email"
                        value={settings.email.smtpFromEmail || ''}
                        onChange={(e) => updateSettings('email', 'smtpFromEmail', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl"
                        placeholder="noreply@example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Feladó név
                      </label>
                      <input
                        type="text"
                        value={settings.email.smtpFromName || ''}
                        onChange={(e) => updateSettings('email', 'smtpFromName', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl"
                        placeholder="VSys Mosórendszer"
                      />
                    </div>
                  </div>
                </div>
              )}

              {settings.email.emailProvider === 'resend' && (
                <div className="bg-gray-50 rounded-xl p-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Resend API kulcs
                    </label>
                    <input
                      type="password"
                      value={settings.email.resendApiKey || ''}
                      onChange={(e) => updateSettings('email', 'resendApiKey', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl"
                      placeholder="re_xxxxx..."
                    />
                  </div>
                </div>
              )}

              <hr className="my-6" />
              <h3 className="text-lg font-semibold text-gray-900 mb-4">SMS beállítások</h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  SMS szolgáltató
                </label>
                <select
                  value={settings.sms.smsProvider || 'none'}
                  onChange={(e) => updateSettings('sms', 'smsProvider', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="none">Nincs (SMS küldés letiltva)</option>
                  <option value="twilio">Twilio</option>
                </select>
              </div>

              {settings.sms.smsProvider === 'twilio' && (
                <div className="bg-gray-50 rounded-xl p-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Twilio Account SID
                    </label>
                    <input
                      type="text"
                      value={settings.sms.twilioAccountSid || ''}
                      onChange={(e) => updateSettings('sms', 'twilioAccountSid', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl"
                      placeholder="AC..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Twilio telefonszám
                    </label>
                    <input
                      type="text"
                      value={settings.sms.twilioPhoneNumber || ''}
                      onChange={(e) => updateSettings('sms', 'twilioPhoneNumber', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl"
                      placeholder="+36..."
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Business Tab */}
          {activeTab === 'business' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Fizetési módok</h3>

              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.business.allowCashPayment}
                    onChange={(e) => updateSettings('business', 'allowCashPayment', e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-gray-700">Készpénzes fizetés engedélyezése</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.business.allowCardPayment}
                    onChange={(e) => updateSettings('business', 'allowCardPayment', e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-gray-700">Bankkártyás fizetés engedélyezése</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.business.allowFuelCards}
                    onChange={(e) => updateSettings('business', 'allowFuelCards', e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-gray-700">Üzemanyagkártyás fizetés engedélyezése</span>
                </label>
              </div>

              <hr className="my-6" />
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Regisztráció és jóváhagyás</h3>

              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.business.allowSelfRegistration}
                    onChange={(e) => updateSettings('business', 'allowSelfRegistration', e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div>
                    <span className="text-gray-700">Önálló regisztráció engedélyezése</span>
                    <p className="text-sm text-gray-500">Sofőrök regisztrálhatnak meghívókód nélkül</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.business.autoApproveDrivers}
                    onChange={(e) => updateSettings('business', 'autoApproveDrivers', e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div>
                    <span className="text-gray-700">Automatikus sofőr jóváhagyás</span>
                    <p className="text-sm text-gray-500">Új sofőrök automatikusan jóváhagyásra kerülnek</p>
                  </div>
                </label>
              </div>

              <hr className="my-6" />
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Ellenőrzési követelmények</h3>

              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.business.requireEmailVerify}
                    onChange={(e) => updateSettings('business', 'requireEmailVerify', e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div>
                    <span className="text-gray-700">Email megerősítés szükséges</span>
                    <p className="text-sm text-gray-500">Sofőröknek meg kell erősíteniük az email címüket</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.business.requirePhoneVerify}
                    onChange={(e) => updateSettings('business', 'requirePhoneVerify', e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div>
                    <span className="text-gray-700">Telefonszám megerősítés szükséges</span>
                    <p className="text-sm text-gray-500">Sofőröknek SMS-ben meg kell erősíteniük a telefonszámukat</p>
                  </div>
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end gap-4">
        <button
          onClick={loadSettings}
          disabled={saving}
          className="px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
        >
          Változtatások elvetése
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50"
        >
          {saving ? 'Mentés...' : 'Beállítások mentése'}
        </button>
      </div>
    </div>
  );
}
