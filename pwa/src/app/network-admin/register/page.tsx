'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { networkAdminApi } from '@/lib/network-admin-api';

export default function NetworkAdminRegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    networkName: '',
    slug: '',
    adminName: '',
    email: '',
    password: '',
    passwordConfirm: '',
    phone: '',
    taxNumber: '',
    companyAddress: '',
    companyCity: '',
    companyZipCode: '',
    country: 'HU',
  });

  // Generate slug from network name
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[áàäâ]/g, 'a')
      .replace(/[éèëê]/g, 'e')
      .replace(/[íìïî]/g, 'i')
      .replace(/[óòöôő]/g, 'o')
      .replace(/[úùüûű]/g, 'u')
      .replace(/[ýÿ]/g, 'y')
      .replace(/[ñ]/g, 'n')
      .replace(/[ç]/g, 'c')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      // Auto-generate slug from network name
      if (name === 'networkName') {
        updated.slug = generateSlug(value);
      }
      return updated;
    });
  };

  const validateStep1 = () => {
    if (!formData.networkName || formData.networkName.length < 2) {
      setError('A cég/hálózat neve legalább 2 karakter legyen');
      return false;
    }
    if (!formData.slug || formData.slug.length < 3) {
      setError('A hálózat azonosító legalább 3 karakter legyen');
      return false;
    }
    if (!/^[a-z0-9-]+$/.test(formData.slug)) {
      setError('A hálózat azonosító csak kisbetűket, számokat és kötőjelet tartalmazhat');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!formData.adminName || formData.adminName.length < 2) {
      setError('A név legalább 2 karakter legyen');
      return false;
    }
    if (!formData.email || !formData.email.includes('@')) {
      setError('Érvényes email címet adjon meg');
      return false;
    }
    if (!formData.phone || formData.phone.length < 6) {
      setError('Érvényes telefonszámot adjon meg');
      return false;
    }
    if (!formData.password || formData.password.length < 8) {
      setError('A jelszó legalább 8 karakter legyen');
      return false;
    }
    if (formData.password !== formData.passwordConfirm) {
      setError('A jelszavak nem egyeznek');
      return false;
    }
    return true;
  };

  const handleNextStep = () => {
    setError('');
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      setStep(3);
    }
  };

  const handlePrevStep = () => {
    setError('');
    setStep(step - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await networkAdminApi.register({
        networkName: formData.networkName,
        slug: formData.slug,
        adminName: formData.adminName,
        email: formData.email,
        password: formData.password,
        phone: formData.phone,
        taxNumber: formData.taxNumber || undefined,
        companyAddress: formData.companyAddress || undefined,
        companyCity: formData.companyCity || undefined,
        companyZipCode: formData.companyZipCode || undefined,
        country: formData.country,
      });

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Regisztráció sikertelen');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-gray-800 rounded-2xl p-8 shadow-xl text-center">
            <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Sikeres regisztráció!</h1>
            <p className="text-gray-400 mb-6">
              A próbaidőszak megkezdődött. Most már bejelentkezhet a hálózatába.
            </p>
            <div className="bg-gray-700 rounded-lg p-4 mb-6">
              <p className="text-gray-300 text-sm mb-2">Bejelentkezési adatok:</p>
              <p className="text-white font-mono">Hálózat: <span className="text-blue-400">{formData.slug}</span></p>
              <p className="text-white font-mono">Email: <span className="text-blue-400">{formData.email}</span></p>
            </div>
            <Link
              href="/network-admin"
              className="inline-block w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Bejelentkezés
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        {/* Logo and title */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Új hálózat regisztráció</h1>
          <p className="text-gray-400 mt-1">Indítsa el a próbaidőszakot</p>
        </div>

        {/* Progress steps */}
        <div className="flex items-center justify-center mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-medium ${
                  s <= step ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'
                }`}
              >
                {s}
              </div>
              {s < 3 && (
                <div
                  className={`w-16 h-1 mx-2 ${
                    s < step ? 'bg-blue-600' : 'bg-gray-700'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Form */}
        <div className="bg-gray-800 rounded-2xl p-6 shadow-xl">
          <form onSubmit={handleSubmit}>
            {/* Step 1: Network info */}
            {step === 1 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-white mb-4">Hálózat adatai</h2>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Cég / Hálózat neve *
                  </label>
                  <input
                    type="text"
                    name="networkName"
                    value={formData.networkName}
                    onChange={handleChange}
                    placeholder="pl. Wash Center Kft."
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Hálózat azonosító (URL) *
                  </label>
                  <div className="flex items-center">
                    <span className="text-gray-500 text-sm mr-2">vsys.app/</span>
                    <input
                      type="text"
                      name="slug"
                      value={formData.slug}
                      onChange={handleChange}
                      placeholder="wash-center"
                      className="flex-1 px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <p className="text-gray-500 text-xs mt-1">Csak kisbetűk, számok és kötőjel</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Adószám
                  </label>
                  <input
                    type="text"
                    name="taxNumber"
                    value={formData.taxNumber}
                    onChange={handleChange}
                    placeholder="12345678-1-23"
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Admin info */}
            {step === 2 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-white mb-4">Adminisztrátor adatai</h2>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Teljes név *
                  </label>
                  <input
                    type="text"
                    name="adminName"
                    value={formData.adminName}
                    onChange={handleChange}
                    placeholder="Kovács János"
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Email cím *
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="admin@example.com"
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Telefonszám *
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+36 30 123 4567"
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Jelszó *
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Legalább 8 karakter"
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 pr-12"
                      style={{ WebkitTextSecurity: showPassword ? 'none' : 'disc' } as any}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                      {showPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Jelszó megerősítése *
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="passwordConfirm"
                    value={formData.passwordConfirm}
                    onChange={handleChange}
                    placeholder="Jelszó újra"
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ WebkitTextSecurity: showPassword ? 'none' : 'disc' } as any}
                  />
                </div>
              </div>
            )}

            {/* Step 3: Company address (optional) */}
            {step === 3 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-white mb-4">Cím adatok (opcionális)</h2>
                <p className="text-gray-400 text-sm mb-4">Ezeket később is megadhatja a beállításokban</p>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Utca, házszám
                  </label>
                  <input
                    type="text"
                    name="companyAddress"
                    value={formData.companyAddress}
                    onChange={handleChange}
                    placeholder="Fő utca 1."
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Irányítószám
                    </label>
                    <input
                      type="text"
                      name="companyZipCode"
                      value={formData.companyZipCode}
                      onChange={handleChange}
                      placeholder="1234"
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Város
                    </label>
                    <input
                      type="text"
                      name="companyCity"
                      value={formData.companyCity}
                      onChange={handleChange}
                      placeholder="Budapest"
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Summary */}
                <div className="mt-6 pt-4 border-t border-gray-700">
                  <h3 className="text-white font-medium mb-2">Összegzés</h3>
                  <div className="bg-gray-700 rounded-lg p-4 text-sm">
                    <p className="text-gray-300">Hálózat: <span className="text-white">{formData.networkName}</span></p>
                    <p className="text-gray-300">Azonosító: <span className="text-blue-400">{formData.slug}</span></p>
                    <p className="text-gray-300">Admin: <span className="text-white">{formData.adminName}</span></p>
                    <p className="text-gray-300">Email: <span className="text-white">{formData.email}</span></p>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="mt-4 bg-red-900/50 border border-red-500 rounded-lg px-4 py-3 text-red-300 text-sm">
                {error}
              </div>
            )}

            {/* Navigation buttons */}
            <div className="mt-6 flex gap-4">
              {step > 1 && (
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="flex-1 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium"
                >
                  Vissza
                </button>
              )}

              {step < 3 ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Tovább
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {loading ? 'Regisztráció...' : 'Regisztráció befejezése'}
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Link to login */}
        <p className="text-center text-gray-500 text-sm mt-6">
          Már van fiókja?{' '}
          <Link href="/network-admin" className="text-blue-400 hover:text-blue-300">
            Bejelentkezés
          </Link>
        </p>
      </div>
    </div>
  );
}
