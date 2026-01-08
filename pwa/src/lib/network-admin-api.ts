// Network Admin API client

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface NetworkAdminLoginResponse {
  accessToken: string;
  adminId: string;
  name: string;
  email: string;
  role: string;
  networkId: string;
  networkName: string;
  networkSlug: string;
}

interface NetworkDashboard {
  networkName: string;
  subscriptionStatus: string;
  trialEndsAt?: string;
  totalLocations: number;
  totalDrivers: number;
  totalPartnerCompanies: number;
  washEventsToday: number;
  washEventsThisMonth: number;
  revenueThisMonth: number;
  recentWashEvents: Array<{
    id: string;
    licensePlate: string;
    driverName: string;
    locationName: string;
    totalPrice: number;
    createdAt: string;
  }>;
}

interface Location {
  id: string;
  name: string;
  address: string;
  city: string;
  isActive: boolean;
  operatorCount: number;
  washEventCount: number;
}

interface PartnerCompany {
  id: string;
  name: string;
  taxNumber: string;
  isActive: boolean;
  driverCount: number;
  vehicleCount: number;
}

interface Driver {
  id: string;
  name: string;
  phone: string;
  email?: string;
  partnerCompanyName?: string;
  isActive: boolean;
  vehicleCount: number;
  washEventCount: number;
}

interface WashEvent {
  id: string;
  licensePlate: string;
  vehicleType: string;
  driverName: string;
  locationName: string;
  services: string[];
  totalPrice: number;
  currency: string;
  createdAt: string;
}

// Session management
const NETWORK_ADMIN_TOKEN_KEY = 'vsys_network_admin_token';
const NETWORK_ADMIN_DATA_KEY = 'vsys_network_admin_data';

export function saveNetworkAdminSession(
  token: string,
  admin: {
    id: string;
    name: string;
    email: string;
    role: string;
    networkId: string;
    networkName: string;
    networkSlug: string;
  },
) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(NETWORK_ADMIN_TOKEN_KEY, token);
    localStorage.setItem(NETWORK_ADMIN_DATA_KEY, JSON.stringify(admin));
  }
}

export function getNetworkAdminToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(NETWORK_ADMIN_TOKEN_KEY);
  }
  return null;
}

export function getNetworkAdmin(): {
  id: string;
  name: string;
  email: string;
  role: string;
  networkId: string;
  networkName: string;
  networkSlug: string;
} | null {
  if (typeof window !== 'undefined') {
    const data = localStorage.getItem(NETWORK_ADMIN_DATA_KEY);
    if (data) {
      try {
        return JSON.parse(data);
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function clearNetworkAdminSession() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(NETWORK_ADMIN_TOKEN_KEY);
    localStorage.removeItem(NETWORK_ADMIN_DATA_KEY);
  }
}

// API helpers
async function fetchWithAuth<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getNetworkAdminToken();

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Hiba történt' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// Helper to call operator API with networkId from session
export async function fetchOperatorApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const admin = getNetworkAdmin();
  if (!admin) {
    throw new Error('Nincs bejelentkezve');
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-network-id': admin.networkId,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Hiba történt' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// Get network ID from session
export function getNetworkId(): string | null {
  const admin = getNetworkAdmin();
  return admin?.networkId || null;
}

// Registration types
interface NetworkRegisterData {
  networkName: string;
  slug: string;
  adminName: string;
  email: string;
  password: string;
  phone: string;
  taxNumber?: string;
  companyAddress?: string;
  companyCity?: string;
  companyZipCode?: string;
  country?: string;
}

interface NetworkRegisterResponse {
  networkId: string;
  networkName: string;
  networkSlug: string;
  adminId: string;
  email: string;
  trialEndsAt: string;
  message: string;
}

interface TrialStatus {
  subscriptionStatus: string;
  trialEndsAt?: string;
  daysRemaining?: number;
  minutesRemaining?: number;
  isExpired: boolean;
  isGracePeriod: boolean;
  gracePeriodEndsAt?: string;
  isFullyLocked: boolean;
}

// Network Admin API
export const networkAdminApi = {
  // Auth
  async login(email: string, password: string, slug: string): Promise<NetworkAdminLoginResponse> {
    const response = await fetch(`${API_URL}/network-admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, slug }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Bejelentkezés sikertelen' }));
      throw new Error(error.message);
    }

    return response.json();
  },

  // Registration
  async register(data: NetworkRegisterData): Promise<NetworkRegisterResponse> {
    const response = await fetch(`${API_URL}/network-admin/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Regisztráció sikertelen' }));
      throw new Error(error.message);
    }

    return response.json();
  },

  async verifyEmail(token: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_URL}/network-admin/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Email megerősítés sikertelen' }));
      throw new Error(error.message);
    }

    return response.json();
  },

  async resendVerification(email: string, slug: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_URL}/network-admin/resend-verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, slug }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Email küldés sikertelen' }));
      throw new Error(error.message);
    }

    return response.json();
  },

  // Trial Status
  async getTrialStatus(): Promise<TrialStatus> {
    return fetchWithAuth('/network-admin/trial-status');
  },

  // Dashboard
  async getDashboard(): Promise<NetworkDashboard> {
    return fetchWithAuth('/network-admin/dashboard');
  },

  // Locations
  async listLocations(): Promise<Location[]> {
    return fetchWithAuth('/network-admin/locations');
  },

  async createLocation(data: {
    name: string;
    address: string;
    city: string;
    postalCode?: string;
    phone?: string;
    email?: string;
    openingHours?: any;
    latitude?: number;
    longitude?: number;
  }): Promise<Location> {
    // Convert openingHours object to JSON string if provided
    const requestData = { ...data };
    if (data.openingHours && typeof data.openingHours === 'object') {
      requestData.openingHours = JSON.stringify(data.openingHours);
    }
    return fetchWithAuth('/network-admin/locations', {
      method: 'POST',
      body: JSON.stringify(requestData),
    });
  },

  async updateLocation(
    id: string,
    data: {
      name?: string;
      address?: string;
      city?: string;
      postalCode?: string;
      openingHours?: string;
      phone?: string;
      email?: string;
      code?: string;
      country?: string;
      timezone?: string;
      latitude?: number;
      longitude?: number;
      isActive?: boolean;
    },
  ): Promise<Location> {
    return fetchWithAuth(`/network-admin/locations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteLocation(id: string): Promise<void> {
    return fetchWithAuth(`/network-admin/locations/${id}`, {
      method: 'DELETE',
    });
  },

  // Partner Companies
  async listPartnerCompanies(): Promise<PartnerCompany[]> {
    return fetchWithAuth('/network-admin/partner-companies');
  },

  async createPartnerCompany(data: {
    name: string;
    taxNumber: string;
    billingAddress?: string;
    contactEmail?: string;
    contactPhone?: string;
  }): Promise<PartnerCompany> {
    return fetchWithAuth('/network-admin/partner-companies', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Drivers
  async listDrivers(): Promise<Driver[]> {
    return fetchWithAuth('/network-admin/drivers');
  },

  // Wash Events
  async listWashEvents(options?: { limit?: number; offset?: number }): Promise<WashEvent[]> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.offset) params.set('offset', String(options.offset));
    const query = params.toString() ? `?${params.toString()}` : '';
    return fetchWithAuth(`/network-admin/wash-events${query}`);
  },

  // Service Packages
  async listServicePackages(): Promise<any[]> {
    return fetchWithAuth('/network-admin/service-packages');
  },

  async createServicePackage(data: {
    name: string;
    code: string;
    description?: string;
  }): Promise<any> {
    return fetchWithAuth('/network-admin/service-packages', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateServicePackage(
    id: string,
    data: { name?: string; code?: string; description?: string; isActive?: boolean },
  ): Promise<any> {
    return fetchWithAuth(`/network-admin/service-packages/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteServicePackage(id: string): Promise<void> {
    return fetchWithAuth(`/network-admin/service-packages/${id}`, {
      method: 'DELETE',
    });
  },

  // Prices
  async listPrices(): Promise<any[]> {
    return fetchWithAuth('/network-admin/prices');
  },

  async createPrice(data: {
    servicePackageId: string;
    vehicleType: string;
    price: number;
  }): Promise<any> {
    return fetchWithAuth('/network-admin/prices', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updatePrice(
    id: string,
    data: { servicePackageId?: string; vehicleType?: string; price?: number },
  ): Promise<any> {
    return fetchWithAuth(`/network-admin/prices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deletePrice(id: string): Promise<void> {
    return fetchWithAuth(`/network-admin/prices/${id}`, {
      method: 'DELETE',
    });
  },

  // Settings
  async getSettings(): Promise<any> {
    return fetchWithAuth('/network-admin/settings');
  },

  async updateSettings(data: any): Promise<any> {
    return fetchWithAuth('/network-admin/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // VAT Rates
  async listVatRates(): Promise<any[]> {
    return fetchWithAuth('/network-admin/vat-rates');
  },

  async createVatRate(data: {
    name: string;
    rate: number;
    code?: string;
    isDefault?: boolean;
  }): Promise<any> {
    return fetchWithAuth('/network-admin/vat-rates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateVatRate(
    id: string,
    data: { name?: string; rate?: number; code?: string; isDefault?: boolean; isActive?: boolean },
  ): Promise<any> {
    return fetchWithAuth(`/network-admin/vat-rates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteVatRate(id: string): Promise<void> {
    return fetchWithAuth(`/network-admin/vat-rates/${id}`, {
      method: 'DELETE',
    });
  },

  // Currencies
  async listCurrencies(): Promise<any[]> {
    return fetchWithAuth('/network-admin/currencies');
  },

  async addCurrency(data: {
    currencyCode: string;
    currencyName?: string;
    currencySymbol?: string;
    isDefault?: boolean;
  }): Promise<any> {
    return fetchWithAuth('/network-admin/currencies', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateCurrency(
    id: string,
    data: { currencyName?: string; currencySymbol?: string; isDefault?: boolean; isActive?: boolean },
  ): Promise<any> {
    return fetchWithAuth(`/network-admin/currencies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async removeCurrency(id: string): Promise<void> {
    return fetchWithAuth(`/network-admin/currencies/${id}`, {
      method: 'DELETE',
    });
  },

  // =========================================================================
  // SUBSCRIPTION / BILLING (Stripe)
  // =========================================================================

  async getSubscription(): Promise<{
    status: string;
    currentPeriodStart?: string;
    currentPeriodEnd?: string;
    cancelAtPeriodEnd: boolean;
    trialEnd?: string | null;
    baseMonthlyFee?: number;
    perWashFee?: number;
    currentUsage?: number;
    hasPaymentMethod: boolean;
  }> {
    return fetchWithAuth('/network-admin/subscription');
  },

  async createCheckoutSession(data: {
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ sessionId: string; url: string }> {
    return fetchWithAuth('/network-admin/create-checkout-session', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async createBillingPortal(data: {
    returnUrl: string;
  }): Promise<{ url: string }> {
    return fetchWithAuth('/network-admin/billing-portal', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async cancelSubscription(): Promise<{ message: string }> {
    return fetchWithAuth('/network-admin/cancel-subscription', {
      method: 'POST',
    });
  },

  async reactivateSubscription(): Promise<{ message: string }> {
    return fetchWithAuth('/network-admin/reactivate-subscription', {
      method: 'POST',
    });
  },

  async getStripePublishableKey(): Promise<{ publishableKey: string | null }> {
    const response = await fetch(`${API_URL}/stripe/publishable-key`);
    if (!response.ok) {
      throw new Error('Failed to get Stripe publishable key');
    }
    return response.json();
  },

  async isStripeConfigured(): Promise<{ configured: boolean }> {
    const response = await fetch(`${API_URL}/stripe/configured`);
    if (!response.ok) {
      return { configured: false };
    }
    return response.json();
  },

  // =========================================================================
  // LOCATION OPERATORS
  // =========================================================================

  async listLocationOperators(locationId: string): Promise<{
    id: string;
    name: string;
    isActive: boolean;
    createdAt: string;
  }[]> {
    return fetchWithAuth(`/network-admin/locations/${locationId}/operators`);
  },

  async createLocationOperator(locationId: string, data: {
    name: string;
    pin: string;
  }): Promise<{ id: string; name: string; isActive: boolean }> {
    return fetchWithAuth(`/network-admin/locations/${locationId}/operators`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateLocationOperator(operatorId: string, data: {
    name?: string;
    pin?: string;
    isActive?: boolean;
  }): Promise<{ id: string; name: string; isActive: boolean }> {
    return fetchWithAuth(`/network-admin/operators/${operatorId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteLocationOperator(operatorId: string): Promise<void> {
    return fetchWithAuth(`/network-admin/operators/${operatorId}`, {
      method: 'DELETE',
    });
  },

  // =========================================================================
  // WASH DELETE REQUESTS
  // =========================================================================

  async listDeleteRequests(status?: string): Promise<{
    id: string;
    washEventId: string;
    requestedBy: string;
    reason: string;
    status: string;
    reviewedBy?: string;
    reviewedAt?: string;
    reviewNote?: string;
    createdAt: string;
    washEvent: {
      id: string;
      licensePlate: string;
      vehicleType: string;
      totalPrice: number;
      createdAt: string;
      location: { name: string };
      driver?: { name: string };
    };
  }[]> {
    const query = status ? `?status=${status}` : '';
    return fetchWithAuth(`/network-admin/delete-requests${query}`);
  },

  async approveDeleteRequest(requestId: string, note?: string): Promise<{ message: string }> {
    return fetchWithAuth(`/network-admin/delete-requests/${requestId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    });
  },

  async rejectDeleteRequest(requestId: string, note?: string): Promise<{ message: string }> {
    return fetchWithAuth(`/network-admin/delete-requests/${requestId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    });
  },

  // =========================================================================
  // AUDIT LOGS
  // =========================================================================

  async getAuditLogs(queryString?: string): Promise<{
    data: {
      id: string;
      action: string;
      actorType: string;
      actorId?: string;
      createdAt: string;
      previousData?: any;
      newData?: any;
      metadata?: any;
      ipAddress?: string;
      washEvent?: {
        id: string;
        status: string;
        tractorPlateManual?: string;
        trailerPlateManual?: string;
        location?: {
          name: string;
          code: string;
        };
      };
    }[];
    total: number;
  }> {
    const query = queryString ? `?${queryString}` : '';
    return fetchWithAuth(`/network-admin/audit-logs${query}`);
  },

  async getWashEventAuditLogs(washEventId: string): Promise<{
    id: string;
    action: string;
    actorType: string;
    actorId?: string;
    createdAt: string;
    previousData?: any;
    newData?: any;
    metadata?: any;
  }[]> {
    return fetchWithAuth(`/network-admin/audit-logs/wash-event/${washEventId}`);
  },

  // =========================================================================
  // LOCATION SERVICES
  // =========================================================================

  async listLocationServices(locationId: string): Promise<{
    id: string;
    servicePackageId: string;
    servicePackageName: string;
    servicePackageCode: string;
    isActive: boolean;
  }[]> {
    return fetchWithAuth(`/network-admin/locations/${locationId}/services`);
  },

  async addLocationService(locationId: string, servicePackageId: string): Promise<{
    id: string;
    servicePackageId: string;
    servicePackageName: string;
    servicePackageCode: string;
    isActive: boolean;
  }> {
    return fetchWithAuth(`/network-admin/locations/${locationId}/services`, {
      method: 'POST',
      body: JSON.stringify({ servicePackageId }),
    });
  },

  async removeLocationService(locationId: string, servicePackageId: string): Promise<void> {
    return fetchWithAuth(`/network-admin/locations/${locationId}/services/${servicePackageId}`, {
      method: 'DELETE',
    });
  },
};
