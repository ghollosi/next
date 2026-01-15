'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetchOperatorApi } from '@/lib/network-admin-api';

interface Driver {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  isActive: boolean;
  approvalStatus: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  partnerCompany?: {
    id: string;
    code: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface PartnerCompany {
  id: string;
  code: string;
  name: string;
}

export default function DriverDetailPage() {
  const params = useParams();
  const router = useRouter();
  const driverId = params.id as string;

  const [driver, setDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [partners, setPartners] = useState<PartnerCompany[]>([]);

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    partnerCompanyId: '',
    isActive: true,
  });

  useEffect(() => {
    loadDriver();
    loadPartners();
  }, [driverId]);

  const loadDriver = async () => {
    try {
      const data = await fetchOperatorApi<Driver>(`/operator/drivers/${driverId}`);
      setDriver(data);
      setForm({
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone || '',
        email: data.email || '',
        partnerCompanyId: data.partnerCompany?.id || '',
        isActive: data.isActive,
      });
    } catch (err: any) {
      setError(err.message || 'Hiba a sofőr betöltésekor');
    } finally {
      setLoading(false);
    }
  };

  const loadPartners = async () => {
    try {
      const data = await fetchOperatorApi<PartnerCompany[]>('/operator/partner-companies');
      setPartners(data);
    } catch (err) {
      console.error('Failed to load partners:', err);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccessMessage('');

    try {
      await fetchOperatorApi(`/operator/drivers/${driverId}`, {
        method: 'PUT',
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          phone: form.phone || undefined,
          email: form.email || undefined,
          partnerCompanyId: form.partnerCompanyId || undefined,
          isActive: form.isActive,
        }),
      });
      setSuccessMessage('Sofőr sikeresen frissítve!');
      setEditing(false);
      loadDriver();
    } catch (err: any) {
      setError(err.message || 'Hiba a mentés során');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Biztosan törölni szeretnéd ezt a sofőrt?')) return;

    try {
      await fetchOperatorApi(`/operator/drivers/${driverId}`, {
        method: 'DELETE',
      });
      router.push('/network-admin/drivers');
    } catch (err: any) {
      setError(err.message || 'Hiba a törlés során');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Betöltés...</div>
      </div>
    );
  }

  if (!driver) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-600 mb-4">Sofőr nem található</p>
          <Link
            href="/network-admin/drivers"
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            Vissza a listához
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/network-admin/drivers"
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">
            {driver.lastName} {driver.firstName}
          </h1>
          <p className="text-gray-500">Sofőr adatai</p>
        </div>
        <div className="flex gap-2">
          {!editing ? (
            <>
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
              >
                Szerkesztés
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-100 text-red-600 font-medium rounded-lg hover:bg-red-200 transition-colors"
              >
                Törlés
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                Mégse
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Mentés...' : 'Mentés'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-green-600">
          {successMessage}
        </div>
      )}

      {/* Driver Info Card */}
      <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
        {/* Status badges */}
        <div className="flex gap-2 flex-wrap">
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              driver.isActive
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {driver.isActive ? 'Aktív' : 'Inaktív'}
          </span>
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              driver.approvalStatus === 'APPROVED'
                ? 'bg-green-100 text-green-700'
                : driver.approvalStatus === 'PENDING'
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-red-100 text-red-700'
            }`}
          >
            {driver.approvalStatus === 'APPROVED'
              ? 'Jóváhagyva'
              : driver.approvalStatus === 'PENDING'
              ? 'Jóváhagyásra vár'
              : 'Elutasítva'}
          </span>
          {driver.emailVerified && (
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
              Email ellenőrizve
            </span>
          )}
        </div>

        {/* Form/Display fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* First Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vezetéknév
            </label>
            {editing ? (
              <input
                type="text"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-primary-500 focus:ring-0 focus:outline-none"
              />
            ) : (
              <p className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900">
                {driver.lastName}
              </p>
            )}
          </div>

          {/* Last Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Keresztnév
            </label>
            {editing ? (
              <input
                type="text"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-primary-500 focus:ring-0 focus:outline-none"
              />
            ) : (
              <p className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900">
                {driver.firstName}
              </p>
            )}
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Telefon
            </label>
            {editing ? (
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-primary-500 focus:ring-0 focus:outline-none"
              />
            ) : (
              <p className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900">
                {driver.phone || '-'}
              </p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            {editing ? (
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-primary-500 focus:ring-0 focus:outline-none"
              />
            ) : (
              <p className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900">
                {driver.email || '-'}
              </p>
            )}
          </div>

          {/* Partner Company */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Partner cég
            </label>
            {editing ? (
              <select
                value={form.partnerCompanyId}
                onChange={(e) => setForm({ ...form, partnerCompanyId: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-primary-500 focus:ring-0 focus:outline-none"
              >
                <option value="">Nincs hozzárendelve</option>
                {partners.map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {partner.name} ({partner.code})
                  </option>
                ))}
              </select>
            ) : (
              <p className="px-4 py-3 bg-gray-50 rounded-lg text-gray-900">
                {driver.partnerCompany ? (
                  <Link
                    href={`/network-admin/partners/${driver.partnerCompany.id}`}
                    className="text-primary-600 hover:text-primary-700"
                  >
                    {driver.partnerCompany.name} ({driver.partnerCompany.code})
                  </Link>
                ) : (
                  '-'
                )}
              </p>
            )}
          </div>

          {/* Active Status */}
          {editing && (
            <div className="md:col-span-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Aktív sofőr
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Timestamps */}
        <div className="pt-4 border-t border-gray-100 grid grid-cols-2 gap-4 text-sm text-gray-500">
          <div>
            <span className="font-medium">Létrehozva:</span>{' '}
            {new Date(driver.createdAt).toLocaleString('hu-HU')}
          </div>
          <div>
            <span className="font-medium">Módosítva:</span>{' '}
            {new Date(driver.updatedAt).toLocaleString('hu-HU')}
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 rounded-xl p-4">
        <p className="text-sm text-blue-700">
          <strong>Megjegyzés:</strong> A sofőr meghívó QR kódját a sofőrök listában a
          &quot;Meghívó&quot; gombra kattintva tudod generálni.
        </p>
      </div>
    </div>
  );
}
