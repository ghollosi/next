'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Driver {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  inviteCode: string | null;
  partnerCompany: {
    id: string;
    name: string;
    code: string;
  } | null;
  isPrivateCustomer: boolean;
}

interface Location {
  id: string;
  name: string;
  code: string;
  city: string;
  address: string;
  operationType: string;
  washMode: string;
  bookingEnabled: boolean;
  email: string | null;
}

interface Partner {
  id: string;
  name: string;
  code: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
}

interface TestNetworkData {
  network: {
    id: string;
    name: string;
    slug: string;
  };
  networkAdmin: {
    email: string;
    name: string;
  } | null;
  drivers: Driver[];
  locations: Location[];
  partners: Partner[];
  testCredentials: {
    driverPin: string;
    partnerPin: string;
    networkAdminPassword: string;
  };
}

type TestType = 'driver' | 'location' | 'partner' | 'admin';

export default function QuickTestPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TestNetworkData | null>(null);
  const [selectedType, setSelectedType] = useState<TestType>('driver');
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    fetchTestData();
  }, []);

  const fetchTestData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/test-portal/test-network-data');
      if (!response.ok) {
        throw new Error('Failed to fetch test data');
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!data || !selectedItem) return;

    setLoggingIn(true);

    try {
      switch (selectedType) {
        case 'driver': {
          const driver = data.drivers.find(d => d.id === selectedItem);
          if (!driver?.inviteCode) {
            alert('Ez a sofor nincs meghivo koddal regisztralva');
            setLoggingIn(false);
            return;
          }
          // Store credentials for auto-fill
          sessionStorage.setItem('test_invite_code', driver.inviteCode);
          sessionStorage.setItem('test_pin', data.testCredentials.driverPin);
          sessionStorage.setItem('test_auto_login', 'driver');
          // Open driver app login page
          window.open('/login', '_blank');
          break;
        }
        case 'location': {
          const location = data.locations.find(l => l.id === selectedItem);
          if (!location) {
            setLoggingIn(false);
            return;
          }
          // Store location code for QR simulation
          sessionStorage.setItem('test_location_code', location.code);
          sessionStorage.setItem('test_auto_login', 'location');
          // Open operator portal - needs admin login first
          window.open('/operator', '_blank');
          break;
        }
        case 'partner': {
          const partner = data.partners.find(p => p.id === selectedItem);
          if (!partner) {
            setLoggingIn(false);
            return;
          }
          // Store partner code for login
          sessionStorage.setItem('test_partner_code', partner.code);
          sessionStorage.setItem('test_pin', data.testCredentials.partnerPin);
          sessionStorage.setItem('test_auto_login', 'partner');
          // Open partner portal
          window.open('/partner', '_blank');
          break;
        }
        case 'admin': {
          if (!data.networkAdmin) {
            alert('Nincs network admin beallitva');
            setLoggingIn(false);
            return;
          }
          // Store admin credentials
          sessionStorage.setItem('test_admin_email', data.networkAdmin.email);
          sessionStorage.setItem('test_admin_password', data.testCredentials.networkAdminPassword);
          sessionStorage.setItem('test_auto_login', 'admin');
          // Open network admin portal
          window.open('/network-admin/login', '_blank');
          break;
        }
      }
    } finally {
      setLoggingIn(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Tesztadatok betoltese...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Hiba tortent</h2>
          <p className="text-gray-600 mb-4">{error || 'Nem sikerult betolteni a tesztadatokat'}</p>
          <button
            onClick={fetchTestData}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Ujra proba
          </button>
        </div>
      </div>
    );
  }

  const getItemsForType = () => {
    switch (selectedType) {
      case 'driver':
        return data.drivers;
      case 'location':
        return data.locations;
      case 'partner':
        return data.partners;
      case 'admin':
        return data.networkAdmin ? [data.networkAdmin] : [];
      default:
        return [];
    }
  };

  const renderItemDetails = () => {
    if (!selectedItem) return null;

    switch (selectedType) {
      case 'driver': {
        const driver = data.drivers.find(d => d.id === selectedItem);
        if (!driver) return null;
        return (
          <div className="bg-blue-50 rounded-xl p-4 space-y-2">
            <h4 className="font-semibold text-blue-800">Belepsesi adatok:</h4>
            <p><span className="text-blue-600">Meghivo kod:</span> <code className="bg-blue-100 px-2 py-1 rounded font-mono">{driver.inviteCode || 'N/A'}</code></p>
            <p><span className="text-blue-600">PIN kod:</span> <code className="bg-blue-100 px-2 py-1 rounded font-mono">{data.testCredentials.driverPin}</code></p>
            <p><span className="text-blue-600">Telefon:</span> {driver.phone || 'N/A'}</p>
            <p><span className="text-blue-600">Partner:</span> {driver.partnerCompany?.name || 'Egyeni sofor'}</p>
          </div>
        );
      }
      case 'location': {
        const location = data.locations.find(l => l.id === selectedItem);
        if (!location) return null;
        return (
          <div className="bg-green-50 rounded-xl p-4 space-y-2">
            <h4 className="font-semibold text-green-800">Helyszin adatok:</h4>
            <p><span className="text-green-600">Kod:</span> <code className="bg-green-100 px-2 py-1 rounded font-mono">{location.code}</code></p>
            <p><span className="text-green-600">Cim:</span> {location.city}, {location.address}</p>
            <p><span className="text-green-600">Tipus:</span> {location.operationType === 'OWN' ? 'Sajat' : 'Alvallalkozo'}</p>
            <p><span className="text-green-600">Mosas mod:</span> {location.washMode}</p>
            <p><span className="text-green-600">Foglalas:</span> {location.bookingEnabled ? 'Engedelyezve' : 'Letiltva'}</p>
          </div>
        );
      }
      case 'partner': {
        const partner = data.partners.find(p => p.id === selectedItem);
        if (!partner) return null;
        return (
          <div className="bg-purple-50 rounded-xl p-4 space-y-2">
            <h4 className="font-semibold text-purple-800">Partner belepsesi adatok:</h4>
            <p><span className="text-purple-600">Partner kod:</span> <code className="bg-purple-100 px-2 py-1 rounded font-mono">{partner.code}</code></p>
            <p><span className="text-purple-600">PIN kod:</span> <code className="bg-purple-100 px-2 py-1 rounded font-mono">{data.testCredentials.partnerPin}</code></p>
            <p><span className="text-purple-600">Kapcsolattarto:</span> {partner.contactName || 'N/A'}</p>
            <p><span className="text-purple-600">Email:</span> {partner.email || 'N/A'}</p>
          </div>
        );
      }
      case 'admin': {
        if (!data.networkAdmin) return null;
        return (
          <div className="bg-orange-50 rounded-xl p-4 space-y-2">
            <h4 className="font-semibold text-orange-800">Admin belepsesi adatok:</h4>
            <p><span className="text-orange-600">Email:</span> <code className="bg-orange-100 px-2 py-1 rounded font-mono">{data.networkAdmin.email}</code></p>
            <p><span className="text-orange-600">Jelszo:</span> <code className="bg-orange-100 px-2 py-1 rounded font-mono">{data.testCredentials.networkAdminPassword}</code></p>
          </div>
        );
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Gyors Teszteles</h1>
              <p className="text-gray-500 text-sm">{data.network.name}</p>
            </div>
            <button
              onClick={() => router.push('/test-portal/dashboard')}
              className="text-gray-600 hover:text-gray-800"
            >
              Vissza
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Test Type Selection */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Mit szeretnel tesztelni?</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { type: 'driver' as TestType, label: 'Sofor App', icon: '🚛', count: data.drivers.length },
              { type: 'location' as TestType, label: 'Operator', icon: '📍', count: data.locations.length },
              { type: 'partner' as TestType, label: 'Partner Portal', icon: '🏢', count: data.partners.length },
              { type: 'admin' as TestType, label: 'Network Admin', icon: '⚙️', count: data.networkAdmin ? 1 : 0 },
            ].map(({ type, label, icon, count }) => (
              <button
                key={type}
                onClick={() => {
                  setSelectedType(type);
                  setSelectedItem(null);
                }}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  selectedType === type
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-2xl mb-2">{icon}</div>
                <div className="font-medium text-gray-800">{label}</div>
                <div className="text-sm text-gray-500">{count} elem</div>
              </button>
            ))}
          </div>
        </div>

        {/* Item Selection */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            {selectedType === 'driver' && 'Valassz sofört'}
            {selectedType === 'location' && 'Valassz helyszint'}
            {selectedType === 'partner' && 'Valassz partnert'}
            {selectedType === 'admin' && 'Network Admin'}
          </h2>

          {selectedType === 'admin' ? (
            data.networkAdmin ? (
              <div
                onClick={() => setSelectedItem('admin')}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  selectedItem === 'admin'
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-medium">{data.networkAdmin.name}</div>
                <div className="text-sm text-gray-500">{data.networkAdmin.email}</div>
              </div>
            ) : (
              <p className="text-gray-500">Nincs network admin beallitva</p>
            )
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {selectedType === 'driver' && data.drivers.map((driver) => (
                <div
                  key={driver.id}
                  onClick={() => setSelectedItem(driver.id)}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedItem === driver.id
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">{driver.lastName} {driver.firstName}</div>
                      <div className="text-sm text-gray-500">
                        {driver.partnerCompany?.name || 'Egyeni sofor'}
                      </div>
                    </div>
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                      {driver.inviteCode || 'N/A'}
                    </code>
                  </div>
                </div>
              ))}

              {selectedType === 'location' && data.locations.map((location) => (
                <div
                  key={location.id}
                  onClick={() => setSelectedItem(location.id)}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedItem === location.id
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">{location.name}</div>
                      <div className="text-sm text-gray-500">{location.city}</div>
                    </div>
                    <div className="text-right">
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded">{location.code}</code>
                      <div className="text-xs text-gray-400 mt-1">
                        {location.operationType === 'OWN' ? 'Sajat' : 'Alvallalkozo'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {selectedType === 'partner' && data.partners.map((partner) => (
                <div
                  key={partner.id}
                  onClick={() => setSelectedItem(partner.id)}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedItem === partner.id
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">{partner.name}</div>
                      <div className="text-sm text-gray-500">{partner.contactName || 'N/A'}</div>
                    </div>
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">{partner.code}</code>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected Item Details & Login Button */}
        {(selectedItem || selectedType === 'admin') && (
          <div className="bg-white rounded-2xl shadow-sm p-6">
            {renderItemDetails()}

            <button
              onClick={handleLogin}
              disabled={loggingIn || (!selectedItem && selectedType !== 'admin')}
              className={`w-full mt-6 py-4 rounded-xl font-semibold text-lg transition-all ${
                loggingIn
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-primary-600 text-white hover:bg-primary-700'
              }`}
            >
              {loggingIn ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Betoltes...
                </span>
              ) : (
                <>
                  {selectedType === 'driver' && 'Belepes a Sofor App-ba'}
                  {selectedType === 'location' && 'Megnyitas Operator Portal-ban'}
                  {selectedType === 'partner' && 'Belepes a Partner Portal-ba'}
                  {selectedType === 'admin' && 'Belepes a Network Admin-ba'}
                </>
              )}
            </button>

            <p className="text-center text-sm text-gray-500 mt-4">
              A belepsesi adatokat a vazlatban masold be manualisn, vagy hasznald a fenti ertekeket.
            </p>
          </div>
        )}

        {/* Quick Info */}
        <div className="mt-8 bg-yellow-50 rounded-xl p-4">
          <h3 className="font-semibold text-yellow-800 mb-2">Hasznos tudnivalok</h3>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>• Minden teszt sofor PIN kodja: <code className="bg-yellow-100 px-1 rounded">1234</code></li>
            <li>• Minden partner PIN kodja: <code className="bg-yellow-100 px-1 rounded">1234</code></li>
            <li>• Network admin jelszo: <code className="bg-yellow-100 px-1 rounded">AdminPass123</code></li>
            <li>• A helyszin kodokat hasznald QR kod helyett a sofor app-ban</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
