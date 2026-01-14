'use client';

import { useState, useEffect } from 'react';
import { platformApi, getPlatformAdmin } from '@/lib/platform-api';

interface Settings {
  id: string;
  platformName: string;
  platformUrl?: string;
  supportEmail?: string;
  supportPhone?: string;
  defaultTrialDays: number;
  baseMonthlyFee: number;
  perWashFee: number;
  emailConfigured: boolean;
  smsConfigured: boolean;
  stripeConfigured: boolean;
  invoiceConfigured: boolean;
  invoiceProvider: string;
}

export default function PlatformSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const admin = getPlatformAdmin();
  const isOwner = admin?.role === 'PLATFORM_OWNER';

  // Form state
  const [platformName, setPlatformName] = useState('');
  const [platformUrl, setPlatformUrl] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [supportPhone, setSupportPhone] = useState('');
  const [defaultTrialDays, setDefaultTrialDays] = useState(14);
  const [baseMonthlyFee, setBaseMonthlyFee] = useState(0);
  const [perWashFee, setPerWashFee] = useState(0);

  // API keys (only for owner)
  const [resendApiKey, setResendApiKey] = useState('');
  const [twilioAccountSid, setTwilioAccountSid] = useState('');
  const [twilioAuthToken, setTwilioAuthToken] = useState('');
  const [twilioPhoneNumber, setTwilioPhoneNumber] = useState('');

  // Stripe settings (only for owner)
  const [stripeSecretKey, setStripeSecretKey] = useState('');
  const [stripePublishableKey, setStripePublishableKey] = useState('');
  const [stripeWebhookSecret, setStripeWebhookSecret] = useState('');
  const [stripeBasePriceId, setStripeBasePriceId] = useState('');
  const [stripeUsagePriceId, setStripeUsagePriceId] = useState('');

  // Invoice provider settings (for billing networks)
  const [invoiceProvider, setInvoiceProvider] = useState('NONE');
  const [szamlazzAgentKey, setSzamlazzAgentKey] = useState('');
  const [szamlazzSellerName, setSzamlazzSellerName] = useState('');
  const [szamlazzSellerAddress, setSzamlazzSellerAddress] = useState('');
  const [szamlazzSellerCity, setSzamlazzSellerCity] = useState('');
  const [szamlazzSellerZipCode, setSzamlazzSellerZipCode] = useState('');
  const [szamlazzSellerTaxNumber, setSzamlazzSellerTaxNumber] = useState('');
  const [szamlazzSellerBankAccount, setSzamlazzSellerBankAccount] = useState('');
  const [billingoApiKey, setBillingoApiKey] = useState('');
  const [billingoBlockId, setBillingoBlockId] = useState('');
  const [billingoBankAccountId, setBillingoBankAccountId] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await platformApi.getSettings();
      setSettings(data);
      setPlatformName(data.platformName);
      setPlatformUrl(data.platformUrl || '');
      setSupportEmail(data.supportEmail || '');
      setSupportPhone(data.supportPhone || '');
      setDefaultTrialDays(data.defaultTrialDays);
      setBaseMonthlyFee(data.baseMonthlyFee);
      setPerWashFee(data.perWashFee);
      setInvoiceProvider(data.invoiceProvider || 'NONE');
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
      const data = await platformApi.updateSettings({
        platformName,
        platformUrl: platformUrl || undefined,
        supportEmail: supportEmail || undefined,
        supportPhone: supportPhone || undefined,
        defaultTrialDays,
        baseMonthlyFee,
        perWashFee,
        ...(resendApiKey ? { resendApiKey } : {}),
        ...(twilioAccountSid ? { twilioAccountSid } : {}),
        ...(twilioAuthToken ? { twilioAuthToken } : {}),
        ...(twilioPhoneNumber ? { twilioPhoneNumber } : {}),
        ...(stripeSecretKey ? { stripeSecretKey } : {}),
        ...(stripePublishableKey ? { stripePublishableKey } : {}),
        ...(stripeWebhookSecret ? { stripeWebhookSecret } : {}),
        ...(stripeBasePriceId ? { stripeBasePriceId } : {}),
        ...(stripeUsagePriceId ? { stripeUsagePriceId } : {}),
        // Invoice provider settings
        invoiceProvider,
        ...(szamlazzAgentKey ? { szamlazzAgentKey } : {}),
        ...(szamlazzSellerName ? { szamlazzSellerName } : {}),
        ...(szamlazzSellerAddress ? { szamlazzSellerAddress } : {}),
        ...(szamlazzSellerCity ? { szamlazzSellerCity } : {}),
        ...(szamlazzSellerZipCode ? { szamlazzSellerZipCode } : {}),
        ...(szamlazzSellerTaxNumber ? { szamlazzSellerTaxNumber } : {}),
        ...(szamlazzSellerBankAccount ? { szamlazzSellerBankAccount } : {}),
        ...(billingoApiKey ? { billingoApiKey } : {}),
        ...(billingoBlockId ? { billingoBlockId: parseInt(billingoBlockId) } : {}),
        ...(billingoBankAccountId ? { billingoBankAccountId: parseInt(billingoBankAccountId) } : {}),
      });
      setSettings(data);
      setSuccess('Beállítások mentve!');
      // Clear API key fields after save
      setResendApiKey('');
      setTwilioAccountSid('');
      setTwilioAuthToken('');
      setTwilioPhoneNumber('');
      setStripeSecretKey('');
      setStripePublishableKey('');
      setStripeWebhookSecret('');
      setStripeBasePriceId('');
      setStripeUsagePriceId('');
      setSzamlazzAgentKey('');
      setBillingoApiKey('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba történt');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="bg-yellow-900/50 border border-yellow-500 rounded-xl p-6 text-yellow-300">
        <h2 className="text-lg font-semibold mb-2">Nincs jogosultságod</h2>
        <p>Csak Platform Owner módosíthatja a platform beállításokat.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-white">Platform beállítások</h1>

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

      {/* General settings */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Általános</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Platform neve
            </label>
            <input
              type="text"
              value={platformName}
              onChange={(e) => setPlatformName(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Platform URL
            </label>
            <input
              type="url"
              value={platformUrl}
              onChange={(e) => setPlatformUrl(e.target.value)}
              placeholder="https://vsys.hu"
              className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Support email
              </label>
              <input
                type="email"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Support telefon
              </label>
              <input
                type="tel"
                value={supportPhone}
                onChange={(e) => setSupportPhone(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Árazás (SaaS díjak)</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Trial időszak (napok)
            </label>
            <input
              type="number"
              value={defaultTrialDays}
              onChange={(e) => setDefaultTrialDays(parseInt(e.target.value) || 0)}
              min={0}
              max={90}
              className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Alap havi díj (Ft)
              </label>
              <input
                type="number"
                value={baseMonthlyFee}
                onChange={(e) => setBaseMonthlyFee(parseFloat(e.target.value) || 0)}
                min={0}
                step={100}
                className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Díj mosásonként (Ft)
              </label>
              <input
                type="number"
                value={perWashFee}
                onChange={(e) => setPerWashFee(parseFloat(e.target.value) || 0)}
                min={0}
                step={1}
                className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Email settings */}
      <div className="bg-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Email szolgáltató (Resend)</h2>
          {settings?.emailConfigured ? (
            <span className="px-2.5 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-medium">
              Konfigurálva
            </span>
          ) : (
            <span className="px-2.5 py-1 bg-gray-500/20 text-gray-400 rounded-full text-xs font-medium">
              Nincs konfigurálva
            </span>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Resend API Key
          </label>
          <input
            type="password"
            value={resendApiKey}
            onChange={(e) => setResendApiKey(e.target.value)}
            placeholder={settings?.emailConfigured ? '••••••••••••' : 're_xxxxxxxxx...'}
            className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <p className="text-xs text-gray-500 mt-1">Hagyd üresen, ha nem akarod módosítani</p>
        </div>
      </div>

      {/* SMS settings */}
      <div className="bg-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">SMS szolgáltató (Twilio)</h2>
          {settings?.smsConfigured ? (
            <span className="px-2.5 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-medium">
              Konfigurálva
            </span>
          ) : (
            <span className="px-2.5 py-1 bg-gray-500/20 text-gray-400 rounded-full text-xs font-medium">
              Nincs konfigurálva
            </span>
          )}
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Account SID
            </label>
            <input
              type="password"
              value={twilioAccountSid}
              onChange={(e) => setTwilioAccountSid(e.target.value)}
              placeholder={settings?.smsConfigured ? '••••••••••••' : 'ACxxxxxxxxx...'}
              className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Auth Token
            </label>
            <input
              type="password"
              value={twilioAuthToken}
              onChange={(e) => setTwilioAuthToken(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Telefonszám
            </label>
            <input
              type="tel"
              value={twilioPhoneNumber}
              onChange={(e) => setTwilioPhoneNumber(e.target.value)}
              placeholder="+36..."
              className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Stripe Payment Gateway settings */}
      <div className="bg-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Stripe fizetési kapu</h2>
          {settings?.stripeConfigured ? (
            <span className="px-2.5 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-medium">
              Konfigurálva
            </span>
          ) : (
            <span className="px-2.5 py-1 bg-gray-500/20 text-gray-400 rounded-full text-xs font-medium">
              Nincs konfigurálva
            </span>
          )}
        </div>
        <p className="text-sm text-gray-400 mb-4">
          A Stripe integráció lehetővé teszi az automatikus előfizetés kezelést és számlázást a Network-ök számára.
        </p>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Secret Key
              </label>
              <input
                type="password"
                value={stripeSecretKey}
                onChange={(e) => setStripeSecretKey(e.target.value)}
                placeholder={settings?.stripeConfigured ? '••••••••••••' : 'sk_live_xxxx...'}
                className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-xs text-gray-500 mt-1">Stripe Dashboard &gt; Developers &gt; API keys</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Publishable Key
              </label>
              <input
                type="text"
                value={stripePublishableKey}
                onChange={(e) => setStripePublishableKey(e.target.value)}
                placeholder={settings?.stripeConfigured ? 'Már beállítva' : 'pk_live_xxxx...'}
                className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-xs text-gray-500 mt-1">Frontend számára (nyilvános)</p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Webhook Secret
            </label>
            <input
              type="password"
              value={stripeWebhookSecret}
              onChange={(e) => setStripeWebhookSecret(e.target.value)}
              placeholder={settings?.stripeConfigured ? '••••••••••••' : 'whsec_xxxx...'}
              className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Stripe Dashboard &gt; Developers &gt; Webhooks. Webhook URL: {typeof window !== 'undefined' ? window.location.origin.replace(':3001', ':3000') : ''}/stripe/webhook
            </p>
          </div>
          <div className="border-t border-gray-700 pt-4 mt-4">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Stripe Product árak</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Havi alap díj Price ID
                </label>
                <input
                  type="text"
                  value={stripeBasePriceId}
                  onChange={(e) => setStripeBasePriceId(e.target.value)}
                  placeholder="price_xxxx..."
                  className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">Recurring/flat price (havi)</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Mosásonkénti díj Price ID (opcionális)
                </label>
                <input
                  type="text"
                  value={stripeUsagePriceId}
                  onChange={(e) => setStripeUsagePriceId(e.target.value)}
                  placeholder="price_xxxx..."
                  className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">Metered/usage-based price</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Provider settings - for billing networks */}
      <div className="bg-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Számlázó szolgáltató (Network-ök felé)</h2>
          {settings?.invoiceConfigured ? (
            <span className="px-2.5 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-medium">
              Konfigurálva
            </span>
          ) : (
            <span className="px-2.5 py-1 bg-gray-500/20 text-gray-400 rounded-full text-xs font-medium">
              Nincs konfigurálva
            </span>
          )}
        </div>
        <p className="text-sm text-gray-400 mb-4">
          Ez a beállítás a Network-ök felé kiállított SaaS előfizetési számlákhoz szükséges.
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Számlázó szolgáltató
            </label>
            <select
              value={invoiceProvider}
              onChange={(e) => setInvoiceProvider(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="NONE">Nincs (manuális számlázás)</option>
              <option value="SZAMLAZZ">Számlázz.hu</option>
              <option value="BILLINGO">Billingo</option>
            </select>
          </div>

          {invoiceProvider === 'SZAMLAZZ' && (
            <div className="border-t border-gray-700 pt-4 mt-4 space-y-4">
              <h3 className="text-sm font-medium text-gray-300">Számlázz.hu beállítások</h3>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Agent kulcs
                </label>
                <input
                  type="password"
                  value={szamlazzAgentKey}
                  onChange={(e) => setSzamlazzAgentKey(e.target.value)}
                  placeholder={settings?.invoiceConfigured && invoiceProvider === 'SZAMLAZZ' ? '••••••••••••' : 'Agent kulcs'}
                  className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Eladó neve (cégnév)
                  </label>
                  <input
                    type="text"
                    value={szamlazzSellerName}
                    onChange={(e) => setSzamlazzSellerName(e.target.value)}
                    placeholder="Vemiax Kft."
                    className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Adószám
                  </label>
                  <input
                    type="text"
                    value={szamlazzSellerTaxNumber}
                    onChange={(e) => setSzamlazzSellerTaxNumber(e.target.value)}
                    placeholder="12345678-2-42"
                    className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Irányítószám
                  </label>
                  <input
                    type="text"
                    value={szamlazzSellerZipCode}
                    onChange={(e) => setSzamlazzSellerZipCode(e.target.value)}
                    placeholder="1234"
                    className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Város
                  </label>
                  <input
                    type="text"
                    value={szamlazzSellerCity}
                    onChange={(e) => setSzamlazzSellerCity(e.target.value)}
                    placeholder="Budapest"
                    className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Utca, házszám
                  </label>
                  <input
                    type="text"
                    value={szamlazzSellerAddress}
                    onChange={(e) => setSzamlazzSellerAddress(e.target.value)}
                    placeholder="Fő utca 1."
                    className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Bankszámlaszám
                </label>
                <input
                  type="text"
                  value={szamlazzSellerBankAccount}
                  onChange={(e) => setSzamlazzSellerBankAccount(e.target.value)}
                  placeholder="12345678-12345678-12345678"
                  className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          {invoiceProvider === 'BILLINGO' && (
            <div className="border-t border-gray-700 pt-4 mt-4 space-y-4">
              <h3 className="text-sm font-medium text-gray-300">Billingo beállítások</h3>
              <p className="text-xs text-gray-500">
                A Billingo API kulcsot a <a href="https://app.billingo.hu/api-key" target="_blank" rel="noopener noreferrer" className="text-indigo-400 underline">Billingo admin</a> felületen tudod létrehozni.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  API kulcs
                </label>
                <input
                  type="password"
                  value={billingoApiKey}
                  onChange={(e) => setBillingoApiKey(e.target.value)}
                  placeholder={settings?.invoiceConfigured && invoiceProvider === 'BILLINGO' ? '••••••••••••' : 'API kulcs'}
                  className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Számlatömb ID
                  </label>
                  <input
                    type="number"
                    value={billingoBlockId}
                    onChange={(e) => setBillingoBlockId(e.target.value)}
                    placeholder="12345"
                    className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Billingo → Beállítások → Számlatömbök</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Bankszámla ID (opcionális)
                  </label>
                  <input
                    type="number"
                    value={billingoBankAccountId}
                    onChange={(e) => setBillingoBankAccountId(e.target.value)}
                    placeholder="67890"
                    className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Billingo → Beállítások → Bankszámlák</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {saving ? 'Mentés...' : 'Beállítások mentése'}
        </button>
      </div>
    </div>
  );
}
