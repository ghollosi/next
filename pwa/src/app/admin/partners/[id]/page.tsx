'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface PartnerCompany {
  id: string;
  code: string;
  name: string;
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
  billingCountry?: string;
  taxNumber?: string;
  euVatNumber?: string;
  createdAt: string;
  updatedAt: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const NETWORK_ID = 'cf808392-6283-4487-9fbd-e72951ca5bf8';

export default function PartnerDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [partner, setPartner] = useState<PartnerCompany | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadPartner();
  }, [params.id]);

  const loadPartner = async () => {
    try {
      const response = await fetch(`${API_URL}/operator/partner-companies/${params.id}`, {
        headers: { 'x-network-id': NETWORK_ID },
      });

      if (response.ok) {
        const data = await response.json();
        setPartner(data);
      } else {
        throw new Error('Nem sikerült betölteni a partnert');
      }
    } catch (err: any) {
      setError(err.message || 'Hiba történt');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Biztosan törölni szeretnéd ezt a partnert?')) return;

    setDeleting(true);
    try {
      const response = await fetch(`${API_URL}/operator/partner-companies/${params.id}`, {
        method: 'DELETE',
        headers: { 'x-network-id': NETWORK_ID },
      });

      if (response.ok) {
        router.push('/admin/partners');
      } else {
        throw new Error('Nem sikerült törölni a partnert');
      }
    } catch (err: any) {
      setError(err.message || 'Hiba történt');
      setDeleting(false);
    }
  };

  const handleToggleActive = async () => {
    if (!partner) return;

    try {
      const response = await fetch(`${API_URL}/operator/partner-companies/${params.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-network-id': NETWORK_ID,
        },
        body: JSON.stringify({ isActive: !partner.isActive }),
      });

      if (response.ok) {
        setPartner({ ...partner, isActive: !partner.isActive });
      } else {
        throw new Error('Nem sikerült módosítani a státuszt');
      }
    } catch (err: any) {
      setError(err.message || 'Hiba történt');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-500">Betöltés...</p>
      </div>
    );
  }

  if (error || !partner) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-600 mb-4">{error || 'Partner nem található'}</p>
          <Link
            href="/admin/partners"
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            Vissza a partnerekhez
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/admin/partners"
          className="text-primary-600 hover:text-primary-700 text-sm font-medium"
        >
          &larr; Vissza a partnerekhez
        </Link>
        <div className="flex items-center justify-between mt-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{partner.name}</h1>
            <p className="text-gray-500 font-mono">{partner.code}</p>
          </div>
          <span
            className={`px-3 py-1 text-sm font-medium rounded-full ${
              partner.isActive
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            {partner.isActive ? 'Aktív' : 'Inaktív'}
          </span>
        </div>
      </div>

      {/* Basic Info */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
        <h2 className="text-lg font-semibold text-gray-900 border-b pb-2 mb-4">
          Alapadatok
        </h2>
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-sm text-gray-500">Kapcsolattartó</dt>
            <dd className="text-gray-900">{partner.contactName || '-'}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Email</dt>
            <dd className="text-gray-900">
              {partner.email ? (
                <a href={`mailto:${partner.email}`} className="text-primary-600 hover:underline">
                  {partner.email}
                </a>
              ) : (
                '-'
              )}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Telefon</dt>
            <dd className="text-gray-900">
              {partner.phone ? (
                <a href={`tel:${partner.phone}`} className="text-primary-600 hover:underline">
                  {partner.phone}
                </a>
              ) : (
                '-'
              )}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Létrehozva</dt>
            <dd className="text-gray-900">
              {new Date(partner.createdAt).toLocaleDateString('hu-HU')}
            </dd>
          </div>
        </dl>
      </div>

      {/* Billing Type */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
        <h2 className="text-lg font-semibold text-gray-900 border-b pb-2 mb-4">
          Számlázási típus
        </h2>
        <div className="flex items-center gap-4">
          <div
            className={`flex-1 px-4 py-4 border-2 rounded-xl text-center ${
              partner.billingType === 'CONTRACT'
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200'
            }`}
          >
            <div className="text-2xl mb-1">📄</div>
            <p className="font-semibold text-gray-900">Szerződéses</p>
            <p className="text-sm text-gray-500">Gyűjtőszámlázás</p>
          </div>
          <div
            className={`flex-1 px-4 py-4 border-2 rounded-xl text-center ${
              partner.billingType === 'CASH'
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200'
            }`}
          >
            <div className="text-2xl mb-1">💵</div>
            <p className="font-semibold text-gray-900">Készpénzes</p>
            <p className="text-sm text-gray-500">Helyben számlázás</p>
          </div>
        </div>

        {partner.billingType === 'CONTRACT' && partner.billingCycle && (
          <div className="mt-4 p-4 bg-gray-50 rounded-xl">
            <p className="text-sm text-gray-600">
              <strong>Számlázási ciklus:</strong>{' '}
              {partner.billingCycle === 'MONTHLY' ? 'Havi' : 'Heti'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {partner.billingCycle === 'MONTHLY'
                ? 'A számla minden hónap végén kerül kiállításra.'
                : 'A számla minden hét végén kerül kiállításra.'}
            </p>
          </div>
        )}
      </div>

      {/* Billing Info */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
        <h2 className="text-lg font-semibold text-gray-900 border-b pb-2 mb-4">
          Számlázási adatok
        </h2>
        <dl className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <dt className="text-sm text-gray-500">Számlázási név</dt>
            <dd className="text-gray-900">{partner.billingName || partner.name}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-sm text-gray-500">Cím</dt>
            <dd className="text-gray-900">
              {partner.billingAddress ? (
                <>
                  {partner.billingZipCode} {partner.billingCity}, {partner.billingAddress}
                  {partner.billingCountry && partner.billingCountry !== 'HU' && (
                    <span className="text-gray-500"> ({partner.billingCountry})</span>
                  )}
                </>
              ) : (
                '-'
              )}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Adószám</dt>
            <dd className="text-gray-900 font-mono">{partner.taxNumber || '-'}</dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">EU adószám</dt>
            <dd className="text-gray-900 font-mono">{partner.euVatNumber || '-'}</dd>
          </div>
        </dl>
      </div>

      {/* Actions */}
      <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">
          Műveletek
        </h2>

        <div className="flex flex-wrap gap-3">
          <Link
            href={`/admin/partners/${partner.id}/edit`}
            className="px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
          >
            Szerkesztés
          </Link>

          <button
            onClick={handleToggleActive}
            className={`px-4 py-2 font-medium rounded-lg transition-colors ${
              partner.isActive
                ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                : 'bg-green-100 text-green-700 hover:bg-green-200'
            }`}
          >
            {partner.isActive ? 'Deaktiválás' : 'Aktiválás'}
          </button>

          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-4 py-2 bg-red-100 text-red-700 font-medium rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50"
          >
            {deleting ? 'Törlés...' : 'Törlés'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
