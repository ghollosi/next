'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { networkAdminApi } from '@/lib/network-admin-api';

interface BookingSettings {
  cancellationDeadlineHours: number;
  cancellationFeePercent: number;
  noShowFeePercent: number;
  reminderEnabled: boolean;
  reminderHoursBefore: number[];
  requirePrepaymentOnline: boolean;
  allowPayOnSiteCash: boolean;
  allowPayOnSiteCard: boolean;
  allowOnlineCard: boolean;
  allowApplePay: boolean;
  allowGooglePay: boolean;
  hasStripeAccount: boolean;
  hasSimplePay: boolean;
  hasBarion: boolean;
  cancellationPolicyText?: string;
  confirmationMessage?: string;
}

export default function BookingSettingsPage() {
  const [settings, setSettings] = useState<BookingSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [cancellationDeadlineHours, setCancellationDeadlineHours] = useState(24);
  const [cancellationFeePercent, setCancellationFeePercent] = useState(50);
  const [noShowFeePercent, setNoShowFeePercent] = useState(100);
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderHoursBefore, setReminderHoursBefore] = useState<number[]>([24, 2]);
  const [requirePrepaymentOnline, setRequirePrepaymentOnline] = useState(false);
  const [allowPayOnSiteCash, setAllowPayOnSiteCash] = useState(true);
  const [allowPayOnSiteCard, setAllowPayOnSiteCard] = useState(true);
  const [allowOnlineCard, setAllowOnlineCard] = useState(true);
  const [cancellationPolicyText, setCancellationPolicyText] = useState('');
  const [confirmationMessage, setConfirmationMessage] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      setLoading(true);
      const data = await networkAdminApi.getBookingSettings();
      setSettings(data);

      // Initialize form fields
      setCancellationDeadlineHours(data.cancellationDeadlineHours);
      setCancellationFeePercent(data.cancellationFeePercent);
      setNoShowFeePercent(data.noShowFeePercent);
      setReminderEnabled(data.reminderEnabled);
      setReminderHoursBefore(data.reminderHoursBefore || [24, 2]);
      setRequirePrepaymentOnline(data.requirePrepaymentOnline);
      setAllowPayOnSiteCash(data.allowPayOnSiteCash);
      setAllowPayOnSiteCard(data.allowPayOnSiteCard);
      setAllowOnlineCard(data.allowOnlineCard);
      setCancellationPolicyText(data.cancellationPolicyText || '');
      setConfirmationMessage(data.confirmationMessage || '');
    } catch (err: any) {
      setError(err.message || 'Hiba a beállítások betöltésekor');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      await networkAdminApi.updateBookingSettings({
        cancellationDeadlineHours,
        cancellationFeePercent,
        noShowFeePercent,
        reminderEnabled,
        reminderHoursBefore,
        requirePrepaymentOnline,
        allowPayOnSiteCash,
        allowPayOnSiteCard,
        allowOnlineCard,
        cancellationPolicyText: cancellationPolicyText || undefined,
        confirmationMessage: confirmationMessage || undefined,
      });

      setSuccess('Beállítások sikeresen mentve!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Hiba a mentés során');
    } finally {
      setSaving(false);
    }
  }

  function toggleReminderHour(hour: number) {
    if (reminderHoursBefore.includes(hour)) {
      setReminderHoursBefore(reminderHoursBefore.filter(h => h !== hour));
    } else {
      setReminderHoursBefore([...reminderHoursBefore, hour].sort((a, b) => b - a));
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/network-admin"
          className="text-primary-600 hover:text-primary-700 text-sm font-medium"
        >
          &larr; Vissza
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Foglalási beállítások</h1>
        <p className="text-gray-500 mt-1">Online időpontfoglalás szabályozása</p>
      </div>

      {/* Error / Success messages */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700">
          {success}
        </div>
      )}

      <div className="space-y-6">
        {/* Lemondási szabályzat */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 border-b pb-2 mb-4">
            Lemondási szabályzat
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lemondási határidő (óra)
              </label>
              <input
                type="number"
                min="0"
                max="168"
                value={cancellationDeadlineHours}
                onChange={(e) => setCancellationDeadlineHours(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Ennyi órával a foglalás előtt még díjmentesen lemondható
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Késői lemondási díj (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={cancellationFeePercent}
                onChange={(e) => setCancellationFeePercent(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Késői lemondás esetén felszámított díj
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                No-show díj (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={noShowFeePercent}
                onChange={(e) => setNoShowFeePercent(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Meg nem jelenés esetén felszámított díj
              </p>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lemondási feltételek szövege
            </label>
            <textarea
              rows={3}
              value={cancellationPolicyText}
              onChange={(e) => setCancellationPolicyText(e.target.value)}
              placeholder="Pl.: A foglalás az időpont előtt 24 órával díjmentesen lemondható..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>

        {/* Emlékeztetők */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 border-b pb-2 mb-4">
            Email emlékeztetők
          </h2>

          <div className="flex items-center gap-3 mb-4">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={reminderEnabled}
                onChange={(e) => setReminderEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
            </label>
            <span className="text-sm font-medium text-gray-700">Emlékeztetők küldése</span>
          </div>

          {reminderEnabled && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mikor küldjenek emlékeztetőt?
              </label>
              <div className="flex flex-wrap gap-2">
                {[48, 24, 12, 6, 2, 1].map((hour) => (
                  <button
                    key={hour}
                    type="button"
                    onClick={() => toggleReminderHour(hour)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      reminderHoursBefore.includes(hour)
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {hour} órával előtte
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Fizetési módok */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 border-b pb-2 mb-4">
            Fizetési módok
          </h2>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowPayOnSiteCash}
                  onChange={(e) => setAllowPayOnSiteCash(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
              </label>
              <span className="text-sm font-medium text-gray-700">Készpénzes fizetés helyszínen</span>
            </div>

            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowPayOnSiteCard}
                  onChange={(e) => setAllowPayOnSiteCard(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
              </label>
              <span className="text-sm font-medium text-gray-700">Bankkártyás fizetés helyszínen</span>
            </div>

            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowOnlineCard}
                  onChange={(e) => setAllowOnlineCard(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
              </label>
              <span className="text-sm font-medium text-gray-700">Online bankkártyás fizetés</span>
              {!settings?.hasStripeAccount && !settings?.hasSimplePay && !settings?.hasBarion && (
                <span className="text-xs text-amber-600">(Nincs fizetési szolgáltató beállítva)</span>
              )}
            </div>

            {allowOnlineCard && (
              <div className="ml-8 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3 mb-3">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requirePrepaymentOnline}
                      onChange={(e) => setRequirePrepaymentOnline(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                  <span className="text-sm font-medium text-gray-700">Előleg kötelező online foglaláskor</span>
                </div>
                <p className="text-xs text-gray-500">
                  Ha bekapcsolod, az ügyfélnek előre kell fizetnie az online foglaláshoz.
                </p>
              </div>
            )}
          </div>

          {/* Fizetési szolgáltatók státusza */}
          <div className="mt-6 pt-4 border-t">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Beállított fizetési szolgáltatók:</h3>
            <div className="flex flex-wrap gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                settings?.hasStripeAccount ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
              }`}>
                Stripe {settings?.hasStripeAccount ? '(aktív)' : '(nincs beállítva)'}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                settings?.hasSimplePay ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
              }`}>
                SimplePay {settings?.hasSimplePay ? '(aktív)' : '(nincs beállítva)'}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                settings?.hasBarion ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
              }`}>
                Barion {settings?.hasBarion ? '(aktív)' : '(nincs beállítva)'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              A fizetési szolgáltatók beállításához lépj kapcsolatba a platform üzemeltetőjével.
            </p>
          </div>
        </div>

        {/* Megerősítő üzenet */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 border-b pb-2 mb-4">
            Megerősítő üzenet
          </h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sikeres foglalás utáni üzenet
            </label>
            <textarea
              rows={3}
              value={confirmationMessage}
              onChange={(e) => setConfirmationMessage(e.target.value)}
              placeholder="Pl.: Köszönjük foglalását! Kérjük, érkezzen pontosan a megadott időpontra..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>

        {/* Save button */}
        <div className="flex justify-end gap-3">
          <Link
            href="/network-admin"
            className="px-6 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            Mégse
          </Link>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Mentés...' : 'Mentés'}
          </button>
        </div>
      </div>
    </div>
  );
}
