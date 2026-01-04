'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface PartnerCompany {
  id: string;
  code: string;
  name: string;
}

interface Driver {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  isActive: boolean;
  partnerCompany?: PartnerCompany;
  createdAt: string;
  updatedAt: string;
}

interface DriverInvite {
  id: string;
  inviteCode: string;
  status: 'PENDING' | 'ACTIVATED' | 'EXPIRED' | 'REVOKED';
  expiresAt: string;
  activatedAt?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const NETWORK_ID = 'cf808392-6283-4487-9fbd-e72951ca5bf8';

export default function DriverDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [driver, setDriver] = useState<Driver | null>(null);
  const [invite, setInvite] = useState<DriverInvite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    loadDriver();
  }, [params.id]);

  const loadDriver = async () => {
    try {
      const [driverRes, inviteRes] = await Promise.all([
        fetch(`${API_URL}/operator/drivers/${params.id}`, {
          headers: { 'x-network-id': NETWORK_ID },
        }),
        fetch(`${API_URL}/operator/drivers/${params.id}/invite`, {
          headers: { 'x-network-id': NETWORK_ID },
        }),
      ]);

      if (driverRes.ok) {
        const driverData = await driverRes.json();
        setDriver(driverData);
      } else {
        throw new Error('Nem sikerült betölteni a sofőrt');
      }

      if (inviteRes.ok) {
        const inviteData = await inviteRes.json();
        setInvite(inviteData);
      }
    } catch (err: any) {
      setError(err.message || 'Hiba történt');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Biztosan törölni szeretnéd ezt a sofőrt?')) return;

    setDeleting(true);
    try {
      const response = await fetch(`${API_URL}/operator/drivers/${params.id}`, {
        method: 'DELETE',
        headers: { 'x-network-id': NETWORK_ID },
      });

      if (response.ok) {
        router.push('/admin/drivers');
      } else {
        throw new Error('Nem sikerült törölni a sofőrt');
      }
    } catch (err: any) {
      setError(err.message || 'Hiba történt');
      setDeleting(false);
    }
  };

  const handleToggleActive = async () => {
    if (!driver) return;

    try {
      const response = await fetch(`${API_URL}/operator/drivers/${params.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-network-id': NETWORK_ID,
        },
        body: JSON.stringify({ isActive: !driver.isActive }),
      });

      if (response.ok) {
        setDriver({ ...driver, isActive: !driver.isActive });
      } else {
        throw new Error('Nem sikerült módosítani a státuszt');
      }
    } catch (err: any) {
      setError(err.message || 'Hiba történt');
    }
  };

  const handleRegenerateInvite = async () => {
    if (!confirm('Biztosan új meghívó kódot szeretnél generálni? A régi kód érvénytelenné válik.')) return;

    setRegenerating(true);
    try {
      const response = await fetch(`${API_URL}/operator/drivers/${params.id}/regenerate-invite`, {
        method: 'POST',
        headers: { 'x-network-id': NETWORK_ID },
      });

      if (response.ok) {
        const newInvite = await response.json();
        setInvite(newInvite);
      } else {
        throw new Error('Nem sikerült új kódot generálni');
      }
    } catch (err: any) {
      setError(err.message || 'Hiba történt');
    } finally {
      setRegenerating(false);
    }
  };

  const getInviteStatusLabel = (status: string) => {
    switch (status) {
      case 'PENDING':
        return { text: 'Várakozik', class: 'bg-yellow-100 text-yellow-700' };
      case 'ACTIVATED':
        return { text: 'Aktivált', class: 'bg-green-100 text-green-700' };
      case 'EXPIRED':
        return { text: 'Lejárt', class: 'bg-gray-100 text-gray-700' };
      case 'REVOKED':
        return { text: 'Visszavonva', class: 'bg-red-100 text-red-700' };
      default:
        return { text: status, class: 'bg-gray-100 text-gray-700' };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-500">Betöltés...</p>
      </div>
    );
  }

  if (error || !driver) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-600 mb-4">{error || 'Sofőr nem található'}</p>
          <Link
            href="/admin/drivers"
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            Vissza a sofőrökhöz
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
          href="/admin/drivers"
          className="text-primary-600 hover:text-primary-700 text-sm font-medium"
        >
          &larr; Vissza a sofőrökhöz
        </Link>
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 font-bold text-xl">
              {driver.firstName.charAt(0)}{driver.lastName.charAt(0)}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {driver.lastName} {driver.firstName}
              </h1>
              <p className="text-gray-500">
                {driver.partnerCompany?.name || 'Nincs cég'}
              </p>
            </div>
          </div>
          <span
            className={`px-3 py-1 text-sm font-medium rounded-full ${
              driver.isActive
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            {driver.isActive ? 'Aktív' : 'Inaktív'}
          </span>
        </div>
      </div>

      {/* Invite Code Card */}
      {invite && (
        <div className="bg-primary-50 rounded-xl shadow-sm p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-primary-900">
              Meghívó kód
            </h2>
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getInviteStatusLabel(invite.status).class}`}>
              {getInviteStatusLabel(invite.status).text}
            </span>
          </div>

          <div className="text-center py-4">
            <p className="text-4xl font-mono font-bold text-primary-600 tracking-wider mb-2">
              {invite.inviteCode}
            </p>
            <p className="text-sm text-primary-700">
              {invite.status === 'ACTIVATED'
                ? `Aktiválva: ${new Date(invite.activatedAt!).toLocaleDateString('hu-HU')}`
                : `Lejár: ${new Date(invite.expiresAt).toLocaleDateString('hu-HU')}`}
            </p>
          </div>

          <button
            onClick={handleRegenerateInvite}
            disabled={regenerating}
            className="w-full py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {regenerating ? 'Generálás...' : 'Új kód generálása'}
          </button>
        </div>
      )}

      {/* Basic Info */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-4">
        <h2 className="text-lg font-semibold text-gray-900 border-b pb-2 mb-4">
          Elérhetőségek
        </h2>
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-sm text-gray-500">Telefon</dt>
            <dd className="text-gray-900">
              {driver.phone ? (
                <a href={`tel:${driver.phone}`} className="text-primary-600 hover:underline">
                  {driver.phone}
                </a>
              ) : (
                '-'
              )}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Email</dt>
            <dd className="text-gray-900">
              {driver.email ? (
                <a href={`mailto:${driver.email}`} className="text-primary-600 hover:underline">
                  {driver.email}
                </a>
              ) : (
                '-'
              )}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Partner cég</dt>
            <dd className="text-gray-900">
              {driver.partnerCompany ? (
                <Link
                  href={`/admin/partners/${driver.partnerCompany.id}`}
                  className="text-primary-600 hover:underline"
                >
                  {driver.partnerCompany.name}
                </Link>
              ) : (
                '-'
              )}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Regisztrálva</dt>
            <dd className="text-gray-900">
              {new Date(driver.createdAt).toLocaleDateString('hu-HU')}
            </dd>
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
            href={`/admin/drivers/${driver.id}/edit`}
            className="px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
          >
            Szerkesztés
          </Link>

          <button
            onClick={handleToggleActive}
            className={`px-4 py-2 font-medium rounded-lg transition-colors ${
              driver.isActive
                ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                : 'bg-green-100 text-green-700 hover:bg-green-200'
            }`}
          >
            {driver.isActive ? 'Deaktiválás' : 'Aktiválás'}
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
