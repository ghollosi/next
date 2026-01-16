'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSession, getDriver, clearSession, saveSession, DriverInfo } from '@/lib/session';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export default function SettingsPage() {
  const router = useRouter();
  const [driver, setDriver] = useState<DriverInfo | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Detach from partner state
  const [showDetachModal, setShowDetachModal] = useState(false);
  const [detaching, setDetaching] = useState(false);
  const [pin, setPin] = useState('');

  // Billing info state (for private customers)
  const [editingBilling, setEditingBilling] = useState(false);
  const [savingBilling, setSavingBilling] = useState(false);
  const [billingName, setBillingName] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [billingCity, setBillingCity] = useState('');
  const [billingZipCode, setBillingZipCode] = useState('');
  const [billingCountry, setBillingCountry] = useState('HU');
  const [billingTaxNumber, setBillingTaxNumber] = useState('');

  useEffect(() => {
    const session = getSession();
    const driverInfo = getDriver();

    if (!session || !driverInfo) {
      router.replace('/login');
      return;
    }

    setSessionId(session);
    setDriver(driverInfo);

    // Set billing info from driver
    if (driverInfo.billingName) setBillingName(driverInfo.billingName);
    if (driverInfo.billingAddress) setBillingAddress(driverInfo.billingAddress);
    if (driverInfo.billingCity) setBillingCity(driverInfo.billingCity);
    if (driverInfo.billingZipCode) setBillingZipCode(driverInfo.billingZipCode);
    if (driverInfo.billingCountry) setBillingCountry(driverInfo.billingCountry);
    if (driverInfo.billingTaxNumber) setBillingTaxNumber(driverInfo.billingTaxNumber);

    setLoading(false);
  }, [router]);

  const handleDetachFromPartner = async () => {
    if (pin.length !== 4) {
      setError('Add meg a PIN kodod!');
      return;
    }

    setDetaching(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/pwa/detach-from-partner`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionId}`,
        },
        body: JSON.stringify({
          driverId: driver!.driverId,
          pin,
          // Billing info required when detaching
          billingName,
          billingAddress,
          billingCity,
          billingZipCode,
          billingCountry,
          billingTaxNumber: billingTaxNumber || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Hiba tortent');
      }

      const result = await response.json();

      // Update session with new driver info
      const updatedDriver: DriverInfo = {
        ...driver!,
        partnerCompanyId: null,
        partnerCompanyName: null,
        isPrivateCustomer: true,
        billingName,
        billingAddress,
        billingCity,
        billingZipCode,
        billingCountry,
        billingTaxNumber,
      };
      saveSession(sessionId!, updatedDriver);
      setDriver(updatedDriver);

      setSuccess('Sikeresen fuggetlenedtel! Mostantol privat ugyfelekkent hasznalhatod az alkalmazast.');
      setShowDetachModal(false);
      setPin('');
    } catch (err: any) {
      setError(err.message || 'Hiba tortent');
    } finally {
      setDetaching(false);
    }
  };

  const handleSaveBillingInfo = async () => {
    if (!billingName || !billingAddress || !billingCity || !billingZipCode) {
      setError('Toltsd ki a kotelezo mezokat!');
      return;
    }

    setSavingBilling(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/pwa/billing-info`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionId}`,
        },
        body: JSON.stringify({
          driverId: driver!.driverId,
          billingName,
          billingAddress,
          billingCity,
          billingZipCode,
          billingCountry,
          billingTaxNumber: billingTaxNumber || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Hiba tortent');
      }

      // Update session with new billing info
      const updatedDriver: DriverInfo = {
        ...driver!,
        billingName,
        billingAddress,
        billingCity,
        billingZipCode,
        billingCountry,
        billingTaxNumber,
      };
      saveSession(sessionId!, updatedDriver);
      setDriver(updatedDriver);

      setSuccess('Szamlazasi adatok mentve!');
      setEditingBilling(false);
    } catch (err: any) {
      setError(err.message || 'Hiba tortent');
    } finally {
      setSavingBilling(false);
    }
  };

  const handleLogout = () => {
    clearSession();
    router.replace('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Betoltes...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-primary-600 text-white px-4 py-4 safe-area-top">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="p-2 hover:bg-primary-700 rounded-lg transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-lg font-semibold">Beallitasok</h1>
        </div>
      </header>

      <div className="px-4 py-6 space-y-4">
        {/* Success/Error messages */}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-green-700">
            {success}
          </div>
        )}
        {error && !showDetachModal && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600">
            {error}
          </div>
        )}

        {/* Profile Section */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Profil</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-500">Nev:</span>
              <span className="font-medium text-gray-900">{driver?.firstName} {driver?.lastName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Statusz:</span>
              <span className={`font-medium ${driver?.isPrivateCustomer ? 'text-green-600' : 'text-blue-600'}`}>
                {driver?.isPrivateCustomer ? 'Privat ugyfel' : 'Ceges sofor'}
              </span>
            </div>
            {driver?.partnerCompanyName && (
              <div className="flex justify-between">
                <span className="text-gray-500">Ceg:</span>
                <span className="font-medium text-gray-900">{driver.partnerCompanyName}</span>
              </div>
            )}
          </div>
        </div>

        {/* Billing Info Section - for private customers */}
        {driver?.isPrivateCustomer && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Szamlazasi adatok</h2>
              {!editingBilling && (
                <button
                  onClick={() => setEditingBilling(true)}
                  className="text-primary-600 text-sm font-medium"
                >
                  Szerkesztes
                </button>
              )}
            </div>

            {editingBilling ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Szamlazasi nev *</label>
                  <input
                    type="text"
                    value={billingName}
                    onChange={(e) => setBillingName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cim *</label>
                  <input
                    type="text"
                    value={billingAddress}
                    onChange={(e) => setBillingAddress(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Irsz. *</label>
                    <input
                      type="text"
                      value={billingZipCode}
                      onChange={(e) => setBillingZipCode(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Varos *</label>
                    <input
                      type="text"
                      value={billingCity}
                      onChange={(e) => setBillingCity(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Adoszam</label>
                  <input
                    type="text"
                    value={billingTaxNumber}
                    onChange={(e) => setBillingTaxNumber(e.target.value)}
                    placeholder="12345678-1-23"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setEditingBilling(false)}
                    className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl"
                  >
                    Megse
                  </button>
                  <button
                    onClick={handleSaveBillingInfo}
                    disabled={savingBilling}
                    className="flex-1 py-3 bg-primary-600 text-white font-medium rounded-xl disabled:opacity-50"
                  >
                    {savingBilling ? 'Mentes...' : 'Mentes'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">Nev:</span>
                  <span className="font-medium text-gray-900">{driver.billingName || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Cim:</span>
                  <span className="font-medium text-gray-900">
                    {driver.billingAddress ? `${driver.billingZipCode} ${driver.billingCity}, ${driver.billingAddress}` : '-'}
                  </span>
                </div>
                {driver.billingTaxNumber && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Adoszam:</span>
                    <span className="font-medium text-gray-900">{driver.billingTaxNumber}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Detach from Partner Section - only for fleet drivers */}
        {driver?.partnerCompanyId && !driver?.isPrivateCustomer && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Fuggetlenedes</h2>
            <p className="text-gray-500 text-sm mb-4">
              Ha mar nem tartozol a cegedhez, fuggetlenedehetsz es privat ugyfelkent folytathatod.
              Igy tovabbra is hasznalhatod az alkalmazast es lathatod a publikus helyszineket.
            </p>
            <button
              onClick={() => setShowDetachModal(true)}
              className="w-full py-3 bg-amber-100 text-amber-800 font-medium rounded-xl hover:bg-amber-200 transition-colors"
            >
              Fuggetlenedes a cegtol
            </button>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full py-3 bg-red-50 text-red-600 font-medium rounded-xl hover:bg-red-100 transition-colors"
        >
          Kijelentkezes
        </button>
      </div>

      {/* Detach Modal */}
      {showDetachModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">Fuggetlenedes megerositese</h2>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-sm text-amber-800">
                  <strong>Figyelem!</strong> Ha fuggetlenedsz a cegtol:
                </p>
                <ul className="text-sm text-amber-700 mt-2 space-y-1 list-disc list-inside">
                  <li>A ceged tobbe nem fizeti a mosasaidat</li>
                  <li>Csak a publikus helyszineket latod</li>
                  <li>Sajat szamlazasi adatokra van szukseged</li>
                  <li>Ez a muvelet NEM visszavonhato!</li>
                </ul>
              </div>

              {/* Billing info for detach */}
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700">Szamlazasi adatok (kotelezo):</p>
                <input
                  type="text"
                  value={billingName}
                  onChange={(e) => setBillingName(e.target.value)}
                  placeholder="Szamlazasi nev *"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl"
                />
                <input
                  type="text"
                  value={billingAddress}
                  onChange={(e) => setBillingAddress(e.target.value)}
                  placeholder="Cim *"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl"
                />
                <div className="grid grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={billingZipCode}
                    onChange={(e) => setBillingZipCode(e.target.value)}
                    placeholder="Irsz. *"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl"
                  />
                  <input
                    type="text"
                    value={billingCity}
                    onChange={(e) => setBillingCity(e.target.value)}
                    placeholder="Varos *"
                    className="col-span-2 w-full px-4 py-3 border border-gray-300 rounded-xl"
                  />
                </div>
                <input
                  type="text"
                  value={billingTaxNumber}
                  onChange={(e) => setBillingTaxNumber(e.target.value)}
                  placeholder="Adoszam (opcionalis)"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl"
                />
              </div>

              {/* PIN confirmation */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">PIN kod megerositese *</label>
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  maxLength={4}
                  placeholder="****"
                  inputMode="numeric"
                  className="w-full px-4 py-4 border border-gray-300 rounded-xl text-center text-2xl font-mono tracking-widest"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">
                  {error}
                </div>
              )}
            </div>

            <div className="p-6 pt-0 flex gap-3">
              <button
                onClick={() => {
                  setShowDetachModal(false);
                  setPin('');
                  setError('');
                }}
                className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl"
              >
                Megse
              </button>
              <button
                onClick={handleDetachFromPartner}
                disabled={detaching || !billingName || !billingAddress || !billingCity || !billingZipCode || pin.length !== 4}
                className="flex-1 py-3 bg-amber-600 text-white font-medium rounded-xl disabled:opacity-50"
              >
                {detaching ? 'Feldolgozas...' : 'Fuggetlenedes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
