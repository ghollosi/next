'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.vemiax.com';

interface LocationPartner {
  id: string;
  name: string;
  code: string;
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
  paymentDueDays: number;
}

interface PartnerFormData {
  name: string;
  code: string;
  contactName: string;
  email: string;
  phone: string;
  billingType: 'CONTRACT' | 'CASH';
  billingCycle: 'MONTHLY' | 'WEEKLY' | '';
  billingName: string;
  billingAddress: string;
  billingCity: string;
  billingZipCode: string;
  billingCountry: string;
  taxNumber: string;
  euVatNumber: string;
  paymentDueDays: number;
}

const emptyForm: PartnerFormData = {
  name: '',
  code: '',
  contactName: '',
  email: '',
  phone: '',
  billingType: 'CONTRACT',
  billingCycle: 'MONTHLY',
  billingName: '',
  billingAddress: '',
  billingCity: '',
  billingZipCode: '',
  billingCountry: 'HU',
  taxNumber: '',
  euVatNumber: '',
  paymentDueDays: 8,
};

export default function LocationPartnersPage() {
  const router = useRouter();
  const [partners, setPartners] = useState<LocationPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<PartnerFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [taxNumberWarning, setTaxNumberWarning] = useState<string | null>(null);
  const [checkingTaxNumber, setCheckingTaxNumber] = useState(false);
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

  const loadPartners = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/location-billing/partners`, {
        headers: getHeaders(),
      });

      if (response.status === 401) {
        router.replace('/operator-portal/login');
        return;
      }

      if (!response.ok) {
        throw new Error('Partnerek betöltése sikertelen');
      }

      const data = await response.json();
      setPartners(data);
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

    loadPartners();
  }, [router, loadPartners]);

  const checkTaxNumber = async (taxNumber: string) => {
    if (!taxNumber || taxNumber.length < 8) {
      setTaxNumberWarning(null);
      return;
    }

    setCheckingTaxNumber(true);
    try {
      const response = await fetch(`${API_URL}/location-billing/partners/check-tax-number`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ taxNumber }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.isNetworkPartner) {
          setTaxNumberWarning(
            `Ez a cég már a Network partnere (${result.partnerName}). Közvetlen szerződésre és számlázásra nincs lehetőség.`
          );
        } else {
          setTaxNumberWarning(null);
        }
      }
    } catch (err) {
      console.error('Tax number check failed', err);
    } finally {
      setCheckingTaxNumber(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (taxNumberWarning) {
      setError('A megadott adószám már a Network partneré. Válasszon másik céget.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const url = editingId
        ? `${API_URL}/location-billing/partners/${editingId}`
        : `${API_URL}/location-billing/partners`;

      const response = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          ...formData,
          billingCycle: formData.billingType === 'CONTRACT' ? formData.billingCycle : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Mentés sikertelen');
      }

      setShowForm(false);
      setEditingId(null);
      setFormData(emptyForm);
      loadPartners();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba történt');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (partner: LocationPartner) => {
    setFormData({
      name: partner.name,
      code: partner.code,
      contactName: partner.contactName || '',
      email: partner.email || '',
      phone: partner.phone || '',
      billingType: partner.billingType,
      billingCycle: partner.billingCycle || 'MONTHLY',
      billingName: partner.billingName || '',
      billingAddress: partner.billingAddress || '',
      billingCity: partner.billingCity || '',
      billingZipCode: partner.billingZipCode || '',
      billingCountry: 'HU',
      taxNumber: partner.taxNumber || '',
      euVatNumber: '',
      paymentDueDays: partner.paymentDueDays,
    });
    setEditingId(partner.id);
    setShowForm(true);
  };

  const handleDelete = async (partnerId: string) => {
    if (!confirm('Biztosan törli ezt a partnert?')) return;

    try {
      const response = await fetch(`${API_URL}/location-billing/partners/${partnerId}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });

      if (!response.ok) {
        throw new Error('Törlés sikertelen');
      }

      loadPartners();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba történt');
    }
  };

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
              <h1 className="text-xl font-bold">Partner cégek</h1>
              <p className="text-green-200 text-sm">Saját szerződéses partnerek kezelése</p>
            </div>
          </div>
          <button
            onClick={() => {
              setFormData(emptyForm);
              setEditingId(null);
              setShowForm(true);
            }}
            className="px-4 py-2 bg-white text-green-600 hover:bg-green-50 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Új Partner
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-600">
            {error}
          </div>
        )}

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b">
                <h2 className="text-xl font-bold">
                  {editingId ? 'Partner szerkesztése' : 'Új partner hozzáadása'}
                </h2>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cégnév *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Kód (rövid azonosító) *
                    </label>
                    <input
                      type="text"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      required
                      maxLength={10}
                    />
                  </div>
                </div>

                {/* Tax Number with collision check */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Adószám
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.taxNumber}
                      onChange={(e) => {
                        setFormData({ ...formData, taxNumber: e.target.value });
                        checkTaxNumber(e.target.value);
                      }}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
                        taxNumberWarning ? 'border-red-500 bg-red-50' : ''
                      }`}
                      placeholder="12345678-1-23"
                    />
                    {checkingTaxNumber && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-5 h-5 border-2 border-gray-300 border-t-green-600 rounded-full animate-spin"></div>
                      </div>
                    )}
                  </div>
                  {taxNumberWarning && (
                    <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      {taxNumberWarning}
                    </p>
                  )}
                </div>

                {/* Contact Info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Kapcsolattartó
                    </label>
                    <input
                      type="text"
                      value={formData.contactName}
                      onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Telefon
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                </div>

                {/* Billing Type */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Számlázás típusa *
                    </label>
                    <select
                      value={formData.billingType}
                      onChange={(e) => setFormData({ ...formData, billingType: e.target.value as 'CONTRACT' | 'CASH' })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    >
                      <option value="CONTRACT">Gyűjtőszámla (átutalás)</option>
                      <option value="CASH">Azonnali fizetés (kp/kártya)</option>
                    </select>
                  </div>
                  {formData.billingType === 'CONTRACT' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Számlázási ciklus
                      </label>
                      <select
                        value={formData.billingCycle}
                        onChange={(e) => setFormData({ ...formData, billingCycle: e.target.value as 'MONTHLY' | 'WEEKLY' })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      >
                        <option value="MONTHLY">Havi</option>
                        <option value="WEEKLY">Heti</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Billing Address */}
                <div className="border-t pt-4">
                  <h3 className="font-medium text-gray-900 mb-3">Számlázási cím</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Számlázási név
                      </label>
                      <input
                        type="text"
                        value={formData.billingName}
                        onChange={(e) => setFormData({ ...formData, billingName: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        placeholder="Ha eltér a cégnévtől"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Cím
                      </label>
                      <input
                        type="text"
                        value={formData.billingAddress}
                        onChange={(e) => setFormData({ ...formData, billingAddress: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Város
                      </label>
                      <input
                        type="text"
                        value={formData.billingCity}
                        onChange={(e) => setFormData({ ...formData, billingCity: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Irányítószám
                      </label>
                      <input
                        type="text"
                        value={formData.billingZipCode}
                        onChange={(e) => setFormData({ ...formData, billingZipCode: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Payment */}
                {formData.billingType === 'CONTRACT' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fizetési határidő (nap)
                    </label>
                    <input
                      type="number"
                      value={formData.paymentDueDays}
                      onChange={(e) => setFormData({ ...formData, paymentDueDays: parseInt(e.target.value) || 8 })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      min={0}
                      max={90}
                    />
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setEditingId(null);
                      setFormData(emptyForm);
                      setTaxNumberWarning(null);
                    }}
                    className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                  >
                    Mégse
                  </button>
                  <button
                    type="submit"
                    disabled={saving || !!taxNumberWarning}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {saving ? 'Mentés...' : editingId ? 'Mentés' : 'Hozzáadás'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Partners List */}
        {loading ? (
          <div className="text-center py-8 text-gray-500">Betöltés...</div>
        ) : partners.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <div className="text-gray-400 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div className="text-lg text-gray-600 font-medium">Nincsenek partnerek</div>
            <div className="text-sm text-gray-400 mt-1 mb-4">
              Adjon hozzá saját szerződéses partnereket a számlázáshoz
            </div>
            <button
              onClick={() => {
                setFormData(emptyForm);
                setEditingId(null);
                setShowForm(true);
              }}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Első partner hozzáadása
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kód</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cégnév</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Adószám</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Típus</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Státusz</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Műveletek</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {partners.map((partner) => (
                  <tr key={partner.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap font-mono text-sm font-medium text-gray-900">
                      {partner.code}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{partner.name}</div>
                      {partner.contactName && (
                        <div className="text-xs text-gray-500">{partner.contactName}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {partner.taxNumber || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        partner.billingType === 'CONTRACT'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {partner.billingType === 'CONTRACT' ? 'Gyűjtőszámla' : 'Azonnali'}
                      </span>
                      {partner.billingCycle && (
                        <span className="ml-1 text-xs text-gray-500">
                          ({partner.billingCycle === 'MONTHLY' ? 'havi' : 'heti'})
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        partner.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {partner.isActive ? 'Aktív' : 'Inaktív'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <button
                        onClick={() => handleEdit(partner)}
                        className="text-green-600 hover:text-green-800 mr-3"
                      >
                        Szerkesztés
                      </button>
                      <button
                        onClick={() => handleDelete(partner.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Törlés
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Info Box */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h3 className="font-semibold text-blue-800 mb-2">Partner kezelés</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>Itt kezelheti a saját szerződéses partnereit, akiknek Ön állít ki számlát</li>
            <li>A Network partnereit nem tudja hozzáadni - ők közvetlenül a Network-kel szerződnek</li>
            <li>Gyűjtőszámlás partnereknél havi vagy heti számlázási ciklust állíthat be</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
