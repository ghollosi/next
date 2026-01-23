'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.vemiax.com';

interface BillingSettings {
  id?: string;
  invoiceProvider: 'NONE' | 'SZAMLAZZ' | 'BILLINGO' | 'NAV_ONLINE' | 'MANUAL';
  szamlazzAgentKey?: string;
  billingoApiKey?: string;
  billingoBlockId?: number;
  billingoBankAccountId?: number;
  sellerName?: string;
  sellerAddress?: string;
  sellerCity?: string;
  sellerZipCode?: string;
  sellerCountry?: string;
  sellerTaxNumber?: string;
  sellerEuVatNumber?: string;
  sellerBankAccount?: string;
  sellerBankName?: string;
  contactEmail?: string;
  contactPhone?: string;
}

const defaultSettings: BillingSettings = {
  invoiceProvider: 'NONE',
  sellerCountry: 'HU',
};

export default function BillingSettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<BillingSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [locationId, setLocationId] = useState<string | null>(null);

  const getHeaders = useCallback(() => {
    const session = localStorage.getItem('operator_session');
    const locId = locationId || localStorage.getItem('operator_location_id');
    return {
      'x-operator-session': session || '',
      'x-location-id': locId || '',
      'Content-Type': 'application/json',
    };
  }, [locationId]);

  const loadSettings = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/location-billing/settings`, {
        headers: getHeaders(),
      });

      if (response.status === 401) {
        router.replace('/operator-portal/login');
        return;
      }

      if (response.ok) {
        const data = await response.json();
        if (data) {
          setSettings({ ...defaultSettings, ...data });
        }
      }
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba történt');
    } finally {
      setLoading(false);
    }
  }, [getHeaders, router]);

  useEffect(() => {
    const session = localStorage.getItem('operator_session');
    const info = localStorage.getItem('operator_info');

    if (!session || !info) {
      router.replace('/operator-portal/login');
      return;
    }

    const parsedInfo = JSON.parse(info);
    setLocationId(parsedInfo.locationId);
    localStorage.setItem('operator_location_id', parsedInfo.locationId);

    loadSettings();
  }, [router, loadSettings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${API_URL}/location-billing/settings`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Mentés sikertelen');
      }

      setSuccess('Beállítások sikeresen mentve!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba történt');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Betöltés...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-green-600 text-white px-4 py-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/operator-portal/dashboard"
              className="text-green-200 hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-xl font-bold">Számlázási beállítások</h1>
              <p className="text-green-200 text-sm">Számlázó szolgáltató és cégadatok</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {/* Error / Success */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-600">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 text-green-600">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Invoice Provider */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Számlázó szolgáltató</h2>
            <p className="text-sm text-gray-500 mb-4">
              Válassza ki, melyik szolgáltatón keresztül szeretné kiállítani a számlákat
            </p>

            <div className="space-y-3">
              {[
                { value: 'NONE', label: 'Nincs (manuális számlázás)', desc: 'Saját maga állítja ki a számlákat' },
                { value: 'SZAMLAZZ', label: 'Szamlazz.hu', desc: 'Automatikus számla kiállítás Szamlazz.hu-n keresztül' },
                { value: 'BILLINGO', label: 'Billingo', desc: 'Automatikus számla kiállítás Billingo-n keresztül' },
                { value: 'NAV_ONLINE', label: 'NAV Online Számla', desc: 'Közvetlen NAV bejelentés' },
              ].map((option) => (
                <label
                  key={option.value}
                  className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                    settings.invoiceProvider === option.value
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="invoiceProvider"
                    value={option.value}
                    checked={settings.invoiceProvider === option.value}
                    onChange={(e) => setSettings({ ...settings, invoiceProvider: e.target.value as any })}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium text-gray-900">{option.label}</div>
                    <div className="text-sm text-gray-500">{option.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Provider-specific settings */}
          {settings.invoiceProvider === 'SZAMLAZZ' && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Szamlazz.hu beállítások</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Agent Key (API kulcs)
                </label>
                <input
                  type="password"
                  value={settings.szamlazzAgentKey || ''}
                  onChange={(e) => setSettings({ ...settings, szamlazzAgentKey: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  placeholder="szamlazz_agent_key..."
                />
                <p className="mt-1 text-xs text-gray-500">
                  A Szamlazz.hu fiókjában a Beállítások / Számla agent alatt található
                </p>
              </div>
            </div>
          )}

          {settings.invoiceProvider === 'BILLINGO' && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Billingo beállítások</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    API kulcs
                  </label>
                  <input
                    type="password"
                    value={settings.billingoApiKey || ''}
                    onChange={(e) => setSettings({ ...settings, billingoApiKey: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tömb ID (Block ID)
                    </label>
                    <input
                      type="number"
                      value={settings.billingoBlockId || ''}
                      onChange={(e) => setSettings({ ...settings, billingoBlockId: parseInt(e.target.value) || undefined })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bankszámla ID
                    </label>
                    <input
                      type="number"
                      value={settings.billingoBankAccountId || ''}
                      onChange={(e) => setSettings({ ...settings, billingoBankAccountId: parseInt(e.target.value) || undefined })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Seller Data */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Eladó (cég) adatok</h2>
            <p className="text-sm text-gray-500 mb-4">
              Ezek az adatok jelennek meg a kiállított számlákon eladóként
            </p>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cégnév *</label>
                  <input
                    type="text"
                    value={settings.sellerName || ''}
                    onChange={(e) => setSettings({ ...settings, sellerName: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Adószám *</label>
                  <input
                    type="text"
                    value={settings.sellerTaxNumber || ''}
                    onChange={(e) => setSettings({ ...settings, sellerTaxNumber: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder="12345678-1-23"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">EU adószám</label>
                  <input
                    type="text"
                    value={settings.sellerEuVatNumber || ''}
                    onChange={(e) => setSettings({ ...settings, sellerEuVatNumber: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder="HU12345678"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cím</label>
                  <input
                    type="text"
                    value={settings.sellerAddress || ''}
                    onChange={(e) => setSettings({ ...settings, sellerAddress: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Város</label>
                  <input
                    type="text"
                    value={settings.sellerCity || ''}
                    onChange={(e) => setSettings({ ...settings, sellerCity: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Irányítószám</label>
                  <input
                    type="text"
                    value={settings.sellerZipCode || ''}
                    onChange={(e) => setSettings({ ...settings, sellerZipCode: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bankszámlaszám</label>
                  <input
                    type="text"
                    value={settings.sellerBankAccount || ''}
                    onChange={(e) => setSettings({ ...settings, sellerBankAccount: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder="12345678-12345678-12345678"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bank neve</label>
                  <input
                    type="text"
                    value={settings.sellerBankName || ''}
                    onChange={(e) => setSettings({ ...settings, sellerBankName: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Kapcsolattartó</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={settings.contactEmail || ''}
                  onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Ide érkeznek a kimutatás értesítések
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                <input
                  type="tel"
                  value={settings.contactPhone || ''}
                  onChange={(e) => setSettings({ ...settings, contactPhone: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? 'Mentés...' : 'Beállítások mentése'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
