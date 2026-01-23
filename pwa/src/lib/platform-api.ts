// Platform Admin API client

function getApiUrl(): string {
  if (typeof window !== 'undefined') {
    // Client-side: use public API URL
    return process.env.NEXT_PUBLIC_API_URL || 'https://api.vemiax.com';
  }
  // Server-side: use internal Docker network
  return 'http://vsys-api:3000';
}

interface PlatformLoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  adminId: string;
  name: string;
  email: string;
  role: 'PLATFORM_OWNER' | 'PLATFORM_ADMIN';
}

interface NetworkListItem {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  subscriptionStatus: 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
  trialEndsAt?: string;
  country: string;
  defaultCurrency: string;
  createdAt: string;
  locationCount: number;
  driverCount: number;
  washEventCount: number;
}

interface NetworkDetail extends NetworkListItem {
  timezone: string;
  defaultLanguage: string;
  subscriptionStartAt?: string;
  subscriptionEndAt?: string;
  partnerCompanyCount: number;
  // Egyedi árazás
  customMonthlyFee?: number | null;
  customPerWashFee?: number | null;
  pricingNotes?: string | null;
  // Platform alapértelmezett
  platformMonthlyFee?: number;
  platformPerWashFee?: number;
  // Effektív (használt) árak
  effectiveMonthlyFee: number;
  effectivePerWashFee: number;
  // Platform számlázási adatok (a Platform ezeket használja számlázáskor)
  billingCompanyName?: string;
  billingAddress?: string;
  billingCity?: string;
  billingZipCode?: string;
  billingCountry?: string;
  billingTaxNumber?: string;
  billingEuVatNumber?: string;
  billingEmail?: string;
  billingDataComplete: boolean;
}

interface NetworkAdmin {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

interface PlatformAdmin {
  id: string;
  email: string;
  name: string;
  role: 'PLATFORM_OWNER' | 'PLATFORM_ADMIN';
  isActive: boolean;
  recoveryEmail?: string;
  lastLoginAt?: string;
  createdAt: string;
}

interface PlatformDashboard {
  totalNetworks: number;
  activeNetworks: number;
  trialNetworks: number;
  totalLocations: number;
  totalDrivers: number;
  washEventsThisMonth: number;
  revenueThisMonth: number;
  networksExpiringSoon: NetworkListItem[];
}

interface PlatformSettings {
  id: string;
  platformName: string;
  platformUrl?: string;
  supportEmail?: string;
  supportPhone?: string;
  // Company data
  companyName?: string;
  companyAddress?: string;
  companyCity?: string;
  companyZipCode?: string;
  companyCountry?: string;
  taxNumber?: string;
  euVatNumber?: string;
  bankAccountNumber?: string;
  bankAccountIban?: string;
  bankName?: string;
  // Pricing
  defaultTrialDays: number;
  baseMonthlyFee: number;
  perWashFee: number;
  // Status flags
  emailConfigured: boolean;
  smsConfigured: boolean;
  stripeConfigured: boolean;
  invoiceConfigured: boolean;
  invoiceProvider: string;
  // Invoice provider settings
  szamlazzAgentKey?: string;
  billingoApiKey?: string;
  billingoBlockId?: number;
  billingoBankAccountId?: number;
}

// ========== Billing Types ==========

type PlatformInvoiceStatus = 'DRAFT' | 'ISSUED' | 'SENT' | 'PAID' | 'CANCELLED' | 'OVERDUE';

interface PlatformInvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface PlatformInvoice {
  id: string;
  networkId: string;
  invoiceNumber?: string;
  externalId?: string;
  periodStart: string;
  periodEnd: string;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  currency: string;
  status: PlatformInvoiceStatus;
  issueDate?: string;
  dueDate?: string;
  paidDate?: string;
  cancelledAt?: string;
  cancelReason?: string;
  // Buyer data
  buyerName?: string;
  buyerAddress?: string;
  buyerCity?: string;
  buyerZipCode?: string;
  buyerCountry?: string;
  buyerTaxNumber?: string;
  buyerEuVatNumber?: string;
  // Seller data
  sellerName?: string;
  sellerAddress?: string;
  sellerCity?: string;
  sellerZipCode?: string;
  sellerCountry?: string;
  sellerTaxNumber?: string;
  sellerBankAccount?: string;
  // Relations
  network?: NetworkListItem;
  items?: PlatformInvoiceItem[];
  createdAt: string;
  updatedAt: string;
}

interface BillingSummary {
  invoicesByStatus: { status: PlatformInvoiceStatus; count: number; total: number }[];
  thisMonthRevenue: number;
  lastMonthRevenue: number;
  outstandingAmount: number;
  outstandingCount: number;
  activeNetworks: number;
}

interface InvoiceFilters {
  networkId?: string;
  status?: PlatformInvoiceStatus;
  issueDateFrom?: string;
  issueDateTo?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
}

interface UsagePreview {
  network: NetworkListItem;
  periodStart: string;
  periodEnd: string;
  locationCount: number;
  baseMonthlyFee: number;
  washCount: number;
  perWashFee: number;
  washTotal: number;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  currency: string;
}

// Session management
const PLATFORM_TOKEN_KEY = 'vsys_platform_token';
const PLATFORM_REFRESH_TOKEN_KEY = 'vsys_platform_refresh_token';
const PLATFORM_TOKEN_EXPIRY_KEY = 'vsys_platform_token_expiry';
const PLATFORM_ADMIN_KEY = 'vsys_platform_admin';

// Token refresh margin - refresh 2 minutes before expiry
const TOKEN_REFRESH_MARGIN_MS = 2 * 60 * 1000;

export function savePlatformSession(
  token: string,
  admin: { id: string; name: string; email: string; role: string },
  refreshToken?: string,
  expiresIn?: number
) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(PLATFORM_TOKEN_KEY, token);
    localStorage.setItem(PLATFORM_ADMIN_KEY, JSON.stringify(admin));
    if (refreshToken) {
      localStorage.setItem(PLATFORM_REFRESH_TOKEN_KEY, refreshToken);
    }
    if (expiresIn) {
      // Store expiry timestamp
      const expiryTime = Date.now() + (expiresIn * 1000);
      localStorage.setItem(PLATFORM_TOKEN_EXPIRY_KEY, String(expiryTime));
    }
  }
}

export function getPlatformToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(PLATFORM_TOKEN_KEY);
  }
  return null;
}

export function getPlatformRefreshToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(PLATFORM_REFRESH_TOKEN_KEY);
  }
  return null;
}

export function getTokenExpiry(): number | null {
  if (typeof window !== 'undefined') {
    const expiry = localStorage.getItem(PLATFORM_TOKEN_EXPIRY_KEY);
    return expiry ? parseInt(expiry, 10) : null;
  }
  return null;
}

export function isTokenExpiringSoon(): boolean {
  const expiry = getTokenExpiry();
  if (!expiry) return true; // No expiry info, assume expired
  return Date.now() > (expiry - TOKEN_REFRESH_MARGIN_MS);
}

export function getPlatformAdmin(): { id: string; name: string; email: string; role: string } | null {
  if (typeof window !== 'undefined') {
    const data = localStorage.getItem(PLATFORM_ADMIN_KEY);
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

export function clearPlatformSession() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(PLATFORM_TOKEN_KEY);
    localStorage.removeItem(PLATFORM_REFRESH_TOKEN_KEY);
    localStorage.removeItem(PLATFORM_TOKEN_EXPIRY_KEY);
    localStorage.removeItem(PLATFORM_ADMIN_KEY);
  }
}

// Token refresh state to prevent concurrent refreshes
let isRefreshing = false;
let refreshPromise: Promise<string> | null = null;

// Refresh the access token using refresh token
async function refreshAccessToken(): Promise<string> {
  const refreshToken = getPlatformRefreshToken();
  if (!refreshToken) {
    clearPlatformSession();
    throw new Error('Nincs refresh token, újra be kell jelentkezni');
  }

  const response = await fetch(`${getApiUrl()}/platform-admin/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    clearPlatformSession();
    throw new Error('Token frissítés sikertelen, újra be kell jelentkezni');
  }

  const data = await response.json();

  // Update stored tokens
  const admin = getPlatformAdmin();
  if (admin) {
    savePlatformSession(data.accessToken, admin, data.refreshToken, data.expiresIn);
  }

  return data.accessToken;
}

// Get valid token, refreshing if necessary
async function getValidToken(): Promise<string | null> {
  const token = getPlatformToken();
  if (!token) return null;

  // Check if token is expiring soon
  if (isTokenExpiringSoon()) {
    // Prevent concurrent refresh attempts
    if (isRefreshing && refreshPromise) {
      return refreshPromise;
    }

    isRefreshing = true;
    refreshPromise = refreshAccessToken()
      .finally(() => {
        isRefreshing = false;
        refreshPromise = null;
      });

    try {
      return await refreshPromise;
    } catch {
      // If refresh fails, return original token (will fail with 401)
      return token;
    }
  }

  return token;
}

// API helpers
async function fetchWithAuth<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  let token = await getValidToken();

  const makeRequest = async (authToken: string | null) => {
    return fetch(`${getApiUrl()}${endpoint}`, {
      ...options,
      credentials: 'include', // SECURITY: Send cookies with cross-origin requests
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...options.headers,
      },
    });
  };

  let response = await makeRequest(token);

  // If 401, try to refresh token and retry once
  if (response.status === 401 && getPlatformRefreshToken()) {
    try {
      token = await refreshAccessToken();
      response = await makeRequest(token);
    } catch {
      clearPlatformSession();
      // Redirect to login
      if (typeof window !== 'undefined') {
        window.location.href = '/platform-admin';
      }
      throw new Error('Session lejárt, kérjük jelentkezz be újra');
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Hiba történt' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// Platform Admin API
export const platformApi = {
  // Auth
  async login(email: string, password: string): Promise<PlatformLoginResponse> {
    const response = await fetch(`${getApiUrl()}/platform-admin/login`, {
      method: 'POST',
      credentials: 'include', // SECURITY: Send cookies with cross-origin requests
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Bejelentkezés sikertelen' }));
      throw new Error(error.message);
    }

    return response.json();
  },

  // Dashboard
  async getDashboard(): Promise<PlatformDashboard> {
    return fetchWithAuth('/platform-admin/dashboard');
  },

  // Reports
  async getReports(period: 'month' | 'quarter' | 'year' = 'month'): Promise<{
    networkStats: Array<{
      id: string;
      name: string;
      slug: string;
      subscriptionStatus: string;
      washEventsThisMonth: number;
      washEventsLastMonth: number;
      totalWashEvents: number;
      activeDrivers: number;
      activeLocations: number;
      revenue: number;
    }>;
    monthlyStats: Array<{
      month: string;
      washEvents: number;
      revenue: number;
      newNetworks: number;
      newDrivers: number;
    }>;
    totals: {
      totalWashEvents: number;
      totalRevenue: number;
      avgWashesPerNetwork: number;
      avgWashesPerLocation: number;
    };
  }> {
    return fetchWithAuth(`/platform-admin/reports?period=${period}`);
  },

  // Settings
  async getSettings(): Promise<PlatformSettings> {
    return fetchWithAuth('/platform-admin/settings');
  },

  async updateSettings(data: Partial<PlatformSettings>): Promise<PlatformSettings> {
    return fetchWithAuth('/platform-admin/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Networks
  async listNetworks(): Promise<NetworkListItem[]> {
    return fetchWithAuth('/platform-admin/networks');
  },

  async getNetwork(id: string): Promise<NetworkDetail> {
    return fetchWithAuth(`/platform-admin/networks/${id}`);
  },

  async listNetworkLocations(networkId: string): Promise<any[]> {
    return fetchWithAuth(`/platform-admin/networks/${networkId}/locations`);
  },

  async createNetwork(data: {
    name: string;
    slug: string;
    country?: string;
    timezone?: string;
    defaultCurrency?: string;
    ownerEmail?: string;
    ownerName?: string;
    ownerPassword?: string;
  }): Promise<NetworkDetail> {
    return fetchWithAuth('/platform-admin/networks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateNetwork(id: string, data: Partial<NetworkDetail>): Promise<NetworkDetail> {
    return fetchWithAuth(`/platform-admin/networks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteNetwork(id: string): Promise<void> {
    return fetchWithAuth(`/platform-admin/networks/${id}`, {
      method: 'DELETE',
    });
  },

  // Platform Admin management
  async listAdmins(): Promise<PlatformAdmin[]> {
    return fetchWithAuth('/platform-admin/admins');
  },

  async getAdmin(adminId: string): Promise<PlatformAdmin> {
    return fetchWithAuth(`/platform-admin/admins/${adminId}`);
  },

  async createAdmin(data: {
    email: string;
    password: string;
    name: string;
    role?: 'PLATFORM_OWNER' | 'PLATFORM_ADMIN';
    recoveryEmail?: string;
  }): Promise<{ id: string; email: string }> {
    return fetchWithAuth('/platform-admin/admins', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateAdmin(adminId: string, data: {
    name?: string;
    role?: 'PLATFORM_OWNER' | 'PLATFORM_ADMIN';
    isActive?: boolean;
    password?: string;
    recoveryEmail?: string;
  }): Promise<PlatformAdmin> {
    return fetchWithAuth(`/platform-admin/admins/${adminId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteAdmin(adminId: string): Promise<void> {
    return fetchWithAuth(`/platform-admin/admins/${adminId}`, {
      method: 'DELETE',
    });
  },

  // Password reset
  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const response = await fetch(`${getApiUrl()}/platform-admin/request-password-reset`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Hiba történt' }));
      throw new Error(error.message);
    }

    return response.json();
  },

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const response = await fetch(`${getApiUrl()}/platform-admin/reset-password`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Hiba történt' }));
      throw new Error(error.message);
    }

    return response.json();
  },

  // Emergency access
  async generateEmergencyToken(): Promise<{ token: string; expiresAt: string; message: string }> {
    return fetchWithAuth('/platform-admin/generate-emergency-token', {
      method: 'POST',
    });
  },

  async emergencyLogin(token: string): Promise<PlatformLoginResponse> {
    const response = await fetch(`${getApiUrl()}/platform-admin/emergency-login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Érvénytelen token' }));
      throw new Error(error.message);
    }

    return response.json();
  },

  // Network Admin management
  async listNetworkAdmins(networkId: string): Promise<NetworkAdmin[]> {
    return fetchWithAuth(`/platform-admin/networks/${networkId}/admins`);
  },

  async getNetworkAdmin(networkId: string, adminId: string): Promise<NetworkAdmin> {
    return fetchWithAuth(`/platform-admin/networks/${networkId}/admins/${adminId}`);
  },

  async createNetworkAdmin(networkId: string, data: {
    email: string;
    name: string;
    password: string;
    role?: string;
  }): Promise<NetworkAdmin> {
    return fetchWithAuth(`/platform-admin/networks/${networkId}/admins`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateNetworkAdmin(networkId: string, adminId: string, data: {
    name?: string;
    role?: string;
    isActive?: boolean;
    password?: string;
  }): Promise<NetworkAdmin> {
    return fetchWithAuth(`/platform-admin/networks/${networkId}/admins/${adminId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteNetworkAdmin(networkId: string, adminId: string): Promise<void> {
    return fetchWithAuth(`/platform-admin/networks/${networkId}/admins/${adminId}`, {
      method: 'DELETE',
    });
  },

  // ========== Billing ==========

  // Get billing summary for dashboard
  async getBillingSummary(): Promise<BillingSummary> {
    return fetchWithAuth('/platform-admin/billing/summary');
  },

  // Get all platform invoices with optional filters
  async getInvoices(filters?: InvoiceFilters): Promise<PlatformInvoice[]> {
    const params = new URLSearchParams();
    if (filters?.networkId) params.append('networkId', filters.networkId);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.issueDateFrom) params.append('issueDateFrom', filters.issueDateFrom);
    if (filters?.issueDateTo) params.append('issueDateTo', filters.issueDateTo);
    if (filters?.dueDateFrom) params.append('dueDateFrom', filters.dueDateFrom);
    if (filters?.dueDateTo) params.append('dueDateTo', filters.dueDateTo);

    const query = params.toString();
    return fetchWithAuth(`/platform-admin/billing/invoices${query ? `?${query}` : ''}`);
  },

  // Get a specific invoice by ID
  async getInvoice(id: string): Promise<PlatformInvoice> {
    return fetchWithAuth(`/platform-admin/billing/invoices/${id}`);
  },

  // Get usage preview for a network
  async getUsagePreview(networkId: string, periodStart: string, periodEnd: string): Promise<UsagePreview> {
    return fetchWithAuth(
      `/platform-admin/billing/networks/${networkId}/usage-preview?periodStart=${periodStart}&periodEnd=${periodEnd}`
    );
  },

  // Create a draft invoice
  async createInvoice(data: { networkId: string; periodStart: string; periodEnd: string }): Promise<PlatformInvoice> {
    return fetchWithAuth('/platform-admin/billing/invoices', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Issue an invoice (send to billing provider)
  async issueInvoice(id: string): Promise<PlatformInvoice> {
    return fetchWithAuth(`/platform-admin/billing/invoices/${id}/issue`, {
      method: 'POST',
    });
  },

  // Mark an invoice as paid
  async markInvoicePaid(id: string, paidDate?: string): Promise<PlatformInvoice> {
    return fetchWithAuth(`/platform-admin/billing/invoices/${id}/paid`, {
      method: 'PUT',
      body: JSON.stringify({ paidDate }),
    });
  },

  // Cancel an invoice
  async cancelInvoice(id: string, reason?: string): Promise<PlatformInvoice> {
    return fetchWithAuth(`/platform-admin/billing/invoices/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason }),
    });
  },

  // Generate monthly invoices for all active networks
  async generateMonthlyInvoices(year: number, month: number): Promise<{ created: number; invoices: PlatformInvoice[] }> {
    return fetchWithAuth('/platform-admin/billing/generate-monthly', {
      method: 'POST',
      body: JSON.stringify({ year, month }),
    });
  },

  // Process overdue invoices
  async processOverdueInvoices(): Promise<{ processed: number }> {
    return fetchWithAuth('/platform-admin/billing/process-overdue', {
      method: 'POST',
    });
  },

  // ========== Platform Company Data Settings (Central service) ==========

  // Get platform company data settings
  async getPlatformCompanyDataSettings(): Promise<{
    companyDataProvider: string;
    optenApiKey: string;
    optenApiSecret: string;
    bisnodeApiKey: string;
    bisnodeApiSecret: string;
    eCegjegyzekApiKey: string;
    companyDataMonthlyFee: number | null;
  }> {
    return fetchWithAuth('/platform-admin/company-data/settings');
  },

  // Update platform company data settings
  async updatePlatformCompanyDataSettings(data: {
    companyDataProvider: string;
    optenApiKey?: string;
    optenApiSecret?: string;
    bisnodeApiKey?: string;
    bisnodeApiSecret?: string;
    eCegjegyzekApiKey?: string;
    companyDataMonthlyFee?: number | null;
  }): Promise<any> {
    return fetchWithAuth('/platform-admin/company-data/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // ========== Network Company Data Settings ==========

  // Get network company data settings
  async getNetworkCompanyDataSettings(networkId: string): Promise<{
    allowCustomCompanyDataProvider: boolean;
    companyDataProvider: string;
    optenApiKey: string;
    optenApiSecret: string;
    bisnodeApiKey: string;
    bisnodeApiSecret: string;
    eCegjegyzekApiKey: string;
    platformHasService: boolean;
    platformServiceProvider: string;
    platformServiceMonthlyFee: number | null;
  }> {
    return fetchWithAuth(`/platform-admin/networks/${networkId}/company-data/settings`);
  },

  // Update network company data settings
  async updateNetworkCompanyDataSettings(networkId: string, data: {
    allowCustomCompanyDataProvider?: boolean;
    companyDataProvider?: string;
    optenApiKey?: string;
    optenApiSecret?: string;
    bisnodeApiKey?: string;
    bisnodeApiSecret?: string;
    eCegjegyzekApiKey?: string;
  }): Promise<any> {
    return fetchWithAuth(`/platform-admin/networks/${networkId}/company-data/settings`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Test company data provider connection
  async testNetworkCompanyDataConnection(networkId: string): Promise<{
    success: boolean;
    providerName: string;
    source: 'network' | 'platform' | 'none';
    error?: string;
  }> {
    return fetchWithAuth(`/platform-admin/networks/${networkId}/company-data/connection-test`);
  },

  // Search companies via network provider
  async searchCompaniesForNetwork(networkId: string, params: {
    taxNumber?: string;
    name?: string;
    query?: string;
    limit?: number;
  }): Promise<any> {
    const searchParams = new URLSearchParams();
    if (params.taxNumber) searchParams.append('taxNumber', params.taxNumber);
    if (params.name) searchParams.append('name', params.name);
    if (params.query) searchParams.append('query', params.query);
    if (params.limit) searchParams.append('limit', params.limit.toString());
    return fetchWithAuth(`/platform-admin/networks/${networkId}/company-data/search?${searchParams}`);
  },
};
