// Network Admin API client

function getApiUrl(): string {
  if (typeof window !== 'undefined') {
    // Client-side: use public API URL
    return 'https://api.vemiax.com';
  }
  // Server-side: use internal Docker network
  return 'http://vsys-app:3000';
}

const API_URL = getApiUrl();

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
  code: string;
  address: string;
  city: string;
  isActive: boolean;
  operatorCount: number;
  washEventCount: number;
  locationType?: 'CAR_WASH' | 'TRUCK_WASH';
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
const PLATFORM_VIEW_KEY = 'vsys_platform_view';
const PLATFORM_ADMIN_TOKEN_KEY = 'vsys_platform_token';

// Check if in Platform View mode
export function isPlatformViewMode(): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(PLATFORM_VIEW_KEY) !== null;
}

// Get Platform View data
export function getPlatformViewData(): { networkId: string; networkName: string } | null {
  if (typeof window === 'undefined') return null;
  const stored = sessionStorage.getItem(PLATFORM_VIEW_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

// Get Platform Admin token (from localStorage)
function getPlatformAdminToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(PLATFORM_ADMIN_TOKEN_KEY);
  }
  return null;
}

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
  // Check if we're in Platform View mode
  const platformViewData = getPlatformViewData();
  const isPlatformView = !!platformViewData;

  // Use Platform Admin token if in Platform View mode, otherwise Network Admin token
  const token = isPlatformView ? getPlatformAdminToken() : getNetworkAdminToken();

  // Build headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // In Platform View mode, add special headers
  if (isPlatformView && platformViewData) {
    headers['x-platform-view'] = 'true';
    headers['x-network-id'] = platformViewData.networkId;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    credentials: 'include', // SECURITY: Send cookies with cross-origin requests
    headers: {
      ...headers,
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
  // Check if we're in Platform View mode
  const platformViewData = getPlatformViewData();
  const isPlatformView = !!platformViewData;

  // Get networkId from Platform View or from regular session
  let networkId: string | null = null;
  if (isPlatformView && platformViewData) {
    networkId = platformViewData.networkId;
  } else {
    const admin = getNetworkAdmin();
    if (!admin) {
      throw new Error('Nincs bejelentkezve');
    }
    networkId = admin.networkId;
  }

  // Build headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-network-id': networkId,
  };

  // In Platform View mode, add special headers and use Platform Admin token
  if (isPlatformView) {
    const platformToken = getPlatformAdminToken();
    if (platformToken) {
      headers['Authorization'] = `Bearer ${platformToken}`;
    }
    headers['x-platform-view'] = 'true';
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    credentials: 'include', // SECURITY: Send cookies with cross-origin requests
    headers: {
      ...headers,
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

// Get network ID from session (supports Platform View mode)
export function getNetworkId(): string | null {
  // Check Platform View mode first
  const platformViewData = getPlatformViewData();
  if (platformViewData) {
    return platformViewData.networkId;
  }
  // Fall back to regular Network Admin session
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
      credentials: 'include', // SECURITY: Send cookies with cross-origin requests
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
      credentials: 'include',
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
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Email megerősítés sikertelen' }));
      throw new Error(error.message);
    }

    return response.json();
  },

  async resendVerificationEmail(email: string, slug: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_URL}/network-admin/resend-verification`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, slug }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Email küldés sikertelen' }));
      throw new Error(error.message);
    }

    return response.json();
  },

  async resendVerification(email: string, slug: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_URL}/network-admin/resend-verification`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, slug }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Email küldés sikertelen' }));
      throw new Error(error.message);
    }

    return response.json();
  },

  // Password Reset
  async forgotPassword(email: string, slug: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_URL}/network-admin/forgot-password`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, slug }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Hiba történt' }));
      throw new Error(error.message);
    }

    return response.json();
  },

  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_URL}/network-admin/reset-password`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Jelszó visszaállítás sikertelen' }));
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
    operationType?: 'OWN' | 'SUBCONTRACTOR';
    locationType?: 'CAR_WASH' | 'TRUCK_WASH';
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
      operationType?: 'OWN' | 'SUBCONTRACTOR';
      locationType?: 'CAR_WASH' | 'TRUCK_WASH';
      // Alvállalkozói cégadatok
      subcontractorCompanyName?: string;
      subcontractorTaxNumber?: string;
      subcontractorAddress?: string;
      subcontractorCity?: string;
      subcontractorZipCode?: string;
      subcontractorContactName?: string;
      subcontractorContactPhone?: string;
      subcontractorContactEmail?: string;
      subcontractorBankAccount?: string;
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
    billingCountry?: string;
    euVatNumber?: string;
  }): Promise<PartnerCompany> {
    return fetchWithAuth('/network-admin/partner-companies', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // VIES VAT validation
  async validateVatNumber(vatNumber: string): Promise<{
    valid: boolean;
    countryCode?: string;
    vatNumber?: string;
    name?: string;
    address?: string;
    error?: string;
  }> {
    return fetchWithAuth(`/operator/billing/validate-vat?vatNumber=${encodeURIComponent(vatNumber)}`);
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
    const response = await fetch(`${API_URL}/stripe/publishable-key`, {
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error('Failed to get Stripe publishable key');
    }
    return response.json();
  },

  async isStripeConfigured(): Promise<{ configured: boolean }> {
    const response = await fetch(`${API_URL}/stripe/configured`, {
      credentials: 'include',
    });
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

  // =========================================================================
  // INVOICES
  // =========================================================================

  async listInvoices(options?: {
    startDate?: string;
    endDate?: string;
    status?: string;
    partnerCompanyId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    data: {
      id: string;
      invoiceNumber?: string;
      status: string;
      issueDate: string;
      dueDate: string;
      paidDate?: string;
      subtotal: number;
      vatAmount: number;
      total: number;
      currency: string;
      paymentMethod?: string;
      partnerCompany: { id: string; name: string; code: string };
      itemCount: number;
      externalId?: string;
      pdfUrl?: string;
    }[];
    total: number;
  }> {
    const params = new URLSearchParams();
    if (options?.startDate) params.set('startDate', options.startDate);
    if (options?.endDate) params.set('endDate', options.endDate);
    if (options?.status) params.set('status', options.status);
    if (options?.partnerCompanyId) params.set('partnerCompanyId', options.partnerCompanyId);
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.offset) params.set('offset', String(options.offset));
    const query = params.toString() ? `?${params.toString()}` : '';
    return fetchWithAuth(`/network-admin/invoices${query}`);
  },

  async getInvoiceSummary(options?: {
    startDate?: string;
    endDate?: string;
  }): Promise<{
    totalCount: number;
    totalAmount: number;
    paidAmount: number;
    unpaidAmount: number;
    overdueAmount: number;
    draftAmount: number;
    byStatus: Record<string, { count: number; amount: number }>;
  }> {
    const params = new URLSearchParams();
    if (options?.startDate) params.set('startDate', options.startDate);
    if (options?.endDate) params.set('endDate', options.endDate);
    const query = params.toString() ? `?${params.toString()}` : '';
    return fetchWithAuth(`/network-admin/invoices/summary${query}`);
  },

  async getInvoice(id: string): Promise<{
    id: string;
    invoiceNumber?: string;
    status: string;
    issueDate: string;
    dueDate: string;
    paidDate?: string;
    subtotal: number;
    vatAmount: number;
    total: number;
    currency: string;
    paymentMethod?: string;
    externalId?: string;
    pdfUrl?: string;
    partnerCompany: {
      id: string;
      name: string;
      code: string;
      taxNumber?: string;
      billingAddress?: string;
      email?: string;
    };
    items: {
      id: string;
      description: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      vatRate: number;
    }[];
    washEvents: {
      id: string;
      status: string;
      tractorPlate?: string;
      locationName?: string;
      createdAt: string;
      totalPrice: number;
    }[];
  }> {
    return fetchWithAuth(`/network-admin/invoices/${id}`);
  },

  async prepareInvoice(data: {
    partnerCompanyId: string;
    startDate: string;
    endDate: string;
    paymentMethod?: string;
    dueDays?: number;
  }): Promise<{
    id: string;
    status: string;
    issueDate: string;
    dueDate: string;
    subtotal: number;
    vatAmount: number;
    total: number;
    currency: string;
    partnerCompany: { id: string; name: string };
    items: {
      description: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      vatRate: number;
    }[];
    washEventCount: number;
  }> {
    return fetchWithAuth('/network-admin/invoices/prepare', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async issueInvoice(id: string): Promise<{
    id: string;
    invoiceNumber: string;
    status: string;
    issueDate: string;
    issuedAt: string;
  }> {
    return fetchWithAuth(`/network-admin/invoices/${id}/issue`, {
      method: 'POST',
    });
  },

  async markInvoicePaid(id: string, data?: {
    paidDate?: string;
    paymentMethod?: string;
  }): Promise<{
    id: string;
    status: string;
    paidDate: string;
  }> {
    return fetchWithAuth(`/network-admin/invoices/${id}/mark-paid`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  },

  async cancelInvoice(id: string, reason?: string): Promise<{
    id: string;
    status: string;
    cancelledAt: string;
  }> {
    return fetchWithAuth(`/network-admin/invoices/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  async deleteInvoice(id: string): Promise<void> {
    return fetchWithAuth(`/network-admin/invoices/${id}`, {
      method: 'DELETE',
    });
  },

  async getUnbilledEvents(partnerCompanyId: string, options?: {
    startDate?: string;
    endDate?: string;
  }): Promise<{
    events: {
      id: string;
      createdAt: string;
      tractorPlate?: string;
      locationName?: string;
      driverName?: string;
      services: string[];
      totalPrice: number;
    }[];
    summary: {
      eventCount: number;
      totalAmount: number;
    };
  }> {
    const params = new URLSearchParams();
    params.set('partnerCompanyId', partnerCompanyId);
    if (options?.startDate) params.set('startDate', options.startDate);
    if (options?.endDate) params.set('endDate', options.endDate);
    return fetchWithAuth(`/network-admin/invoices/unbilled-events?${params.toString()}`);
  },

  // =========================================================================
  // EMAIL TEST
  // =========================================================================

  async testEmailConfig(testEmail: string): Promise<{ success: boolean; message: string; provider?: string }> {
    return fetchWithAuth('/network-admin/test-email', {
      method: 'POST',
      body: JSON.stringify({ testEmail }),
    });
  },

  // Opening Hours
  async getLocationOpeningHours(locationId: string): Promise<{
    locationId: string;
    locationName: string;
    hours: Array<{
      dayOfWeek: string;
      openTime: string;
      closeTime: string;
      isClosed: boolean;
    }>;
  }> {
    return fetchWithAuth(`/network-admin/locations/${locationId}/opening-hours`);
  },

  async updateLocationOpeningHours(
    locationId: string,
    hours: Array<{
      dayOfWeek: string;
      openTime: string;
      closeTime: string;
      isClosed: boolean;
    }>,
  ): Promise<{
    locationId: string;
    locationName: string;
    hours: Array<{
      dayOfWeek: string;
      openTime: string;
      closeTime: string;
      isClosed: boolean;
    }>;
  }> {
    return fetchWithAuth(`/network-admin/locations/${locationId}/opening-hours`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hours }),
    });
  },

  // =========================================================================
  // BOOKING API
  // =========================================================================

  async getBookingSettings(): Promise<{
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
  }> {
    return fetchWithAuth('/network-admin/booking-settings');
  },

  async updateBookingSettings(settings: {
    cancellationDeadlineHours?: number;
    cancellationFeePercent?: number;
    noShowFeePercent?: number;
    reminderEnabled?: boolean;
    reminderHoursBefore?: number[];
    requirePrepaymentOnline?: boolean;
    allowPayOnSiteCash?: boolean;
    allowPayOnSiteCard?: boolean;
    allowOnlineCard?: boolean;
    allowApplePay?: boolean;
    allowGooglePay?: boolean;
    stripeAccountId?: string;
    simplepayMerchantId?: string;
    simplepaySecretKey?: string;
    barionPosKey?: string;
    barionPixelId?: string;
    cancellationPolicyText?: string;
    confirmationMessage?: string;
  }): Promise<any> {
    return fetchWithAuth('/network-admin/booking-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
  },

  async listBookings(options?: {
    locationId?: string;
    dateFrom?: string;
    dateTo?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    data: any[];
    total: number;
    page: number;
    limit: number;
  }> {
    const params = new URLSearchParams();
    if (options?.locationId) params.set('locationId', options.locationId);
    if (options?.dateFrom) params.set('dateFrom', options.dateFrom);
    if (options?.dateTo) params.set('dateTo', options.dateTo);
    if (options?.status) params.set('status', options.status);
    if (options?.page) params.set('page', String(options.page));
    if (options?.limit) params.set('limit', String(options.limit));
    return fetchWithAuth(`/network-admin/bookings?${params.toString()}`);
  },

  async getBooking(id: string): Promise<any> {
    return fetchWithAuth(`/network-admin/bookings/${id}`);
  },

  async getTodaysBookings(locationId: string): Promise<any[]> {
    return fetchWithAuth(`/network-admin/bookings/today/${locationId}`);
  },

  async getAvailableSlots(options: {
    locationId: string;
    date: string;
    servicePackageId?: string;
    vehicleType?: string;
  }): Promise<Array<{
    startTime: string;
    endTime: string;
    available: boolean;
    remainingSlots: number;
  }>> {
    const params = new URLSearchParams();
    params.set('locationId', options.locationId);
    params.set('date', options.date);
    if (options.servicePackageId) params.set('servicePackageId', options.servicePackageId);
    if (options.vehicleType) params.set('vehicleType', options.vehicleType);
    return fetchWithAuth(`/network-admin/bookings/slots?${params.toString()}`);
  },

  async createBooking(data: {
    locationId: string;
    scheduledStart: string;
    servicePackageId: string;
    vehicleType: string;
    plateNumber?: string;
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
    driverId?: string;
    paymentProvider?: string;
    notes?: string;
  }): Promise<any> {
    return fetchWithAuth('/network-admin/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  async updateBooking(id: string, data: {
    scheduledStart?: string;
    servicePackageId?: string;
    vehicleType?: string;
    plateNumber?: string;
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
    notes?: string;
  }): Promise<any> {
    return fetchWithAuth(`/network-admin/bookings/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  async confirmBooking(id: string): Promise<any> {
    return fetchWithAuth(`/network-admin/bookings/${id}/confirm`, { method: 'POST' });
  },

  async cancelBooking(id: string, reason: string): Promise<any> {
    return fetchWithAuth(`/network-admin/bookings/${id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
  },

  async startBooking(id: string): Promise<any> {
    return fetchWithAuth(`/network-admin/bookings/${id}/start`, { method: 'POST' });
  },

  async completeBooking(id: string, washEventId?: string): Promise<any> {
    return fetchWithAuth(`/network-admin/bookings/${id}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ washEventId }),
    });
  },

  async markNoShow(id: string): Promise<any> {
    return fetchWithAuth(`/network-admin/bookings/${id}/no-show`, { method: 'POST' });
  },

  async listBlockedSlots(locationId?: string): Promise<any[]> {
    const params = locationId ? `?locationId=${locationId}` : '';
    return fetchWithAuth(`/network-admin/blocked-slots${params}`);
  },

  async createBlockedSlot(data: {
    locationId: string;
    startTime: string;
    endTime: string;
    reason?: string;
  }): Promise<any> {
    return fetchWithAuth('/network-admin/blocked-slots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  async createRecurringBlock(data: {
    locationId: string;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    reason?: string;
  }): Promise<any> {
    return fetchWithAuth('/network-admin/blocked-slots/recurring', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  async deleteBlockedSlot(id: string): Promise<void> {
    await fetchWithAuth(`/network-admin/blocked-slots/${id}`, { method: 'DELETE' });
  },
};

// =========================================================================
// REPORTS API
// =========================================================================

export const reportsApi = {
  async getWashStatistics(options?: {
    startDate?: string;
    endDate?: string;
    locationId?: string;
    partnerCompanyId?: string;
    groupBy?: 'day' | 'week' | 'month' | 'location' | 'partner';
  }): Promise<{
    summary: {
      totalWashes: number;
      totalRevenue: number;
      averagePrice: number;
      period: { startDate?: string; endDate?: string };
    };
    groupedData: {
      id?: string;
      label: string;
      count: number;
      revenue: number;
    }[];
    statusBreakdown: {
      status: string;
      count: number;
    }[];
  }> {
    const params = new URLSearchParams();
    if (options?.startDate) params.set('startDate', options.startDate);
    if (options?.endDate) params.set('endDate', options.endDate);
    if (options?.locationId) params.set('locationId', options.locationId);
    if (options?.partnerCompanyId) params.set('partnerCompanyId', options.partnerCompanyId);
    if (options?.groupBy) params.set('groupBy', options.groupBy);
    return fetchWithAuth(`/network-admin/reports/wash-statistics?${params.toString()}`);
  },

  async getRevenueReport(options?: {
    startDate?: string;
    endDate?: string;
    locationId?: string;
    partnerCompanyId?: string;
    groupBy?: 'day' | 'week' | 'month' | 'location' | 'partner' | 'service';
  }): Promise<{
    summary: {
      grossRevenue: number;
      netRevenue: number;
      vatAmount: number;
      washCount: number;
      period: { startDate?: string; endDate?: string };
    };
    breakdown: {
      cash: { count: number; revenue: number };
      contract: { count: number; revenue: number };
    };
    serviceBreakdown: {
      id: string;
      name: string;
      count: number;
      revenue: number;
    }[];
    dailyTrend: {
      date: string;
      revenue: number;
    }[];
  }> {
    const params = new URLSearchParams();
    if (options?.startDate) params.set('startDate', options.startDate);
    if (options?.endDate) params.set('endDate', options.endDate);
    if (options?.locationId) params.set('locationId', options.locationId);
    if (options?.partnerCompanyId) params.set('partnerCompanyId', options.partnerCompanyId);
    if (options?.groupBy) params.set('groupBy', options.groupBy);
    return fetchWithAuth(`/network-admin/reports/revenue?${params.toString()}`);
  },

  async getLocationPerformance(options?: {
    startDate?: string;
    endDate?: string;
  }): Promise<{
    summary: {
      totalLocations: number;
      totalWashes: number;
      totalRevenue: number;
      period: { startDate?: string; endDate?: string };
    };
    locations: {
      id: string;
      name: string;
      code: string;
      washCount: number;
      revenue: number;
      averagePrice: number;
      averageDurationMinutes: number;
    }[];
  }> {
    const params = new URLSearchParams();
    if (options?.startDate) params.set('startDate', options.startDate);
    if (options?.endDate) params.set('endDate', options.endDate);
    return fetchWithAuth(`/network-admin/reports/location-performance?${params.toString()}`);
  },

  async getPartnerSummary(options?: {
    startDate?: string;
    endDate?: string;
  }): Promise<{
    summary: {
      totalPartners: number;
      totalContractRevenue: number;
      totalCashRevenue: number;
      totalUnbilledAmount: number;
      period: { startDate?: string; endDate?: string };
    };
    cash: {
      washCount: number;
      revenue: number;
    };
    partners: {
      id: string;
      name: string;
      taxNumber?: string;
      billingType: string;
      washCount: number;
      revenue: number;
      billedCount: number;
      billedAmount: number;
      unbilledCount: number;
      unbilledAmount: number;
    }[];
  }> {
    const params = new URLSearchParams();
    if (options?.startDate) params.set('startDate', options.startDate);
    if (options?.endDate) params.set('endDate', options.endDate);
    return fetchWithAuth(`/network-admin/reports/partner-summary?${params.toString()}`);
  },

  async getServiceBreakdown(options?: {
    startDate?: string;
    endDate?: string;
    locationId?: string;
  }): Promise<{
    summary: {
      totalServices: number;
      totalCount: number;
      totalRevenue: number;
      period: { startDate?: string; endDate?: string };
    };
    services: {
      id: string;
      name: string;
      code: string;
      count: number;
      revenue: number;
      averagePrice: number;
      vehicleTypeBreakdown: {
        vehicleType: string;
        count: number;
      }[];
    }[];
  }> {
    const params = new URLSearchParams();
    if (options?.startDate) params.set('startDate', options.startDate);
    if (options?.endDate) params.set('endDate', options.endDate);
    if (options?.locationId) params.set('locationId', options.locationId);
    return fetchWithAuth(`/network-admin/reports/service-breakdown?${params.toString()}`);
  },

  async exportCsv(options?: {
    startDate?: string;
    endDate?: string;
    locationId?: string;
    partnerCompanyId?: string;
    status?: string;
  }): Promise<{
    filename: string;
    content: string;
    mimeType: string;
    rowCount: number;
  }> {
    const params = new URLSearchParams();
    if (options?.startDate) params.set('startDate', options.startDate);
    if (options?.endDate) params.set('endDate', options.endDate);
    if (options?.locationId) params.set('locationId', options.locationId);
    if (options?.partnerCompanyId) params.set('partnerCompanyId', options.partnerCompanyId);
    if (options?.status) params.set('status', options.status);
    return fetchWithAuth(`/network-admin/reports/export/csv?${params.toString()}`);
  },
};
