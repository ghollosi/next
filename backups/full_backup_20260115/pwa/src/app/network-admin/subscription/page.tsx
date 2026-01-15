'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { networkAdminApi } from '@/lib/network-admin-api';

interface SubscriptionData {
  status: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd: boolean;
  trialEnd?: string | null;
  baseMonthlyFee?: number;
  perWashFee?: number;
  currentUsage?: number;
  hasPaymentMethod: boolean;
}

export default function SubscriptionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [stripeConfigured, setStripeConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    loadData();

    // Check URL params for success/cancel messages
    if (searchParams.get('success') === 'true') {
      setSuccessMessage('Sikeres fizetési mód beállítás! Az előfizetés aktiválva.');
    }
    if (searchParams.get('canceled') === 'true') {
      setError('A checkout folyamat megszakadt.');
    }
  }, [searchParams]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [subData, configData] = await Promise.all([
        networkAdminApi.getSubscription(),
        networkAdminApi.isStripeConfigured(),
      ]);
      setSubscription(subData);
      setStripeConfigured(configData.configured);
    } catch (err: any) {
      setError(err.message || 'Hiba történt az adatok betöltésekor');
    } finally {
      setLoading(false);
    }
  };

  const handleStartSubscription = async () => {
    try {
      setActionLoading(true);
      setError(null);
      const { url } = await networkAdminApi.createCheckoutSession({
        successUrl: `${window.location.origin}/network-admin/subscription?success=true`,
        cancelUrl: `${window.location.origin}/network-admin/subscription?canceled=true`,
      });
      window.location.href = url;
    } catch (err: any) {
      setError(err.message || 'Hiba történt a checkout indításakor');
      setActionLoading(false);
    }
  };

  const handleManageBilling = async () => {
    try {
      setActionLoading(true);
      setError(null);
      const { url } = await networkAdminApi.createBillingPortal({
        returnUrl: window.location.href,
      });
      window.location.href = url;
    } catch (err: any) {
      setError(err.message || 'Hiba történt a számlázási portál megnyitásakor');
      setActionLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Biztosan le szeretnéd mondani az előfizetést? A jelenlegi számlázási időszak végén megszűnik.')) {
      return;
    }

    try {
      setActionLoading(true);
      setError(null);
      await networkAdminApi.cancelSubscription();
      setSuccessMessage('Az előfizetés a jelenlegi időszak végén megszűnik.');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Hiba történt a lemondáskor');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivateSubscription = async () => {
    try {
      setActionLoading(true);
      setError(null);
      await networkAdminApi.reactivateSubscription();
      setSuccessMessage('Az előfizetés újra aktív!');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Hiba történt az újraaktiválásnál');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { text: string; className: string }> = {
      TRIAL: { text: 'Próbaidő', className: 'bg-blue-100 text-blue-800' },
      trialing: { text: 'Próbaidő', className: 'bg-blue-100 text-blue-800' },
      ACTIVE: { text: 'Aktív', className: 'bg-green-100 text-green-800' },
      active: { text: 'Aktív', className: 'bg-green-100 text-green-800' },
      SUSPENDED: { text: 'Felfüggesztve', className: 'bg-yellow-100 text-yellow-800' },
      past_due: { text: 'Lejárt fizetés', className: 'bg-yellow-100 text-yellow-800' },
      CANCELLED: { text: 'Lemondva', className: 'bg-red-100 text-red-800' },
      canceled: { text: 'Lemondva', className: 'bg-red-100 text-red-800' },
    };

    const config = statusConfig[status] || { text: status, className: 'bg-gray-100 text-gray-800' };
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${config.className}`}>
        {config.text}
      </span>
    );
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('hu-HU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hu-HU', {
      style: 'currency',
      currency: 'HUF',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Előfizetés</h1>
          <p className="text-gray-500">Előfizetés és számlázás kezelése</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {successMessage}
        </div>
      )}

      {!stripeConfigured && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg">
          <p className="font-medium">Stripe nincs konfigurálva</p>
          <p className="text-sm">A számlázási rendszer használatához a Platform Adminnak be kell állítania a Stripe integrációt.</p>
        </div>
      )}

      {subscription && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Subscription Status Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Előfizetés állapota</h2>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Státusz</span>
                {getStatusBadge(subscription.status)}
              </div>

              {subscription.trialEnd && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Próbaidő vége</span>
                  <span className="font-medium">{formatDate(subscription.trialEnd)}</span>
                </div>
              )}

              {subscription.currentPeriodStart && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Jelenlegi időszak</span>
                  <span className="font-medium">
                    {formatDate(subscription.currentPeriodStart)} - {formatDate(subscription.currentPeriodEnd!)}
                  </span>
                </div>
              )}

              {subscription.cancelAtPeriodEnd && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                  Az előfizetés a jelenlegi időszak végén megszűnik.
                </div>
              )}

              <div className="flex justify-between items-center">
                <span className="text-gray-500">Fizetési mód</span>
                <span className={subscription.hasPaymentMethod ? 'text-green-600' : 'text-red-600'}>
                  {subscription.hasPaymentMethod ? '✓ Beállítva' : '✗ Nincs beállítva'}
                </span>
              </div>
            </div>
          </div>

          {/* Pricing Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Árazás</h2>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Havi alap díj</span>
                <span className="font-medium">{formatCurrency(subscription.baseMonthlyFee || 0)}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-500">Mosásonkénti díj</span>
                <span className="font-medium">{formatCurrency(subscription.perWashFee || 0)}</span>
              </div>

              {subscription.currentUsage !== undefined && (
                <>
                  <hr />
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Mosások ebben a hónapban</span>
                    <span className="font-medium">{subscription.currentUsage} db</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Becsült használati díj</span>
                    <span className="font-medium">
                      {formatCurrency(subscription.currentUsage * (subscription.perWashFee || 0))}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Műveletek</h2>

        <div className="flex flex-wrap gap-4">
          {/* Show Start Subscription if no payment method */}
          {stripeConfigured && subscription && !subscription.hasPaymentMethod && (
            <button
              onClick={handleStartSubscription}
              disabled={actionLoading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {actionLoading ? 'Betöltés...' : 'Fizetési mód beállítása'}
            </button>
          )}

          {/* Manage Billing button */}
          {stripeConfigured && subscription?.hasPaymentMethod && (
            <button
              onClick={handleManageBilling}
              disabled={actionLoading}
              className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {actionLoading ? 'Betöltés...' : 'Számlázás kezelése'}
            </button>
          )}

          {/* Cancel/Reactivate buttons */}
          {subscription?.hasPaymentMethod && !subscription.cancelAtPeriodEnd &&
           subscription.status !== 'CANCELLED' && subscription.status !== 'canceled' && (
            <button
              onClick={handleCancelSubscription}
              disabled={actionLoading}
              className="px-6 py-3 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              Előfizetés lemondása
            </button>
          )}

          {subscription?.cancelAtPeriodEnd && (
            <button
              onClick={handleReactivateSubscription}
              disabled={actionLoading}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              Előfizetés újraaktiválása
            </button>
          )}
        </div>
      </div>

      {/* Info Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-2">Hogyan működik a számlázás?</h3>
        <ul className="text-blue-800 text-sm space-y-1 list-disc list-inside">
          <li>A havi alap díjat minden hónap elején automatikusan levonjuk</li>
          <li>A mosásonkénti díjakat a hónap végén összesítjük és számlázzuk</li>
          <li>A próbaidő alatt nem terhelünk semmilyen díjat</li>
          <li>Bármikor lemondhatod az előfizetést, ami a számlázási időszak végén lép életbe</li>
        </ul>
      </div>
    </div>
  );
}
