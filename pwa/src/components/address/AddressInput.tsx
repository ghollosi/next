'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDebounce } from '@/hooks/useDebounce';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

interface PostalCodeResult {
  postalCode: string;
  city: string;
  state?: string;
  countryCode: string;
  latitude?: number;
  longitude?: number;
}

interface StreetSuggestion {
  street: string;
  fullAddress: string;
  city: string;
  postalCode: string;
  countryCode: string;
  latitude?: number;
  longitude?: number;
}

export interface AddressData {
  postalCode: string;
  city: string;
  street: string;
  country: string;
  latitude?: number;
  longitude?: number;
}

interface AddressInputProps {
  value: AddressData;
  onChange: (data: AddressData) => void;
  defaultCountry?: string;
  showCountry?: boolean;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  labels?: {
    postalCode?: string;
    city?: string;
    street?: string;
    country?: string;
  };
  placeholders?: {
    postalCode?: string;
    city?: string;
    street?: string;
  };
}

// Country list for EU
const COUNTRIES = [
  { code: 'HU', name: 'Magyarorszag' },
  { code: 'AT', name: 'Ausztria' },
  { code: 'SK', name: 'Szlovakia' },
  { code: 'RO', name: 'Romania' },
  { code: 'SI', name: 'Szlovenia' },
  { code: 'HR', name: 'Horvatorszag' },
  { code: 'DE', name: 'Nemetorszag' },
  { code: 'CZ', name: 'Csehorszag' },
  { code: 'PL', name: 'Lengyelorszag' },
  { code: 'IT', name: 'Olaszorszag' },
  { code: 'FR', name: 'Franciaorszag' },
  { code: 'NL', name: 'Hollandia' },
  { code: 'BE', name: 'Belgium' },
  { code: 'ES', name: 'Spanyolorszag' },
];

export function AddressInput({
  value,
  onChange,
  defaultCountry = 'HU',
  showCountry = true,
  required = false,
  disabled = false,
  className = '',
  labels = {},
  placeholders = {},
}: AddressInputProps) {
  const [postalCodeSuggestions, setPostalCodeSuggestions] = useState<PostalCodeResult[]>([]);
  const [streetSuggestions, setStreetSuggestions] = useState<StreetSuggestion[]>([]);
  const [showPostalSuggestions, setShowPostalSuggestions] = useState(false);
  const [showStreetSuggestions, setShowStreetSuggestions] = useState(false);
  const [isLoadingPostal, setIsLoadingPostal] = useState(false);
  const [isLoadingStreet, setIsLoadingStreet] = useState(false);
  const [cityLocked, setCityLocked] = useState(false);

  const postalRef = useRef<HTMLDivElement>(null);
  const streetRef = useRef<HTMLDivElement>(null);

  const debouncedPostalCode = useDebounce(value.postalCode, 300);
  const debouncedStreet = useDebounce(value.street, 400);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (postalRef.current && !postalRef.current.contains(e.target as Node)) {
        setShowPostalSuggestions(false);
      }
      if (streetRef.current && !streetRef.current.contains(e.target as Node)) {
        setShowStreetSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Lookup postal code
  useEffect(() => {
    const lookupPostalCode = async () => {
      if (!debouncedPostalCode || debouncedPostalCode.length < 2) {
        setPostalCodeSuggestions([]);
        return;
      }

      setIsLoadingPostal(true);
      try {
        const country = value.country || defaultCountry;
        const response = await fetch(
          `${API_URL}/api/address/postal-code/lookup?code=${encodeURIComponent(debouncedPostalCode)}&country=${country}`
        );

        if (response.ok) {
          const data: PostalCodeResult[] = await response.json();
          setPostalCodeSuggestions(data);

          // Auto-fill city if only one result
          if (data.length === 1 && debouncedPostalCode === data[0].postalCode) {
            onChange({
              ...value,
              city: data[0].city,
              latitude: data[0].latitude,
              longitude: data[0].longitude,
            });
            setCityLocked(true);
            setShowPostalSuggestions(false);
          } else if (data.length > 0) {
            setShowPostalSuggestions(true);
          }
        }
      } catch (error) {
        console.error('Error looking up postal code:', error);
      } finally {
        setIsLoadingPostal(false);
      }
    };

    lookupPostalCode();
  }, [debouncedPostalCode, value.country, defaultCountry]);

  // Street autocomplete
  useEffect(() => {
    const fetchStreetSuggestions = async () => {
      if (!debouncedStreet || debouncedStreet.length < 3 || !value.city) {
        setStreetSuggestions([]);
        return;
      }

      setIsLoadingStreet(true);
      try {
        const country = value.country || defaultCountry;
        const response = await fetch(
          `${API_URL}/api/address/street/suggest?q=${encodeURIComponent(debouncedStreet)}&city=${encodeURIComponent(value.city)}&country=${country}&limit=5`
        );

        if (response.ok) {
          const data: StreetSuggestion[] = await response.json();
          setStreetSuggestions(data);
          if (data.length > 0) {
            setShowStreetSuggestions(true);
          }
        }
      } catch (error) {
        console.error('Error fetching street suggestions:', error);
      } finally {
        setIsLoadingStreet(false);
      }
    };

    fetchStreetSuggestions();
  }, [debouncedStreet, value.city, value.country, defaultCountry]);

  const handlePostalCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setCityLocked(false);
    onChange({
      ...value,
      postalCode: newValue,
      city: '', // Clear city when postal code changes
    });
  };

  const handleCityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (cityLocked) return;
    onChange({
      ...value,
      city: e.target.value,
    });
  };

  const handleStreetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...value,
      street: e.target.value,
    });
  };

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({
      ...value,
      country: e.target.value,
      postalCode: '',
      city: '',
    });
    setCityLocked(false);
  };

  const selectPostalCode = (suggestion: PostalCodeResult) => {
    onChange({
      ...value,
      postalCode: suggestion.postalCode,
      city: suggestion.city,
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
    });
    setCityLocked(true);
    setShowPostalSuggestions(false);
  };

  const selectStreet = (suggestion: StreetSuggestion) => {
    onChange({
      ...value,
      street: suggestion.street,
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
    });
    setShowStreetSuggestions(false);
  };

  const unlockCity = () => {
    setCityLocked(false);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Country selector */}
      {showCountry && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {labels.country || 'Orszag'}
          </label>
          <select
            value={value.country || defaultCountry}
            onChange={handleCountryChange}
            disabled={disabled}
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-primary-500 focus:ring-0 focus:outline-none bg-white"
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Postal code and city row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Postal code */}
        <div ref={postalRef} className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {labels.postalCode || 'Iranyitoszam'} {required && '*'}
          </label>
          <div className="relative">
            <input
              type="text"
              value={value.postalCode}
              onChange={handlePostalCodeChange}
              disabled={disabled}
              required={required}
              placeholder={placeholders.postalCode || 'pl. 1234'}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-primary-500 focus:ring-0 focus:outline-none"
            />
            {isLoadingPostal && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <svg className="animate-spin h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            )}
          </div>

          {/* Postal code suggestions dropdown */}
          {showPostalSuggestions && postalCodeSuggestions.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-auto">
              {postalCodeSuggestions.map((suggestion, index) => (
                <button
                  key={`${suggestion.postalCode}-${index}`}
                  type="button"
                  onClick={() => selectPostalCode(suggestion)}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none border-b border-gray-100 last:border-b-0"
                >
                  <span className="font-medium">{suggestion.postalCode}</span>
                  <span className="text-gray-500 ml-2">{suggestion.city}</span>
                  {suggestion.state && (
                    <span className="text-gray-400 text-sm ml-1">({suggestion.state})</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* City */}
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {labels.city || 'Varos'} {required && '*'}
            {cityLocked && (
              <button
                type="button"
                onClick={unlockCity}
                className="ml-2 text-xs text-primary-600 hover:text-primary-700"
              >
                (modositas)
              </button>
            )}
          </label>
          <input
            type="text"
            value={value.city}
            onChange={handleCityChange}
            disabled={disabled || cityLocked}
            required={required}
            placeholder={placeholders.city || 'pl. Budapest'}
            className={`w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-primary-500 focus:ring-0 focus:outline-none ${
              cityLocked ? 'bg-gray-50 text-gray-700' : ''
            }`}
          />
        </div>
      </div>

      {/* Street address */}
      <div ref={streetRef} className="relative">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {labels.street || 'Cim (utca, hazszam)'} {required && '*'}
        </label>
        <div className="relative">
          <input
            type="text"
            value={value.street}
            onChange={handleStreetChange}
            disabled={disabled}
            required={required}
            placeholder={placeholders.street || 'pl. Fo utca 1.'}
            className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:border-primary-500 focus:ring-0 focus:outline-none"
          />
          {isLoadingStreet && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <svg className="animate-spin h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          )}
        </div>

        {/* Street suggestions dropdown */}
        {showStreetSuggestions && streetSuggestions.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-auto">
            {streetSuggestions.map((suggestion, index) => (
              <button
                key={`${suggestion.street}-${index}`}
                type="button"
                onClick={() => selectStreet(suggestion)}
                className="w-full px-4 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none border-b border-gray-100 last:border-b-0"
              >
                <div className="font-medium">{suggestion.street}</div>
                <div className="text-xs text-gray-500 truncate">{suggestion.fullAddress}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Hidden fields for coordinates */}
      {value.latitude && value.longitude && (
        <div className="text-xs text-gray-400">
          GPS: {value.latitude.toFixed(4)}, {value.longitude.toFixed(4)}
        </div>
      )}
    </div>
  );
}

export default AddressInput;
