'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface PartnerCompany {
  id: string;
  code: string;
  name: string;
}

interface VehicleInput {
  type: 'TRACTOR' | 'TRAILER';
  plateNumber: string;
  plateState: string;
}

type RegistrationType = 'fleet' | 'private' | null;

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

function RegisterContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const locationCode = searchParams.get('location');

  // Registration type selection
  const [registrationType, setRegistrationType] = useState<RegistrationType>(null);

  const [step, setStep] = useState(1);
  const [partners, setPartners] = useState<PartnerCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [partnerCompanyId, setPartnerCompanyId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  // Private customer billing data
  const [billingName, setBillingName] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [billingCity, setBillingCity] = useState('');
  const [billingZipCode, setBillingZipCode] = useState('');
  const [billingCountry, setBillingCountry] = useState('HU');
  const [billingTaxNumber, setBillingTaxNumber] = useState('');

  // Vehicles
  const [tractorPlate, setTractorPlate] = useState('');
  const [tractorState, setTractorState] = useState('HU');
  const [trailerPlate, setTrailerPlate] = useState('');
  const [trailerState, setTrailerState] = useState('HU');

  // Success state
  const [registrationResult, setRegistrationResult] = useState<{
    driverId: string;
    message: string;
    verificationRequired?: 'EMAIL' | 'PHONE' | 'BOTH';
  } | null>(null);

  // Verification state
  const [verificationCode, setVerificationCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    loadPartners();
  }, []);

  const loadPartners = async () => {
    try {
      const response = await fetch(`${API_URL}/pwa/partner-companies`);
      if (response.ok) {
        const data = await response.json();
        setPartners(data);
      }
    } catch (err) {
      console.error('Failed to load partners:', err);
    } finally {
      setLoading(false);
    }
  };

  const validateStep1 = () => {
    // Fleet driver must select a company
    if (registrationType === 'fleet' && !partnerCompanyId) {
      setError('Válassz céget!');
      return false;
    }
    if (!firstName.trim() || firstName.length < 2) {
      setError('Add meg a keresztneved!');
      return false;
    }
    if (!lastName.trim() || lastName.length < 2) {
      setError('Add meg a vezetékneved!');
      return false;
    }
    // At least email OR phone is required
    if (!email.trim() && !phone.trim()) {
      setError('Email cím VAGY telefonszám megadása kötelező!');
      return false;
    }
    // Validate email format if provided
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Érvénytelen email cím formátum!');
      return false;
    }
    return true;
  };

  const validateBillingStep = () => {
    if (!billingName.trim()) {
      setError('Add meg a számlázási nevet!');
      return false;
    }
    if (!billingAddress.trim()) {
      setError('Add meg a számlázási címet!');
      return false;
    }
    if (!billingCity.trim()) {
      setError('Add meg a várost!');
      return false;
    }
    if (!billingZipCode.trim()) {
      setError('Add meg az irányítószámot!');
      return false;
    }
    // Email is mandatory for private customers (for invoice)
    if (registrationType === 'private' && !email.trim()) {
      setError('Privát ügyfélként az email cím megadása kötelező a számlázáshoz!');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!tractorPlate.trim()) {
      setError('Add meg a vontató rendszámát!');
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      setError('A PIN kód pontosan 4 számjegyből kell álljon!');
      return false;
    }
    if (pin !== confirmPin) {
      setError('A PIN kódok nem egyeznek!');
      return false;
    }
    return true;
  };

  const getTotalSteps = () => {
    return registrationType === 'private' ? 4 : 3; // Private: personal + billing + vehicles + pin
  };

  const handleNextStep = () => {
    setError('');
    if (step === 1 && validateStep1()) {
      if (registrationType === 'private') {
        setStep(2); // Go to billing step for private
      } else {
        setStep(2); // Go to vehicles for fleet (was step 2)
      }
    } else if (step === 2) {
      if (registrationType === 'private') {
        // Validate billing, then go to vehicles
        if (validateBillingStep()) {
          setStep(3);
        }
      } else {
        // Fleet: validate vehicles, go to PIN
        if (validateStep2()) {
          setStep(3);
        }
      }
    } else if (step === 3 && registrationType === 'private' && validateStep2()) {
      setStep(4); // Private: vehicles -> PIN
    }
  };

  const handleSubmit = async () => {
    setError('');
    if (!validateStep3()) return;

    setSubmitting(true);

    const vehicles: VehicleInput[] = [
      { type: 'TRACTOR', plateNumber: tractorPlate.toUpperCase(), plateState: tractorState },
    ];

    if (trailerPlate.trim()) {
      vehicles.push({
        type: 'TRAILER',
        plateNumber: trailerPlate.toUpperCase(),
        plateState: trailerState,
      });
    }

    try {
      const requestBody: any = {
        firstName,
        lastName,
        phone: phone || undefined,
        email: email || undefined,
        pin,
        vehicles,
      };

      // Fleet driver: include partnerCompanyId
      if (registrationType === 'fleet') {
        requestBody.partnerCompanyId = partnerCompanyId;
      } else {
        // Private customer: include billing data
        requestBody.billingName = billingName;
        requestBody.billingAddress = billingAddress;
        requestBody.billingCity = billingCity;
        requestBody.billingZipCode = billingZipCode;
        requestBody.billingCountry = billingCountry;
        if (billingTaxNumber.trim()) {
          requestBody.billingTaxNumber = billingTaxNumber;
        }
      }

      const response = await fetch(`${API_URL}/pwa/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Nem sikerült a regisztráció');
      }

      const result = await response.json();
      setRegistrationResult(result);
    } catch (err: any) {
      setError(err.message || 'Hiba történt');
    } finally {
      setSubmitting(false);
    }
  };

  // Verification handlers
  const handleVerifyPhone = async () => {
    if (verificationCode.length !== 6) {
      setError('A kód 6 számjegyből kell álljon!');
      return;
    }

    setVerifying(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/pwa/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: verificationCode,
          type: 'PHONE',
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setRegistrationResult({
          ...registrationResult!,
          verificationRequired: registrationResult?.verificationRequired === 'BOTH' ? 'EMAIL' : undefined,
          message: 'Telefonszám megerősítve! ' + (registrationResult?.verificationRequired === 'BOTH'
            ? 'Még az email címed megerősítése van hátra.'
            : 'A fiókod jóváhagyásra vár.'),
        });
        setVerificationCode('');
      } else {
        setError(result.message || 'Hibás kód');
      }
    } catch {
      setError('Hiba történt a megerősítés során');
    } finally {
      setVerifying(false);
    }
  };

  const handleResendVerification = async (type: 'EMAIL' | 'PHONE') => {
    setResending(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/pwa/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId: registrationResult!.driverId,
          type,
          pin,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setError(''); // Clear error
        alert(result.message);
      } else {
        setError(result.message || 'Nem sikerült újraküldeni');
      }
    } catch {
      setError('Hiba történt az újraküldés során');
    } finally {
      setResending(false);
    }
  };

  // Success screen with verification
  if (registrationResult) {
    const needsPhoneVerification = registrationResult.verificationRequired === 'PHONE' || registrationResult.verificationRequired === 'BOTH';
    const needsEmailVerification = registrationResult.verificationRequired === 'EMAIL' || registrationResult.verificationRequired === 'BOTH';

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {registrationResult.verificationRequired ? 'Megerősítés szükséges!' : 'Regisztráció sikeres!'}
          </h1>
          <p className="text-gray-600 mb-6">
            {registrationResult.message}
          </p>

          {/* Email verification notice */}
          {needsEmailVerification && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 text-left">
              <h3 className="font-medium text-blue-900 mb-1">Email megerősítés</h3>
              <p className="text-sm text-blue-800">
                Küldtünk egy linket az email címedre. Kattints rá a megerősítéshez!
              </p>
              <button
                onClick={() => handleResendVerification('EMAIL')}
                disabled={resending}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800 underline disabled:opacity-50"
              >
                {resending ? 'Küldés...' : 'Link újraküldése'}
              </button>
            </div>
          )}

          {/* Phone verification form */}
          {needsPhoneVerification && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4 text-left">
              <h3 className="font-medium text-orange-900 mb-1">SMS megerősítés</h3>
              <p className="text-sm text-orange-800 mb-3">
                Add meg a telefonodra küldött 6 számjegyű kódot:
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  maxLength={6}
                  inputMode="numeric"
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-center text-xl font-mono tracking-widest"
                />
                <button
                  onClick={handleVerifyPhone}
                  disabled={verifying || verificationCode.length !== 6}
                  className="px-4 py-3 bg-orange-600 text-white font-medium rounded-xl hover:bg-orange-700 disabled:opacity-50"
                >
                  {verifying ? '...' : 'OK'}
                </button>
              </div>
              <button
                onClick={() => handleResendVerification('PHONE')}
                disabled={resending}
                className="mt-2 text-sm text-orange-600 hover:text-orange-800 underline disabled:opacity-50"
              >
                {resending ? 'Küldés...' : 'Kód újraküldése'}
              </button>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm mb-4">
              {error}
            </div>
          )}

          {/* Approval waiting notice */}
          {!registrationResult.verificationRequired && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
              <p className="text-sm text-yellow-800">
                <strong>Figyelem:</strong> A fiókod aktiválásra vár. Amint a cég jóváhagyta a regisztrációdat, értesítünk.
              </p>
            </div>
          )}

          <Link
            href={`/check-status?driverId=${registrationResult.driverId}`}
            className="block w-full py-3 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 transition-colors"
          >
            Státusz ellenőrzése
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Betöltés...</p>
      </div>
    );
  }

  // Registration type selection screen
  if (registrationType === null) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-primary-600 text-white p-6 pb-12">
          <Link href="/download" className="text-white/80 text-sm">
            &larr; Vissza
          </Link>
          <h1 className="text-2xl font-bold mt-4">Regisztracio</h1>
          <p className="text-white/80 mt-1">Valaszd ki a regisztracio tipusat</p>
        </div>

        <div className="-mt-6 px-4 pb-8">
          <div className="space-y-4">
            {/* Fleet Driver Option */}
            <button
              onClick={() => setRegistrationType('fleet')}
              className="w-full bg-white rounded-xl shadow-sm p-6 text-left hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">Ceges sofor</h3>
                  <p className="text-gray-500 text-sm mt-1">
                    Ha egy flottahoz tartozol es a ceged fizeti a mosasokat.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">Ceg fizet</span>
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">Flotta kedvezmenyek</span>
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">Ceg jovahagyasa kell</span>
                  </div>
                </div>
                <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>

            {/* Private Customer Option */}
            <button
              onClick={() => setRegistrationType('private')}
              className="w-full bg-white rounded-xl shadow-sm p-6 text-left hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">Privat ugyfel</h3>
                  <p className="text-gray-500 text-sm mt-1">
                    Ha onallo sofor vagy es magad fizeted a mosasokat.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded">Sajat szamla</span>
                    <span className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded">Osszes publikus helyszin</span>
                    <span className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded">Azonnali hozzaferes</span>
                  </div>
                </div>
                <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          </div>

          {/* Info box */}
          <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm text-amber-800">
              <strong>Nem tudod melyiket valaszd?</strong> Ha a munkaltatod fizeti a mosasokat, valaszd a "Ceges sofor" lehetoseget. Ha magad fizetsz, valaszd a "Privat ugyfel" opciót.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const getStepTitle = () => {
    if (registrationType === 'private') {
      switch (step) {
        case 1: return 'Szemelyes adatok';
        case 2: return 'Szamlazasi adatok';
        case 3: return 'Jarmuvek';
        case 4: return 'PIN kod beallitasa';
        default: return '';
      }
    } else {
      switch (step) {
        case 1: return 'Szemelyes adatok';
        case 2: return 'Jarmuvek';
        case 3: return 'PIN kod beallitasa';
        default: return '';
      }
    }
  };

  const totalSteps = getTotalSteps();
  const isPinStep = (registrationType === 'private' && step === 4) || (registrationType === 'fleet' && step === 3);
  const isVehicleStep = (registrationType === 'private' && step === 3) || (registrationType === 'fleet' && step === 2);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-primary-600 text-white p-6 pb-12">
        <button
          onClick={() => {
            if (step === 1) {
              setRegistrationType(null);
            } else {
              setStep(step - 1);
            }
          }}
          className="text-white/80 text-sm"
        >
          &larr; Vissza
        </button>
        <h1 className="text-2xl font-bold mt-4">
          {registrationType === 'private' ? 'Privat ugyfel regisztracio' : 'Sofor regisztracio'}
        </h1>
        <p className="text-white/80 mt-1">{getStepTitle()}</p>

        {/* Progress indicator */}
        <div className="flex gap-2 mt-4">
          {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full ${s <= step ? 'bg-white' : 'bg-white/30'}`}
            />
          ))}
        </div>
      </div>

      {/* Form Content */}
      <div className="-mt-6 px-4 pb-8">
        <div className="bg-white rounded-xl shadow-sm p-6">
          {/* Step 1: Personal Info */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Partner selection - only for fleet drivers */}
              {registrationType === 'fleet' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Melyik ceghez tartozol? *
                  </label>
                  {partners.length === 0 ? (
                    <p className="text-red-600 text-sm">Nincs elerheto ceg.</p>
                  ) : (
                    <select
                      value={partnerCompanyId}
                      onChange={(e) => setPartnerCompanyId(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="">Valassz ceget...</option>
                      {partners.map((partner) => (
                        <option key={partner.id} value={partner.id}>
                          {partner.name} ({partner.code})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Vezeteknev *
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Kovacs"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Keresztnev *
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Janos"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-2">
                <p className="text-sm text-blue-800">
                  <strong>Fontos:</strong> {registrationType === 'private'
                    ? 'Email cim megadasa kotelezo a szamlazashoz!'
                    : 'Email cim VAGY telefonszam megadasa kotelezo a regisztracio megerositesehez.'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email cim {registrationType === 'private' && '*'}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="pelda@email.hu"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {registrationType === 'private'
                    ? 'Ide kuldjuk a szamlakat es az ertesiteseket.'
                    : 'Megerosito linket kuldunk az email cimedre.'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Telefonszam
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+36 30 123 4567"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Megerosito kodot kuldunk SMS-ben.
                </p>
              </div>
            </div>
          )}

          {/* Step 2 for Private: Billing Info */}
          {step === 2 && registrationType === 'private' && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-2">
                <p className="text-sm text-amber-800">
                  <strong>Szamlazasi adatok:</strong> Ezeket az adatokat hasznaljuk a szamlazashoz. A szamlakat emailben kuldjuk.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Szamlazasi nev *
                </label>
                <input
                  type="text"
                  value={billingName}
                  onChange={(e) => setBillingName(e.target.value)}
                  placeholder="Kovacs Janos vagy Pelda Kft."
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Szamlazasi cim *
                </label>
                <input
                  type="text"
                  value={billingAddress}
                  onChange={(e) => setBillingAddress(e.target.value)}
                  placeholder="Fo utca 1."
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Iranyitoszam *
                  </label>
                  <input
                    type="text"
                    value={billingZipCode}
                    onChange={(e) => setBillingZipCode(e.target.value)}
                    placeholder="1234"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Varos *
                  </label>
                  <input
                    type="text"
                    value={billingCity}
                    onChange={(e) => setBillingCity(e.target.value)}
                    placeholder="Budapest"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Orszag
                </label>
                <select
                  value={billingCountry}
                  onChange={(e) => setBillingCountry(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="HU">Magyarorszag</option>
                  <option value="SK">Szlovakia</option>
                  <option value="RO">Romania</option>
                  <option value="PL">Lengyelorszag</option>
                  <option value="CZ">Csehorszag</option>
                  <option value="DE">Nemetorszag</option>
                  <option value="AT">Ausztria</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Adoszam (opcionalis)
                </label>
                <input
                  type="text"
                  value={billingTaxNumber}
                  onChange={(e) => setBillingTaxNumber(e.target.value)}
                  placeholder="12345678-1-23"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Ha van vallalkozasod es AFA-s szamlat kersz, add meg az adoszamot.
                </p>
              </div>
            </div>
          )}

          {/* Vehicles Step */}
          {isVehicleStep && (
            <div className="space-y-6">
              <div>
                <h3 className="font-medium text-gray-900 mb-3">
                  Vontató (kamion) *
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <input
                      type="text"
                      value={tractorPlate}
                      onChange={(e) => setTractorPlate(e.target.value.toUpperCase())}
                      placeholder="ABC-123"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 uppercase"
                    />
                  </div>
                  <div>
                    <select
                      value={tractorState}
                      onChange={(e) => setTractorState(e.target.value)}
                      className="w-full px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="HU">HU</option>
                      <option value="SK">SK</option>
                      <option value="RO">RO</option>
                      <option value="PL">PL</option>
                      <option value="CZ">CZ</option>
                      <option value="DE">DE</option>
                      <option value="AT">AT</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-medium text-gray-900 mb-3">
                  Pótkocsi (opcionális)
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <input
                      type="text"
                      value={trailerPlate}
                      onChange={(e) => setTrailerPlate(e.target.value.toUpperCase())}
                      placeholder="XYZ-789"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 uppercase"
                    />
                  </div>
                  <div>
                    <select
                      value={trailerState}
                      onChange={(e) => setTrailerState(e.target.value)}
                      className="w-full px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="HU">HU</option>
                      <option value="SK">SK</option>
                      <option value="RO">RO</option>
                      <option value="PL">PL</option>
                      <option value="CZ">CZ</option>
                      <option value="DE">DE</option>
                      <option value="AT">AT</option>
                    </select>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Ha nincs pótkocsi, hagyd üresen. Később is hozzáadhatod.
                </p>
              </div>
            </div>
          )}

          {/* PIN Setup Step */}
          {isPinStep && (
            <div className="space-y-4">
              <p className="text-gray-600 text-sm mb-4">
                Adj meg egy 4 számjegyű PIN kódot, amivel később be tudsz lépni az alkalmazásba.
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  PIN kód *
                </label>
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  maxLength={4}
                  placeholder="••••"
                  inputMode="numeric"
                  className="w-full px-4 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-center text-3xl tracking-widest font-mono"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  PIN megerősítése *
                </label>
                <input
                  type="password"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  maxLength={4}
                  placeholder="••••"
                  inputMode="numeric"
                  className="w-full px-4 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-center text-3xl tracking-widest font-mono"
                />
              </div>

              {pin && confirmPin && pin !== confirmPin && (
                <p className="text-red-600 text-sm">A PIN kódok nem egyeznek!</p>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex gap-4 mt-6">
            {step > 1 && (
              <button
                onClick={() => {
                  setError('');
                  setStep(step - 1);
                }}
                className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
              >
                Vissza
              </button>
            )}

            {!isPinStep ? (
              <button
                onClick={handleNextStep}
                className="flex-1 py-3 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 transition-colors"
              >
                Tovabb
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting || pin.length !== 4 || pin !== confirmPin}
                className="flex-1 py-3 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Kuldes...' : 'Regisztracio befejezese'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Betöltés...</p>
      </div>
    }>
      <RegisterContent />
    </Suspense>
  );
}
