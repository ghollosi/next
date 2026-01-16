'use client';

const SESSION_KEY = 'vsys_session';
const DRIVER_KEY = 'vsys_driver';
const PENDING_LOCATION_KEY = 'vsys_pending_location';

export interface DriverInfo {
  driverId: string;
  networkId: string;
  partnerCompanyId: string | null;  // null for private customers
  firstName: string;
  lastName: string;
  partnerCompanyName: string | null;  // null for private customers
  isPrivateCustomer: boolean;
  // Billing info for private customers
  billingName?: string;
  billingAddress?: string;
  billingCity?: string;
  billingZipCode?: string;
  billingCountry?: string;
  billingTaxNumber?: string;
}

export function saveSession(sessionId: string, driver: DriverInfo): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(SESSION_KEY, sessionId);
    localStorage.setItem(DRIVER_KEY, JSON.stringify(driver));
  }
}

export function getSession(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(SESSION_KEY);
  }
  return null;
}

export function getDriver(): DriverInfo | null {
  if (typeof window !== 'undefined') {
    const data = localStorage.getItem(DRIVER_KEY);
    if (data) {
      return JSON.parse(data);
    }
  }
  return null;
}

export function clearSession(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(DRIVER_KEY);
  }
}

export function isLoggedIn(): boolean {
  return getSession() !== null;
}

// Pending location for QR code flow
export function savePendingLocation(locationCode: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(PENDING_LOCATION_KEY, locationCode);
  }
}

export function getPendingLocation(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(PENDING_LOCATION_KEY);
  }
  return null;
}

export function clearPendingLocation(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(PENDING_LOCATION_KEY);
  }
}
