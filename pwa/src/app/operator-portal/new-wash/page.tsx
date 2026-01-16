'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const API_URL = 'https://api.vemiax.com';

interface Partner {
  id: string;
  code: string;
  name: string;
  billingType: string;
}

interface Service {
  id: string;
  code: string;
  name: string;
  description?: string;
}

interface Price {
  id: string;
  servicePackageId: string;
  vehicleType: string;
  price: string;
  currency: string;
  servicePackage: { id: string; name: string; code: string };
}

interface SelectedService {
  id: string;
  servicePackageId: string;
  price: number;
}

interface PlateSuggestion {
  partner: { id: string; name: string; code: string } | null;
  vehicleType: string | null;
  trailerPlate: string | null;
  driverName: string | null;
  frequentServices: Array<{ id: string; name: string; code: string }>;
  lastWashDate: string;
  totalWashes: number;
}

interface ExchangeRateData {
  currency: string;
  rate: number;
}

// Vehicle types with Hungarian labels
const VEHICLE_TYPES = [
  { value: 'SEMI_TRUCK', label: 'Nyerges szerelveny', hasTrailer: true },
  { value: 'GRAIN_CARRIER', label: 'Gabonaszallito', hasTrailer: true },
  { value: 'TRAILER_ONLY', label: 'Csak potkocsi', hasTrailer: false },
  { value: 'CONTAINER_CARRIER', label: 'Kontener szallito', hasTrailer: true },
  { value: 'TRACTOR', label: 'Traktor', hasTrailer: false },
  { value: 'TRUCK_1_5T', label: 'Tehergepjarmu 1,5 t-ig', hasTrailer: false },
  { value: 'TRUCK_3_5T', label: 'Tehergepjarmu 3,5t-ig', hasTrailer: false },
  { value: 'TRUCK_7_5T', label: 'Tehergepjarmu 7,5t-ig', hasTrailer: false },
  { value: 'TRUCK_12T', label: 'Tehergepjarmu 12t-ig', hasTrailer: false },
  { value: 'TRUCK_12T_PLUS', label: 'Tehergepjarmu 12t felett', hasTrailer: false },
  { value: 'TANK_SOLO', label: 'Tartalyauto (szolo)', hasTrailer: false },
  { value: 'TANK_12T', label: 'Tartalyauto 12t-ig', hasTrailer: false },
  { value: 'TANK_TRUCK', label: 'Tartalyauto', hasTrailer: false },
  { value: 'TANK_SEMI_TRAILER', label: 'Tartalyfelpotkocsi', hasTrailer: true },
  { value: 'TANDEM_7_5T', label: 'Tandem 7,5t-ig', hasTrailer: false },
  { value: 'TANDEM_7_5T_PLUS', label: 'Tandem 7,5t felett', hasTrailer: false },
  { value: 'SILO', label: 'Silo', hasTrailer: false },
  { value: 'SILO_TANDEM', label: 'Silo (tandem)', hasTrailer: false },
  { value: 'TIPPER_MIXER', label: 'Billencs, Mixer', hasTrailer: false },
  { value: 'CAR_CARRIER', label: 'Autoszallito', hasTrailer: true },
  { value: 'MINIBUS', label: 'Kisbusz (8-9 szemelyes)', hasTrailer: false },
  { value: 'MIDIBUS', label: 'Nagybusz (14-15 szemelyes)', hasTrailer: false },
  { value: 'BUS', label: 'Autobusz', hasTrailer: false },
  { value: 'CAR', label: 'Szemelygepkocsi', hasTrailer: false },
  { value: 'SUV_MPV', label: 'Egyteru, terepjaro', hasTrailer: false },
  { value: 'MACHINERY', label: 'Munkagep', hasTrailer: false },
  { value: 'FORKLIFT', label: 'Targonca', hasTrailer: false },
  { value: 'MOTORCYCLE', label: 'Motorkerekpar', hasTrailer: false },
];

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Keszpenz' },
  { value: 'CARD', label: 'Bankkartya' },
  { value: 'DKV', label: 'DKV kartya' },
  { value: 'UTA', label: 'UTA kartya' },
  { value: 'MOL', label: 'MOL kartya' },
  { value: 'SHELL', label: 'Shell kartya' },
  { value: 'TRAVIS', label: 'Travis kartya' },
  { value: 'OTHER', label: 'Egyeb' },
];

export default function NewWashPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{
    totalPrice: number;
    invoiceNumber?: string;
    servicesCount: number;
    invoicePdfUrl?: string;
    walkInInvoiceRequested?: boolean;
    invoiceSentToEmail?: string;
  } | null>(null);

  // Data from API
  const [partners, setPartners] = useState<Partner[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRateData[]>([]);

  // Plate lookup
  const [suggestion, setSuggestion] = useState<PlateSuggestion | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  // Form state - in order of the form
  // 1. Rendszamok
  const [tractorPlate, setTractorPlate] = useState('');
  const [trailerPlate, setTrailerPlate] = useState('');

  // 2. Ugyfel tipusa (szerzodeses / nem szerzodeses)
  const [customerType, setCustomerType] = useState<'CONTRACT' | 'AD_HOC'>('CONTRACT');

  // 3. Partner (szerzodeses) vagy Cegadatok (nem szerzodeses)
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  // Ad-hoc customer fields
  const [companyName, setCompanyName] = useState('');
  const [taxNumber, setTaxNumber] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [billingCity, setBillingCity] = useState('');
  const [billingZipCode, setBillingZipCode] = useState('');
  const [email, setEmail] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');

  // Walk-in invoice request (for AD_HOC customers)
  const [wantsInvoice, setWantsInvoice] = useState(false);

  // 4. Jarmutipus
  const [vehicleType, setVehicleType] = useState('SEMI_TRUCK');

  // 5. Szolgaltatasok
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([]);
  const [newServiceId, setNewServiceId] = useState('');

  // 6. Sofor neve
  const [driverName, setDriverName] = useState('');

  // 7. Megjegyzes
  const [notes, setNotes] = useState('');

  // Location type from profile
  const [locationType, setLocationType] = useState<'CAR_WASH' | 'TRUCK_WASH'>('TRUCK_WASH');

  // Check if selected vehicle type typically has a trailer (only for TRUCK_WASH)
  const selectedVehicleTypeInfo = VEHICLE_TYPES.find(t => t.value === vehicleType);
  const showTrailerPlate = locationType === 'TRUCK_WASH' && (selectedVehicleTypeInfo?.hasTrailer ?? false);

  // Get price for a service + vehicle type combination
  const getPrice = useCallback((servicePackageId: string, vType: string): number => {
    const price = prices.find(
      p => p.servicePackageId === servicePackageId && p.vehicleType === vType
    );
    return price ? parseFloat(price.price) : 0;
  }, [prices]);

  // Calculate total price
  const calculateTotalPrice = () => {
    return selectedServices.reduce((sum, svc) => sum + svc.price, 0);
  };

  // Lookup plate in previous wash events
  const lookupPlate = useCallback(async (plate: string) => {
    if (plate.length < 3) {
      setSuggestion(null);
      return;
    }

    const session = localStorage.getItem('operator_session');
    if (!session) return;

    setLookupLoading(true);
    try {
      const res = await fetch(`${API_URL}/operator-portal/lookup-plate/${encodeURIComponent(plate)}`, {
        headers: { 'x-operator-session': session },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.found) {
          setSuggestion(data.suggestion);
        } else {
          setSuggestion(null);
        }
      }
    } catch (err) {
      console.error('Plate lookup error:', err);
    } finally {
      setLookupLoading(false);
    }
  }, []);

  // Debounced plate lookup
  useEffect(() => {
    const timer = setTimeout(() => {
      if (tractorPlate.length >= 3) {
        lookupPlate(tractorPlate);
      } else {
        setSuggestion(null);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [tractorPlate, lookupPlate]);

  // Apply suggestion to form
  const applySuggestion = () => {
    if (!suggestion) return;

    if (suggestion.partner) {
      setSelectedPartnerId(suggestion.partner.id);
      setCustomerType('CONTRACT');
    }

    if (suggestion.vehicleType) {
      setVehicleType(suggestion.vehicleType);
    }

    if (suggestion.trailerPlate) {
      setTrailerPlate(suggestion.trailerPlate);
    }

    if (suggestion.driverName) {
      setDriverName(suggestion.driverName);
    }

    // Add frequent services
    if (suggestion.frequentServices && suggestion.frequentServices.length > 0) {
      const newServices: SelectedService[] = [];
      for (const svc of suggestion.frequentServices) {
        const price = getPrice(svc.id, suggestion.vehicleType || vehicleType);
        if (price > 0 && !selectedServices.some(s => s.servicePackageId === svc.id)) {
          newServices.push({
            id: `${Date.now()}-${Math.random()}-${svc.id}`,
            servicePackageId: svc.id,
            price,
          });
        }
      }
      if (newServices.length > 0) {
        setSelectedServices([...selectedServices, ...newServices]);
      }
    }

    // Clear suggestion after applying
    setSuggestion(null);
  };

  // Add a service to the list
  const addService = () => {
    if (!newServiceId) return;

    const price = getPrice(newServiceId, vehicleType);
    if (price === 0) {
      setError('Nincs ar beallitva ehhez a szolgaltatas/jarmutipus kombinaciohoz');
      return;
    }

    // Check if already added
    if (selectedServices.some(s => s.servicePackageId === newServiceId)) {
      setError('Ez a szolgaltatas mar hozza van adva');
      return;
    }

    const newItem: SelectedService = {
      id: `${Date.now()}-${Math.random()}`,
      servicePackageId: newServiceId,
      price,
    };

    setSelectedServices([...selectedServices, newItem]);
    setNewServiceId('');
    setError('');
  };

  // Remove a service from the list
  const removeService = (id: string) => {
    setSelectedServices(selectedServices.filter(s => s.id !== id));
  };

  // Get service name by ID
  const getServiceName = (servicePackageId: string) => {
    const service = services.find(s => s.id === servicePackageId);
    return service?.name || 'Ismeretlen';
  };

  // When vehicle type changes, recalculate prices for all selected services
  useEffect(() => {
    if (selectedServices.length > 0) {
      const updatedServices = selectedServices.map(svc => ({
        ...svc,
        price: getPrice(svc.servicePackageId, vehicleType),
      }));

      const invalidServices = updatedServices.filter(svc => svc.price === 0);
      if (invalidServices.length > 0) {
        setError(`Figyelem: ${invalidServices.length} szolgaltatasnak nincs ara erre a jarmutipusra`);
      } else {
        setError('');
      }

      setSelectedServices(updatedServices);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleType, getPrice]);

  useEffect(() => {
    const session = localStorage.getItem('operator_session');
    if (!session) {
      router.replace('/operator-portal/login');
      return;
    }

    const loadData = async () => {
      try {
        const [partnersRes, servicesRes, pricesRes, profileRes] = await Promise.all([
          fetch(`${API_URL}/operator-portal/partners`, {
            headers: { 'x-operator-session': session },
          }),
          fetch(`${API_URL}/operator-portal/services`, {
            headers: { 'x-operator-session': session },
          }),
          fetch(`${API_URL}/operator-portal/prices`, {
            headers: { 'x-operator-session': session },
          }),
          fetch(`${API_URL}/operator-portal/profile`, {
            headers: { 'x-operator-session': session },
          }),
        ]);

        if (!partnersRes.ok || !servicesRes.ok || !pricesRes.ok || !profileRes.ok) {
          if (partnersRes.status === 401 || servicesRes.status === 401 || pricesRes.status === 401 || profileRes.status === 401) {
            localStorage.removeItem('operator_session');
            localStorage.removeItem('operator_info');
            router.replace('/operator-portal/login');
            return;
          }
          throw new Error('Adatok betoltese sikertelen');
        }

        const [partnersData, servicesData, pricesData, profileData] = await Promise.all([
          partnersRes.json(),
          servicesRes.json(),
          pricesRes.json(),
          profileRes.json(),
        ]);

        setPartners(partnersData.data || []);
        setServices(servicesData.data || []);
        setPrices(pricesData.data || []);

        // Set location type from profile
        if (profileData.locationType) {
          setLocationType(profileData.locationType);
          // Set default vehicle type based on location type
          if (profileData.locationType === 'CAR_WASH') {
            setVehicleType('CAR');
          }
        }

        // Load exchange rates
        try {
          const ratesRes = await fetch(`${API_URL}/exchange-rates`);
          if (ratesRes.ok) {
            const ratesData = await ratesRes.json();
            setExchangeRates(ratesData.ecb || []);
          }
        } catch (ratesErr) {
          console.error('Exchange rates load error:', ratesErr);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Hiba tortent');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!tractorPlate) {
      setError('Rendszam megadasa kotelezo!');
      return;
    }

    if (customerType === 'CONTRACT' && !selectedPartnerId) {
      setError('Partner kivalasztasa kotelezo!');
      return;
    }

    if (customerType === 'AD_HOC' && wantsInvoice && (!companyName || !taxNumber || !email)) {
      setError('Szamlakereshez cegnev, adoszam es email megadasa kotelezo!');
      return;
    }

    if (selectedServices.length === 0) {
      setError('Legalabb egy szolgaltatast valassz ki!');
      return;
    }

    const invalidServices = selectedServices.filter(svc => svc.price === 0);
    if (invalidServices.length > 0) {
      setError('Vannak szolgaltatasok amiknek nincs ara erre a jarmutipusra.');
      return;
    }

    setSubmitting(true);

    const session = localStorage.getItem('operator_session');
    if (!session) {
      router.replace('/operator-portal/login');
      return;
    }

    try {
      const body: Record<string, unknown> = {
        tractorPlate: tractorPlate.toUpperCase(),
        tractorVehicleType: vehicleType,
        driverName: driverName || undefined,
        notes: notes || undefined,
        services: selectedServices.map(svc => ({
          servicePackageId: svc.servicePackageId,
          vehicleType: vehicleType,
          quantity: 1,
        })),
      };

      if (showTrailerPlate && trailerPlate) {
        body.trailerPlate = trailerPlate.toUpperCase();
        body.trailerVehicleType = vehicleType;
      }

      if (customerType === 'CONTRACT') {
        body.partnerCompanyId = selectedPartnerId;
      } else {
        body.isAdHoc = true;
        body.paymentMethod = paymentMethod;
        body.walkInInvoiceRequested = wantsInvoice;
        // Only include billing data if invoice is requested
        if (wantsInvoice) {
          body.walkInBillingName = companyName;
          body.walkInBillingTaxNumber = taxNumber;
          body.walkInBillingAddress = billingAddress;
          body.walkInBillingCity = billingCity;
          body.walkInBillingZipCode = billingZipCode;
          body.walkInBillingCountry = 'HU';
          body.walkInBillingEmail = email;
        }
      }

      const response = await fetch(`${API_URL}/operator-portal/wash-events/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-operator-session': session,
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Mosas rogzites sikertelen');
      }

      setSuccess({
        totalPrice: data.totalPrice,
        invoiceNumber: data.invoice?.invoiceNumber,
        servicesCount: data.servicesCount || selectedServices.length,
        invoicePdfUrl: data.invoice?.pdfUrl,
        walkInInvoiceRequested: wantsInvoice,
        invoiceSentToEmail: wantsInvoice ? email : undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hiba tortent');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Betoltes...</div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Mosas rogzitve!</h2>
          <p className="text-gray-600 mb-2">
            Szolgaltatasok: <span className="font-bold">{success.servicesCount} db</span>
          </p>
          <p className="text-gray-600 mb-4">
            Osszeg: <span className="font-bold">{success.totalPrice.toLocaleString('hu-HU')} Ft</span>
          </p>
          {success.invoiceNumber && (
            <div className="mb-6">
              <p className="text-sm text-gray-500">
                Szamlaszam: {success.invoiceNumber}
              </p>
              {success.invoiceSentToEmail && (
                <p className="text-sm text-green-600 mt-1">
                  Szamla elkuldve: {success.invoiceSentToEmail}
                </p>
              )}
            </div>
          )}

          {/* Walk-in invoice actions */}
          {success.walkInInvoiceRequested && success.invoicePdfUrl && (
            <div className="mb-6 space-y-3">
              <a
                href={success.invoicePdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Szamla nyomtatasa
              </a>
              <p className="text-xs text-gray-500 text-center">
                A szamla automatikusan el lett kuldve emailben is.
              </p>
            </div>
          )}

          {success.walkInInvoiceRequested && !success.invoicePdfUrl && (
            <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm text-amber-700">
                A szamla keszitese folyamatban, hamarosan elerheto lesz.
              </p>
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={() => {
                setSuccess(null);
                setSelectedServices([]);
                setTractorPlate('');
                setTrailerPlate('');
                setDriverName('');
                setNotes('');
                setSelectedPartnerId('');
                setCompanyName('');
                setTaxNumber('');
                setBillingAddress('');
                setBillingCity('');
                setBillingZipCode('');
                setEmail('');
                setPaymentMethod('CASH');
                setCustomerType('CONTRACT');
                setSuggestion(null);
                setWantsInvoice(false);
              }}
              className="w-full py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
            >
              Uj mosas rogzitese
            </button>
            <button
              onClick={() => router.push('/operator-portal/dashboard')}
              className="w-full py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              Vissza a muszerfalra
            </button>
          </div>
        </div>
      </div>
    );
  }

  const totalPrice = calculateTotalPrice();

  // Get services that have prices for the selected vehicle type
  const availableServices = services.filter(service =>
    prices.some(p => p.servicePackageId === service.id && p.vehicleType === vehicleType)
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-green-600 text-white px-4 py-4 shadow-lg">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-green-700 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold">Uj Mosas Rogzitese</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* 1. RENDSZAM */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h2 className="font-semibold text-gray-800 mb-4">1. Rendszam</h2>
            {locationType === 'CAR_WASH' && (
              <div className="mb-3 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full inline-block">
                Automoso - csak 1 rendszam
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {locationType === 'CAR_WASH' ? 'Rendszam *' : 'Rendszam (vontato) *'}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={tractorPlate}
                    onChange={(e) => setTractorPlate(e.target.value.toUpperCase())}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 font-mono text-lg"
                    placeholder="ABC-123"
                    autoFocus
                  />
                  {lookupLoading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <svg className="animate-spin h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                  )}
                </div>
              </div>

              {/* Suggestion box */}
              {suggestion && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-medium text-blue-800">Korabbi mosas talalhato!</span>
                      </div>
                      <div className="text-sm text-blue-700 space-y-1">
                        {suggestion.partner && (
                          <p>Partner: <span className="font-medium">{suggestion.partner.name}</span></p>
                        )}
                        {suggestion.vehicleType && (
                          <p>Jarmutipus: <span className="font-medium">{VEHICLE_TYPES.find(t => t.value === suggestion.vehicleType)?.label || suggestion.vehicleType}</span></p>
                        )}
                        {suggestion.trailerPlate && (
                          <p>Potkocsi: <span className="font-medium">{suggestion.trailerPlate}</span></p>
                        )}
                        {suggestion.driverName && (
                          <p>Sofor: <span className="font-medium">{suggestion.driverName}</span></p>
                        )}
                        {suggestion.frequentServices.length > 0 && (
                          <p>Szolgaltatasok: <span className="font-medium">{suggestion.frequentServices.map(s => s.name).join(', ')}</span></p>
                        )}
                        <p className="text-xs text-blue-500 mt-1">
                          Utolso mosas: {new Date(suggestion.lastWashDate).toLocaleDateString('hu-HU')} ({suggestion.totalWashes} mosas osszesen)
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={applySuggestion}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors whitespace-nowrap"
                    >
                      Atvesz
                    </button>
                  </div>
                </div>
              )}

              {showTrailerPlate && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Potkocsi rendszam (opcionalis)
                  </label>
                  <input
                    type="text"
                    value={trailerPlate}
                    onChange={(e) => setTrailerPlate(e.target.value.toUpperCase())}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 font-mono text-lg"
                    placeholder="XYZ-789"
                  />
                </div>
              )}
            </div>
          </div>

          {/* 2. UGYFEL TIPUSA */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h2 className="font-semibold text-gray-800 mb-4">2. Ugyfel tipusa</h2>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCustomerType('CONTRACT')}
                className={`py-3 px-4 rounded-lg border-2 font-medium transition-colors ${
                  customerType === 'CONTRACT'
                    ? 'border-green-600 bg-green-50 text-green-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                Szerzodeses
              </button>
              <button
                type="button"
                onClick={() => setCustomerType('AD_HOC')}
                className={`py-3 px-4 rounded-lg border-2 font-medium transition-colors ${
                  customerType === 'AD_HOC'
                    ? 'border-green-600 bg-green-50 text-green-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                Nem szerzodeses
              </button>
            </div>
          </div>

          {/* 3. PARTNER (szerzodeses) */}
          {customerType === 'CONTRACT' && (
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h2 className="font-semibold text-gray-800 mb-4">3. Partner</h2>
              <select
                value={selectedPartnerId}
                onChange={(e) => setSelectedPartnerId(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                <option value="">Valassz partnert...</option>
                {partners.map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {partner.name} ({partner.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 3. WALK-IN UGYFEL ADATOK (nem szerzodeses) */}
          {customerType === 'AD_HOC' && (
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h2 className="font-semibold text-gray-800 mb-4">3. Walk-in ugyfel</h2>
              <div className="space-y-4">
                {/* Payment method first */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fizetesi mod</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    {PAYMENT_METHODS.map((method) => (
                      <option key={method.value} value={method.value}>
                        {method.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Invoice request toggle */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={wantsInvoice}
                      onChange={(e) => setWantsInvoice(e.target.checked)}
                      className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                    <div>
                      <span className="font-medium text-gray-800">Szamlat ker az ugyfel</span>
                      <p className="text-sm text-gray-500">Helyszinen kinyomtatjuk + emailben elkuldjuk</p>
                    </div>
                  </label>
                </div>

                {/* Invoice billing data - only if wants invoice */}
                {wantsInvoice && (
                  <div className="border-t border-gray-200 pt-4 space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-2">
                      <p className="text-sm text-blue-700">
                        <strong>Szamlazasi adatok:</strong> A szamlat helyben kinyomtatjuk es emailben is elkuldjuk.
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Szamlazasi nev *</label>
                      <input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        required={wantsInvoice}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        placeholder="Pelda Kft. vagy Kovacs Janos"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Adoszam *</label>
                      <input
                        type="text"
                        value={taxNumber}
                        onChange={(e) => setTaxNumber(e.target.value)}
                        required={wantsInvoice}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        placeholder="12345678-1-23"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email * (ide kuldjuk a szamlat)</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required={wantsInvoice}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        placeholder="szamla@ceg.hu"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Szamlazasi cim</label>
                      <input
                        type="text"
                        value={billingAddress}
                        onChange={(e) => setBillingAddress(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        placeholder="Pelda utca 1."
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Iranyitoszam</label>
                        <input
                          type="text"
                          value={billingZipCode}
                          onChange={(e) => setBillingZipCode(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          placeholder="1234"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Varos</label>
                        <input
                          type="text"
                          value={billingCity}
                          onChange={(e) => setBillingCity(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          placeholder="Budapest"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* No invoice info */}
                {!wantsInvoice && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-sm text-gray-600">
                      Ha az ugyfel nem ker szamlat, a mosas rogzitve lesz, de szamla nem keszul.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 4. JARMUTIPUS */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h2 className="font-semibold text-gray-800 mb-4">4. Jarmutipus</h2>
            <select
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              {VEHICLE_TYPES
                .filter(type => {
                  // CAR_WASH: only show car-related types
                  if (locationType === 'CAR_WASH') {
                    return ['CAR', 'SUV_MPV', 'MINIBUS', 'MIDIBUS', 'MOTORCYCLE'].includes(type.value);
                  }
                  return true;
                })
                .map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
            </select>
          </div>

          {/* 5. SZOLGALTATASOK */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h2 className="font-semibold text-gray-800 mb-4">5. Szolgaltatasok</h2>

            {/* Selected services list */}
            {selectedServices.length > 0 && (
              <div className="mb-4 space-y-2">
                {selectedServices.map((svc) => (
                  <div key={svc.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                    <div className="flex-1">
                      <div className="font-medium text-gray-800">
                        {getServiceName(svc.servicePackageId)}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`font-semibold ${svc.price === 0 ? 'text-red-500' : 'text-green-600'}`}>
                        {svc.price === 0 ? 'Nincs ar!' : `${svc.price.toLocaleString('hu-HU')} Ft`}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeService(svc.id)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add new service */}
            <div className={selectedServices.length > 0 ? 'border-t border-gray-200 pt-4' : ''}>
              <div className="space-y-3">
                <select
                  value={newServiceId}
                  onChange={(e) => setNewServiceId(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  <option value="">Valassz szolgaltatast...</option>
                  {availableServices.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name} - {getPrice(service.id, vehicleType).toLocaleString('hu-HU')} Ft
                    </option>
                  ))}
                </select>

                {availableServices.length === 0 && (
                  <p className="text-sm text-orange-600">
                    Nincs elerheto szolgaltatas erre a jarmutipusra.
                  </p>
                )}

                <button
                  type="button"
                  onClick={addService}
                  disabled={!newServiceId}
                  className="w-full py-3 bg-green-100 text-green-700 rounded-lg font-medium hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Szolgaltatas hozzaadasa
                </button>

                <p className="text-xs text-gray-500 text-center mt-2">
                  * Az arak listaarak, tajekoztato jelleguek.
                </p>
              </div>
            </div>
          </div>

          {/* 6. SOFOR */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h2 className="font-semibold text-gray-800 mb-4">6. Sofor neve</h2>
            <input
              type="text"
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              placeholder="Kiss Janos (opcionalis)"
            />
          </div>

          {/* 7. MEGJEGYZES */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h2 className="font-semibold text-gray-800 mb-4">7. Megjegyzes</h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
              placeholder="Opcionalis megjegyzes..."
            />
          </div>

          {/* Price Summary */}
          {totalPrice > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="font-medium text-green-800">Osszesen:</span>
                  <span className="text-sm text-green-600 ml-2">({selectedServices.length} szolgaltatas)</span>
                </div>
                <span className="text-2xl font-bold text-green-600">
                  {totalPrice.toLocaleString('hu-HU')} Ft
                </span>
              </div>

              {/* Exchange rate info for cash/card payments */}
              {customerType === 'AD_HOC' && (paymentMethod === 'CASH' || paymentMethod === 'CARD') && exchangeRates.length > 0 && (
                <div className="mt-3 pt-3 border-t border-green-200">
                  <div className="text-xs text-green-700 font-medium mb-2">Arfolyamok (ECB) - keszpenz/kartyas fizeteshez:</div>
                  <div className="grid grid-cols-3 gap-2">
                    {exchangeRates
                      .filter(rate => ['USD', 'GBP', 'CHF'].includes(rate.currency))
                      .map(rate => {
                        const convertedPrice = totalPrice / rate.rate;
                        return (
                          <div key={rate.currency} className="bg-white/50 rounded-lg p-2 text-center">
                            <div className="text-sm font-bold text-green-800">
                              {convertedPrice.toFixed(2)} {rate.currency}
                            </div>
                            <div className="text-xs text-green-600">
                              1 EUR = {rate.rate.toFixed(4)}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                  {(() => {
                    const hufRate = exchangeRates.find(r => r.currency === 'HUF');
                    if (hufRate) {
                      const eurPrice = totalPrice / hufRate.rate;
                      return (
                        <div className="mt-2 text-center bg-white/50 rounded-lg p-2">
                          <span className="text-lg font-bold text-green-800">{eurPrice.toFixed(2)} EUR</span>
                          <span className="text-xs text-green-600 ml-2">(1 EUR = {hufRate.rate.toFixed(2)} HUF)</span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              )}

              <p className="text-xs text-green-600 text-center mt-2">
                * A feltuntetett arak listaarak, tajekoztato jelleguek. A szerzodeses partnerek egyedi kedvezmenyei a vegleges szamlazasban ervenyesulnek.
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || selectedServices.length === 0 || (customerType === 'CONTRACT' && !selectedPartnerId)}
            className="w-full py-4 bg-green-600 text-white rounded-xl font-semibold text-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Feldolgozas...' : 'Mosas Rogzitese'}
          </button>
        </form>
      </main>
    </div>
  );
}
