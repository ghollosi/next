'use client';

import { useEffect, useState } from 'react';
import { networkAdminApi } from '@/lib/network-admin-api';
import HelpTooltip from '@/components/ui/HelpTooltip';
import { COUNTRIES } from '@/lib/countries';
import { useSubscription } from '@/contexts/SubscriptionContext';

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
    billingoBankAccountId: string;
    navOnlineUser: string;
    navOnlineTaxNum: string;
  };
  companyData: {
    companyDataProvider: string;
    optenApiKey: string;
    optenApiSecret: string;
    bisnodeApiKey: string;
    bisnodeApiSecret: string;
    // Platform service info
    allowCustomCompanyDataProvider: boolean;
    platformHasService: boolean;
    platformServiceProvider: string;
    platformServiceMonthlyFee: number | null;
  };
  email: {
    emailProvider: string;
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPassword: string;
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

type TabType = 'company' | 'regional' | 'invoicing' | 'companyData' | 'notifications' | 'business';

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

const COMPANY_DATA_PROVIDERS = [
  { code: 'NONE', name: 'Nincs (manuális adatbevitel)' },
  { code: 'OPTEN', name: 'Opten', description: 'Magyar cégadatbázis, kockázati értékelés' },
  { code: 'BISNODE', name: 'Bisnode / D&B', description: 'Nemzetközi cégadatbázis (jövőbeli)' },
  { code: 'E_CEGJEGYZEK', name: 'e-Cégjegyzék', description: 'Ingyenes, korlátozott (jövőbeli)' },
];

// Test Email Button Component
function TestEmailButton({ settings }: { settings: Settings }) {
  const [testEmail, setTestEmail] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestEmail = async () => {
    if (!testEmail) {
      setTestResult({ success: false, message: 'Kérlek add meg a teszt email címet' });
      return;
    }

    try {
      setTesting(true);
      setTestResult(null);

      const result = await networkAdminApi.testEmailConfig(testEmail);
      setTestResult(result);
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Hiba történt' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="bg-blue-50 rounded-xl p-4">
      <h4 className="font-semibold text-blue-900 mb-3">Email teszt</h4>
      <p className="text-sm text-blue-700 mb-3">
        Küldj egy teszt emailt, hogy ellenőrizd a beállításokat.
      </p>
      <div className="flex gap-2">
        <input
          type="email"
          value={testEmail}
          onChange={(e) => setTestEmail(e.target.value)}
          placeholder="teszt@example.com"
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
        />
        <button
          onClick={handleTestEmail}
          disabled={testing}
          className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {testing ? 'Küldés...' : 'Teszt küldése'}
        </button>
      </div>
      {testResult && (
        <div className={`mt-3 p-3 rounded-lg text-sm ${testResult.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {testResult.message}
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { isReadOnly } = useSubscription();
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
    { id: 'companyData' as TabType, label: 'Cégadatbázis', icon: '🔍' },
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
                  <div className="flex items-center gap-1.5 mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Cégnév *
                    </label>
                    <HelpTooltip text="A hálózat hivatalos cégneve, amely a számlákon és hivatalos dokumentumokon megjelenik." />
                  </div>
                  <input
                    type="text"
                    value={settings.company.companyName || ''}
                    onChange={(e) => updateSettings('company', 'companyName', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Példa Kft."
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Adószám *
                    </label>
                    <HelpTooltip text="A cég adószáma (pl. 12345678-1-42). Kötelező a számlaküldéshez és NAV adatszolgáltatáshoz." />
                  </div>
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
                  <div className="flex items-center gap-1.5 mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      EU ÁFA szám
                    </label>
                    <HelpTooltip text="EU közösségi adószám (pl. HU12345678). EU-n belüli szolgáltatásnyújtáshoz és fordított ÁFA-s ügyletekhez szükséges." />
                  </div>
                  <input
                    type="text"
                    value={settings.company.euVatNumber || ''}
                    onChange={(e) => updateSettings('company', 'euVatNumber', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="HU12345678"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Ország
                    </label>
                    <HelpTooltip text="A cég bejegyzési országa. Ez határozza meg az alapértelmezett ÁFA kulcsokat és számlázási szabályokat." />
                  </div>
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
                <div className="flex items-center gap-1.5 mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Cím
                  </label>
                  <HelpTooltip text="A cég székhelyének utca és házszám adata. A számlákon és hivatalos iratokon megjelenik." />
                </div>
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
                  <div className="flex items-center gap-1.5 mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Bank neve
                    </label>
                    <HelpTooltip text="A számlavezető bank neve. A számlákon fizetési információként jelenik meg." />
                  </div>
                  <input
                    type="text"
                    value={settings.company.bankName || ''}
                    onChange={(e) => updateSettings('company', 'bankName', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="OTP Bank"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Számlaszám
                    </label>
                    <HelpTooltip text="Magyar formátumú bankszámlaszám (pl. 11111111-22222222-33333333). Átutalásos fizetésekhez szükséges." />
                  </div>
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
                <div className="flex items-center gap-1.5 mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    IBAN
                  </label>
                  <HelpTooltip text="Nemzetközi bankszámlaszám formátum. Külföldi partnerekkel való elszámoláshoz és nemzetközi utalásokhoz ajánlott." />
                </div>
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
                  <div className="flex items-center gap-1.5 mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Email
                    </label>
                    <HelpTooltip text="A hálózat kapcsolattartási email címe. Ide érkeznek a rendszer értesítések és az ügyfelek megkeresései." />
                  </div>
                  <input
                    type="email"
                    value={settings.contact.contactEmail || ''}
                    onChange={(e) => updateSettings('contact', 'contactEmail', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="info@example.com"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Telefon
                    </label>
                    <HelpTooltip text="A hálózat kapcsolattartási telefonszáma. Sürgős esetben és ügyfélszolgálati célokra használható." />
                  </div>
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
                  <div className="flex items-center gap-1.5 mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Ország
                    </label>
                    <HelpTooltip text="A hálózat működési országa. Meghatározza az alapértelmezett regionális beállításokat és jogszabályi megfelelést." />
                  </div>
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
                  <div className="flex items-center gap-1.5 mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Időzóna
                    </label>
                    <HelpTooltip text="A hálózat időzónája. A mosások időbélyegei, ütemezett feladatok és riportok ezt az időzónát használják." />
                  </div>
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
                  <div className="flex items-center gap-1.5 mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Alapértelmezett pénznem
                    </label>
                    <HelpTooltip text="Az alapértelmezett pénznem az árak, számlák és pénzügyi kimutatások megjelenítéséhez. Később több pénznem is hozzáadható." />
                  </div>
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
                  <div className="flex items-center gap-1.5 mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Nyelv
                    </label>
                    <HelpTooltip text="A hálózat alapértelmezett nyelve. A felhasználói felület, értesítések és dokumentumok ezen a nyelven jelennek meg." />
                  </div>
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
                <div className="flex items-center gap-1.5 mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Számlázó rendszer
                  </label>
                  <HelpTooltip text="Válassza ki a számlázási szolgáltatót az automatikus számlakiállításhoz. A Számlázz.hu és Billingo a legnépszerűbb magyar megoldások." />
                </div>
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
                    <div className="flex items-center gap-1.5 mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Agent kulcs
                      </label>
                      <HelpTooltip text="A Számlázz.hu Agent kulcsa az automatikus számlázáshoz. A Számlázz.hu fiókban: Beállítások > Számla Agent menüpont." />
                    </div>
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
                  <p className="text-sm text-green-700 mb-2">
                    A Billingo API kulcsot a <a href="https://app.billingo.hu/api-key" target="_blank" rel="noopener noreferrer" className="underline">Billingo admin</a> felületen tudod létrehozni.
                  </p>
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        API kulcs *
                      </label>
                      <HelpTooltip text="A Billingo API kulcsa a számlák automatikus kiállításához. A Billingo fiókban a Beállítások > API menüpont alatt található." />
                    </div>
                    <input
                      type="password"
                      value={settings.invoicing.billingoApiKey || ''}
                      onChange={(e) => updateSettings('invoicing', 'billingoApiKey', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="Billingo API kulcs"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Számlatömb ID *
                        </label>
                        <HelpTooltip text="A Billingo számlatömb azonosítója. A Billingo > Beállítások > Számlatömbök menüben találod. Minden számlatömbnek egyedi ID-ja van." />
                      </div>
                      <input
                        type="number"
                        value={settings.invoicing.billingoBlockId || ''}
                        onChange={(e) => updateSettings('invoicing', 'billingoBlockId', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="pl. 12345"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Billingo → Beállítások → Számlatömbök
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Bankszámla ID (opcionális)
                        </label>
                        <HelpTooltip text="A Billingo-ban létrehozott bankszámla azonosítója. A számlákon ez a bankszámla jelenik meg fizetési információként." />
                      </div>
                      <input
                        type="number"
                        value={settings.invoicing.billingoBankAccountId || ''}
                        onChange={(e) => updateSettings('invoicing', 'billingoBankAccountId', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="pl. 67890"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Billingo → Beállítások → Bankszámlák
                      </p>
                    </div>
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
                  <div className="flex items-center gap-1.5 mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      NAV felhasználónév
                    </label>
                    <HelpTooltip text="A NAV Online Számla rendszerhez létrehozott technikai felhasználó neve. A NAV honlapján, az Online Számla portálon hozható létre." />
                  </div>
                  <input
                    type="text"
                    value={settings.invoicing.navOnlineUser || ''}
                    onChange={(e) => updateSettings('invoicing', 'navOnlineUser', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="NAV technikai felhasználó"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Adószám (NAV)
                    </label>
                    <HelpTooltip text="A NAV-nál regisztrált 8 jegyű adószám törzs (az adószám első 8 karaktere, kötőjelek nélkül)." />
                  </div>
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

          {/* Company Data Tab */}
          {activeTab === 'companyData' && (
            <div className="space-y-6">
              {/* If platform provides service and custom provider is NOT allowed */}
              {settings.companyData?.platformHasService && !settings.companyData?.allowCustomCompanyDataProvider && (
                <div className="bg-green-50 rounded-xl p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                      {settings.companyData?.platformServiceProvider === 'OPTEN' ? 'O' : 'V'}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-green-900 mb-1">
                        {settings.companyData?.platformServiceProvider === 'OPTEN' ? 'Opten' : settings.companyData?.platformServiceProvider} - Vemiax Platform szolgáltatás
                      </h3>
                      <p className="text-green-700 mb-4">
                        A cégadatbázis szolgáltatást a Vemiax Platform biztosítja. A beállítást itt nem igényel.
                      </p>

                      {settings.companyData?.platformServiceMonthlyFee && settings.companyData.platformServiceMonthlyFee > 0 && (
                        <div className="text-sm text-green-700 mb-4">
                          Havi díj: <span className="font-semibold">{settings.companyData.platformServiceMonthlyFee.toLocaleString('hu-HU')} Ft</span>
                        </div>
                      )}

                      <div className="bg-green-100 rounded-lg p-4">
                        <h5 className="font-medium text-green-900 mb-2">Elérhető funkciók</h5>
                        <ul className="text-sm text-green-800 space-y-1">
                          <li>• Cégnév és adószám alapú keresés</li>
                          <li>• Automatikus cégadatok kitöltése új partner létrehozásakor</li>
                          <li>• Magyar adószám validálása</li>
                          <li>• Kockázati értékelés és fizetési morál</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* If no platform service and custom provider is NOT allowed */}
              {!settings.companyData?.platformHasService && !settings.companyData?.allowCustomCompanyDataProvider && (
                <div className="bg-gray-50 rounded-xl p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gray-400 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                      -
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        Nincs cégadatbázis szolgáltatás
                      </h3>
                      <p className="text-gray-600 mb-4">
                        A Platform nem biztosít központi cégadatbázis szolgáltatást, és az egyedi szolgáltató beállítás nincs engedélyezve ehhez a hálózathoz.
                      </p>
                      <p className="text-sm text-gray-500">
                        Ha szeretnél cégadatbázis szolgáltatást használni, kérd a Platform adminisztrátort, hogy engedélyezze az egyedi beállítást vagy aktiválja a központi szolgáltatást.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* If custom provider is allowed - show the full config form */}
              {settings.companyData?.allowCustomCompanyDataProvider && (
                <>
                  <div className="bg-blue-50 rounded-xl p-4 mb-4">
                    <p className="text-sm text-blue-700">
                      <strong>Saját szolgáltató engedélyezve:</strong> Beállíthatod a saját cégadatbázis szolgáltatódat. Ha nem állítasz be, a Platform szolgáltatását fogod használni (ha van).
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Cégadatbázis szolgáltató</h3>
                    <p className="text-sm text-gray-500 mb-4">
                      Integráld a cégadatbázis szolgáltatót az automatikus partner adatok lekéréséhez,
                      adószám ellenőrzéshez és kockázati értékeléshez.
                    </p>

                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Szolgáltató kiválasztása
                    </label>
                    <select
                      value={settings.companyData?.companyDataProvider || 'NONE'}
                      onChange={(e) => updateSettings('companyData', 'companyDataProvider', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      {COMPANY_DATA_PROVIDERS.map((p) => (
                        <option key={p.code} value={p.code}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  {settings.companyData?.companyDataProvider === 'OPTEN' && (
                    <div className="bg-blue-50 rounded-xl p-4 space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
                          O
                        </div>
                        <div>
                          <h4 className="font-semibold text-blue-900">Opten beállítások</h4>
                          <p className="text-sm text-blue-700">
                            Az Opten Magyarország vezető cégadatbázis szolgáltatója.
                            API hozzáférést az <a href="https://www.opten.hu" target="_blank" rel="noopener noreferrer" className="underline">opten.hu</a> oldalon igényelhetsz.
                          </p>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          API kulcs *
                        </label>
                        <input
                          type="password"
                          value={settings.companyData?.optenApiKey || ''}
                          onChange={(e) => updateSettings('companyData', 'optenApiKey', e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          placeholder="Opten API kulcs"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          API secret (opcionális)
                        </label>
                        <input
                          type="password"
                          value={settings.companyData?.optenApiSecret || ''}
                          onChange={(e) => updateSettings('companyData', 'optenApiSecret', e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          placeholder="Opten API secret (ha van)"
                        />
                      </div>

                      <div className="bg-blue-100 rounded-lg p-3">
                        <h5 className="font-medium text-blue-900 mb-1">Elérhető funkciók</h5>
                        <ul className="text-sm text-blue-800 space-y-1">
                          <li>• Cégnév és adószám alapú keresés</li>
                          <li>• Automatikus cégadatok kitöltése (cím, adószám)</li>
                          <li>• Magyar adószám validálása</li>
                          <li>• Kockázati értékelés és fizetési morál</li>
                          <li>• Tulajdonosi és vezetői adatok</li>
                          <li>• Pénzügyi adatok (árbevétel, eredmény)</li>
                        </ul>
                      </div>
                    </div>
                  )}

                  {settings.companyData?.companyDataProvider === 'BISNODE' && (
                    <div className="bg-purple-50 rounded-xl p-4 space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center text-white font-bold">
                          B
                        </div>
                        <div>
                          <h4 className="font-semibold text-purple-900">Bisnode / Dun & Bradstreet</h4>
                          <p className="text-sm text-purple-700">
                            Nemzetközi cégadatbázis szolgáltató prémium minőségű adatokkal.
                          </p>
                        </div>
                      </div>

                      <div className="text-sm text-purple-700 space-y-1">
                        <p className="font-medium">Elérhető szolgáltatások:</p>
                        <ul className="list-disc list-inside">
                          <li>• Cégkeresés adószám, cégnév alapján</li>
                          <li>• Részletes cégadatok (tulajdonosok, vezetők)</li>
                          <li>• Pénzügyi adatok (D&B előfizetéssel)</li>
                          <li>• Kockázati értékelés</li>
                        </ul>
                      </div>
                    </div>
                  )}

                  {settings.companyData?.companyDataProvider === 'E_CEGJEGYZEK' && (
                    <div className="bg-gray-50 rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-gray-600 rounded-lg flex items-center justify-center text-white font-bold">
                          e
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">e-Cégjegyzék</h4>
                          <p className="text-sm text-gray-600">
                            A hivatalos magyar cégnyilvántartás elektronikus szolgáltatása.
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 text-sm text-gray-600 space-y-1">
                        <p className="font-medium">Elérhető szolgáltatások:</p>
                        <ul className="list-disc list-inside">
                          <li>• Cégkeresés adószám, cégnév, cégjegyzékszám alapján</li>
                          <li>• Alapvető cégadatok (székhely, státusz)</li>
                          <li>• Korlátozott mód (API kulcs nélkül)</li>
                          <li>• Teljes hozzáférés e-akta előfizetéssel</li>
                        </ul>
                      </div>
                    </div>
                  )}

                  {settings.companyData?.companyDataProvider !== 'NONE' && settings.companyData?.companyDataProvider && (
                    <div className="bg-gray-50 rounded-xl p-4">
                      <h4 className="font-semibold text-gray-900 mb-2">Kapcsolat teszt</h4>
                      <p className="text-sm text-gray-600 mb-3">
                        Mentés után teszteld a kapcsolatot a Cégadatok oldalon a &quot;Kapcsolat teszt&quot; gombbal.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Email beállítások</h3>

              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Email szolgáltató
                  </label>
                  <HelpTooltip text="Válassza ki az email küldési szolgáltatót. Platform: a központi szolgáltatást használja. SMTP/Resend: saját email szervert használ." />
                </div>
                <select
                  value={settings.email.emailProvider || 'PLATFORM'}
                  onChange={(e) => updateSettings('email', 'emailProvider', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="PLATFORM">Platform alapértelmezett</option>
                  <option value="SMTP">SMTP szerver (saját)</option>
                  <option value="RESEND">Resend (saját API kulcs)</option>
                </select>
                <p className="text-sm text-gray-500 mt-1">
                  {settings.email.emailProvider === 'PLATFORM' && 'A platform által biztosított email küldést használja.'}
                  {settings.email.emailProvider === 'SMTP' && 'Saját SMTP szervert használ az email küldéshez.'}
                  {settings.email.emailProvider === 'RESEND' && 'Saját Resend API kulcsot használ az email küldéshez.'}
                </p>
              </div>

              {settings.email.emailProvider === 'SMTP' && (
                <div className="bg-gray-50 rounded-xl p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                          SMTP szerver
                        </label>
                        <HelpTooltip text="Az SMTP szerver címe (pl. smtp.gmail.com, smtp.office365.com). Az email szolgáltatódtól kapod meg ezt az információt." />
                      </div>
                      <input
                        type="text"
                        value={settings.email.smtpHost || ''}
                        onChange={(e) => updateSettings('email', 'smtpHost', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl"
                        placeholder="smtp.example.com"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Port
                        </label>
                        <HelpTooltip text="Az SMTP port száma. Általában: 587 (TLS), 465 (SSL), 25 (nem titkosított - nem ajánlott)." />
                      </div>
                      <input
                        type="number"
                        value={settings.email.smtpPort || 587}
                        onChange={(e) => updateSettings('email', 'smtpPort', parseInt(e.target.value))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                          SMTP felhasználó
                        </label>
                        <HelpTooltip text="Az SMTP hitelesítéshez használt felhasználónév. Általában az email cím vagy egy külön létrehozott felhasználó." />
                      </div>
                      <input
                        type="text"
                        value={settings.email.smtpUser || ''}
                        onChange={(e) => updateSettings('email', 'smtpUser', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl"
                        placeholder="user@example.com"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                          SMTP jelszó
                        </label>
                        <HelpTooltip text="Az SMTP hitelesítéshez használt jelszó. Gmail esetén alkalmazásjelszó szükséges, nem a normál fiók jelszava." />
                      </div>
                      <input
                        type="password"
                        value={settings.email.smtpPassword || ''}
                        onChange={(e) => updateSettings('email', 'smtpPassword', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Feladó email
                        </label>
                        <HelpTooltip text="Az email cím, amelyről a levelek kimennek. A címzettek ezt látják feladóként." />
                      </div>
                      <input
                        type="email"
                        value={settings.email.smtpFromEmail || ''}
                        onChange={(e) => updateSettings('email', 'smtpFromEmail', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl"
                        placeholder="noreply@example.com"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Feladó név
                        </label>
                        <HelpTooltip text="A feladó megjelenített neve az emailekben. Ez jelenik meg a címzett postafiókjában a feladó neveként." />
                      </div>
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

              {settings.email.emailProvider === 'RESEND' && (
                <div className="bg-gray-50 rounded-xl p-4 space-y-4">
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Resend API kulcs
                      </label>
                      <HelpTooltip text="A Resend szolgáltatás API kulcsa. A resend.com oldalon regisztráció után hozható létre az API Keys menüpontban." />
                    </div>
                    <input
                      type="password"
                      value={settings.email.resendApiKey || ''}
                      onChange={(e) => updateSettings('email', 'resendApiKey', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl"
                      placeholder="re_xxxxx..."
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      A Resend API kulcsot a <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">resend.com</a> oldalon tudod létrehozni.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Feladó email
                        </label>
                        <HelpTooltip text="Az email cím, amelyről a levelek kimennek. Resend esetén a domain-t előbb hitelesíteni kell." />
                      </div>
                      <input
                        type="email"
                        value={settings.email.smtpFromEmail || ''}
                        onChange={(e) => updateSettings('email', 'smtpFromEmail', e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl"
                        placeholder="noreply@example.com"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Feladó név
                        </label>
                        <HelpTooltip text="A feladó megjelenített neve az emailekben. Ez jelenik meg a címzett postafiókjában." />
                      </div>
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

              {/* Test Email Button */}
              {settings.email.emailProvider !== 'PLATFORM' && (
                <TestEmailButton settings={settings} />
              )}

              <hr className="my-6" />
              <h3 className="text-lg font-semibold text-gray-900 mb-4">SMS beállítások</h3>

              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    SMS szolgáltató
                  </label>
                  <HelpTooltip text="SMS küldési szolgáltató kiválasztása. A Twilio a legelterjedtebb megoldás programozott SMS küldéshez." />
                </div>
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
                    <div className="flex items-center gap-1.5 mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Twilio Account SID
                      </label>
                      <HelpTooltip text="A Twilio fiók SID azonosítója. A Twilio Console főoldalán található 'Account SID' mezőben." />
                    </div>
                    <input
                      type="text"
                      value={settings.sms.twilioAccountSid || ''}
                      onChange={(e) => updateSettings('sms', 'twilioAccountSid', e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl"
                      placeholder="AC..."
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Twilio telefonszám
                      </label>
                      <HelpTooltip text="A Twilio-tól kapott telefonszám, amelyről az SMS-ek kimennek. Nemzetközi formátumban add meg (pl. +36701234567)." />
                    </div>
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
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Fizetési módok</h3>
                <HelpTooltip text="Állítsa be, hogy az ügyfelek milyen fizetési módokat használhatnak a mosások kifizetéséhez." />
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.business.allowCashPayment}
                    onChange={(e) => updateSettings('business', 'allowCashPayment', e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-700">Készpénzes fizetés engedélyezése</span>
                    <HelpTooltip text="Engedélyezi a készpénzes fizetést az operátoroknál. Az operátor manuálisan rögzíti a fizetést." />
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.business.allowCardPayment}
                    onChange={(e) => updateSettings('business', 'allowCardPayment', e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-700">Bankkártyás fizetés engedélyezése</span>
                    <HelpTooltip text="Engedélyezi a bankkártyás fizetést. Online fizetéshez Stripe integráció szükséges." />
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.business.allowFuelCards}
                    onChange={(e) => updateSettings('business', 'allowFuelCards', e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-700">Üzemanyagkártyás fizetés engedélyezése</span>
                    <HelpTooltip text="Engedélyezi üzemanyagkártyák (MOL, Shell, stb.) elfogadását. A kártya adatok rögzítése szükséges." />
                  </div>
                </label>
              </div>

              <hr className="my-6" />
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Regisztráció és jóváhagyás</h3>
                <HelpTooltip text="Szabályozza, hogyan regisztrálhatnak és válhatnak aktívvá a sofőrök a rendszerben." />
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.business.allowSelfRegistration}
                    onChange={(e) => updateSettings('business', 'allowSelfRegistration', e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div className="flex items-center gap-1.5">
                    <div>
                      <span className="text-gray-700">Önálló regisztráció engedélyezése</span>
                      <p className="text-sm text-gray-500">Sofőrök regisztrálhatnak meghívókód nélkül</p>
                    </div>
                    <HelpTooltip text="Ha engedélyezve van, bárki regisztrálhat a rendszerbe. Ha kikapcsolt, csak meghívóval lehet csatlakozni." />
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.business.autoApproveDrivers}
                    onChange={(e) => updateSettings('business', 'autoApproveDrivers', e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div className="flex items-center gap-1.5">
                    <div>
                      <span className="text-gray-700">Automatikus sofőr jóváhagyás</span>
                      <p className="text-sm text-gray-500">Új sofőrök automatikusan jóváhagyásra kerülnek</p>
                    </div>
                    <HelpTooltip text="Ha kikapcsolt, az adminnak manuálisan kell jóváhagynia minden új sofőrt, mielőtt mosást indíthatnának." />
                  </div>
                </label>
              </div>

              <hr className="my-6" />
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Ellenőrzési követelmények</h3>
                <HelpTooltip text="Határozza meg, milyen ellenőrzések szükségesek a sofőrök regisztrációjánál." />
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.business.requireEmailVerify}
                    onChange={(e) => updateSettings('business', 'requireEmailVerify', e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div className="flex items-center gap-1.5">
                    <div>
                      <span className="text-gray-700">Email megerősítés szükséges</span>
                      <p className="text-sm text-gray-500">Sofőröknek meg kell erősíteniük az email címüket</p>
                    </div>
                    <HelpTooltip text="A sofőrnek meg kell erősítenie email címét egy megerősítő linkre kattintva, mielőtt beléphetne." />
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.business.requirePhoneVerify}
                    onChange={(e) => updateSettings('business', 'requirePhoneVerify', e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div className="flex items-center gap-1.5">
                    <div>
                      <span className="text-gray-700">Telefonszám megerősítés szükséges</span>
                      <p className="text-sm text-gray-500">Sofőröknek SMS-ben meg kell erősíteniük a telefonszámukat</p>
                    </div>
                    <HelpTooltip text="A sofőrnek SMS kóddal kell megerősítenie telefonszámát. Ehhez SMS szolgáltató beállítása szükséges." />
                  </div>
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save Button */}
      {!isReadOnly && (
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
      )}
    </div>
  );
}
