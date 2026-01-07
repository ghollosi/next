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
  paymentDueDays?: number;
  // SAJÁT hálózat kedvezmények
  ownDiscountThreshold1?: number | null;
  ownDiscountPercent1?: number | null;
  ownDiscountThreshold2?: number | null;
  ownDiscountPercent2?: number | null;
  ownDiscountThreshold3?: number | null;
  ownDiscountPercent3?: number | null;
  ownDiscountThreshold4?: number | null;
  ownDiscountPercent4?: number | null;
  ownDiscountThreshold5?: number | null;
  ownDiscountPercent5?: number | null;
  // ALVÁLLALKOZÓI hálózat kedvezmények
  subDiscountThreshold1?: number | null;
  subDiscountPercent1?: number | null;
  subDiscountThreshold2?: number | null;
  subDiscountPercent2?: number | null;
  subDiscountThreshold3?: number | null;
  subDiscountPercent3?: number | null;
  subDiscountThreshold4?: number | null;
  subDiscountPercent4?: number | null;
  subDiscountThreshold5?: number | null;
  subDiscountPercent5?: number | null;
  createdAt: string;
  updatedAt: string;
}

interface RegistrationQRData {
  partnerCompanyId: string;
  partnerCompanyCode: string;
  partnerCompanyName: string;
  networkSlug: string;
  networkName: string;
  registerUrl: string;
  qrCodeDataUrl: string;
  size: number;
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
  const [qrData, setQrData] = useState<RegistrationQRData | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  useEffect(() => {
    loadPartner();
  }, [params.id]);

  useEffect(() => {
    if (partner) {
      loadQRCode();
    }
  }, [partner?.id]);

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

  const loadQRCode = async () => {
    setLoadingQr(true);
    try {
      const response = await fetch(
        `${API_URL}/operator/partner-companies/${params.id}/registration-qr-data?size=300`,
        { headers: { 'x-network-id': NETWORK_ID } }
      );

      if (response.ok) {
        const data = await response.json();
        setQrData(data);
      }
    } catch (err) {
      console.error('Failed to load QR code:', err);
    } finally {
      setLoadingQr(false);
    }
  };

  const downloadQRCode = async (format: 'png' | 'svg') => {
    if (!partner) return;
    try {
      const response = await fetch(
        `${API_URL}/operator/partner-companies/${params.id}/registration-qr-code?format=${format}&size=600`,
        { headers: { 'x-network-id': NETWORK_ID } }
      );

      if (!response.ok) throw new Error('Letöltés sikertelen');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `registration-qr-${partner.code}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'Hiba történt');
    }
  };

  const copyRegisterUrl = () => {
    if (qrData?.registerUrl) {
      navigator.clipboard.writeText(qrData.registerUrl);
      alert('Link kimásolva a vágólapra!');
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
          <div>
            <dt className="text-sm text-gray-500">Fizetési határidő</dt>
            <dd className="text-gray-900">{partner.paymentDueDays ?? 8} nap</dd>
          </div>
        </dl>
      </div>

      {/* OWN Network Discounts */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
        <h2 className="text-lg font-semibold text-gray-900 border-b pb-2 mb-4">
          Kedvezmények - Saját hálózat
        </h2>
        {(() => {
          const ownDiscounts = [
            { threshold: partner.ownDiscountThreshold1, percent: partner.ownDiscountPercent1 },
            { threshold: partner.ownDiscountThreshold2, percent: partner.ownDiscountPercent2 },
            { threshold: partner.ownDiscountThreshold3, percent: partner.ownDiscountPercent3 },
            { threshold: partner.ownDiscountThreshold4, percent: partner.ownDiscountPercent4 },
            { threshold: partner.ownDiscountThreshold5, percent: partner.ownDiscountPercent5 },
          ].filter(d => d.threshold != null && d.percent != null);

          if (ownDiscounts.length === 0) {
            return <p className="text-gray-500 text-sm">Nincs beállított kedvezmény</p>;
          }

          return (
            <div className="space-y-2">
              {ownDiscounts.map((d, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="text-gray-600">{i + 1}. szint:</span>
                  <span className="font-medium text-gray-900">{d.threshold} mosás/hó felett</span>
                  <span className="text-primary-600 font-semibold">{d.percent}%</span>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* SUBCONTRACTOR Network Discounts */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
        <h2 className="text-lg font-semibold text-gray-900 border-b pb-2 mb-4">
          Kedvezmények - Alvállalkozói hálózat
        </h2>
        {(() => {
          const subDiscounts = [
            { threshold: partner.subDiscountThreshold1, percent: partner.subDiscountPercent1 },
            { threshold: partner.subDiscountThreshold2, percent: partner.subDiscountPercent2 },
            { threshold: partner.subDiscountThreshold3, percent: partner.subDiscountPercent3 },
            { threshold: partner.subDiscountThreshold4, percent: partner.subDiscountPercent4 },
            { threshold: partner.subDiscountThreshold5, percent: partner.subDiscountPercent5 },
          ].filter(d => d.threshold != null && d.percent != null);

          if (subDiscounts.length === 0) {
            return <p className="text-gray-500 text-sm">Nincs beállított kedvezmény</p>;
          }

          return (
            <div className="space-y-2">
              {subDiscounts.map((d, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="text-gray-600">{i + 1}. szint:</span>
                  <span className="font-medium text-gray-900">{d.threshold} mosás/hó felett</span>
                  <span className="text-orange-600 font-semibold">{d.percent}%</span>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* Registration QR Code */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
        <h2 className="text-lg font-semibold text-gray-900 border-b pb-2 mb-4">
          Sofőr regisztrációs QR kód
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Ezzel a QR kóddal a sofőrök közvetlenül ehhez a partner céghez tudnak regisztrálni.
          Nyomtasd ki és helyezd el a cég irodájában vagy küldd el a sofőröknek.
        </p>

        {loadingQr ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
            <p className="text-gray-500 mt-2 text-sm">QR kód betöltése...</p>
          </div>
        ) : qrData ? (
          <div className="flex flex-col md:flex-row gap-6 items-start">
            {/* QR Code Preview */}
            <div className="flex-shrink-0">
              <button
                onClick={() => setShowQrModal(true)}
                className="block border-2 border-gray-200 rounded-xl p-2 hover:border-primary-500 transition-colors"
              >
                <img
                  src={qrData.qrCodeDataUrl}
                  alt="Regisztrációs QR kód"
                  className="w-40 h-40"
                />
              </button>
              <p className="text-xs text-gray-500 text-center mt-2">
                Kattints a nagyításhoz
              </p>
            </div>

            {/* QR Info and Actions */}
            <div className="flex-1 space-y-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 mb-1">Regisztrációs link:</p>
                <div className="flex items-center gap-2">
                  <code className="text-xs text-gray-700 break-all flex-1">
                    {qrData.registerUrl}
                  </code>
                  <button
                    onClick={copyRegisterUrl}
                    className="p-1 text-gray-500 hover:text-primary-600"
                    title="Link másolása"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => downloadQRCode('png')}
                  className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Letöltés PNG
                </button>
                <button
                  onClick={() => downloadQRCode('svg')}
                  className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Letöltés SVG
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>Nem sikerült betölteni a QR kódot</p>
            <button
              onClick={loadQRCode}
              className="mt-2 text-primary-600 hover:text-primary-700 text-sm font-medium"
            >
              Újrapróbálás
            </button>
          </div>
        )}
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

      {/* QR Code Modal */}
      {showQrModal && qrData && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowQrModal(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Regisztrációs QR kód</h3>
              <button
                onClick={() => setShowQrModal(false)}
                className="p-1 text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="text-center">
              <img
                src={qrData.qrCodeDataUrl}
                alt="Regisztrációs QR kód"
                className="w-64 h-64 mx-auto"
              />
              <p className="mt-4 font-semibold text-gray-900">{partner.name}</p>
              <p className="text-sm text-gray-500">{partner.code}</p>
            </div>

            <div className="mt-6 flex gap-2">
              <button
                onClick={() => downloadQRCode('png')}
                className="flex-1 px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
              >
                Letöltés PNG
              </button>
              <button
                onClick={() => downloadQRCode('svg')}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                Letöltés SVG
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
