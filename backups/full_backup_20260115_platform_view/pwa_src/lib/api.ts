// API URL - uses environment variable or falls back to same-origin API proxy
const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export interface ActivateResponse {
  sessionId: string;
  driverId: string;
  networkId: string;
  partnerCompanyId: string;
  firstName: string;
  lastName: string;
  partnerCompanyName: string;
}

export interface WashEvent {
  id: string;
  status: 'CREATED' | 'AUTHORIZED' | 'IN_PROGRESS' | 'COMPLETED' | 'LOCKED' | 'REJECTED';
  locationId: string;
  servicePackageId: string;
  tractorPlateManual?: string;
  trailerPlateManual?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  // Populated relations from API
  location?: {
    id: string;
    name: string;
    code: string;
    city?: string;
    state?: string;
    washMode?: 'AUTOMATIC' | 'MANUAL';
  };
  servicePackage?: {
    id: string;
    name: string;
    code: string;
    description?: string;
  };
}

export type LocationType = 'CAR_WASH' | 'TRUCK_WASH';

export interface Location {
  id: string;
  code: string;
  name: string;
  city?: string;
  state?: string;
  washMode?: 'AUTOMATIC' | 'MANUAL';
  locationType?: LocationType;
}

export interface ServicePackage {
  id: string;
  code: string;
  name: string;
  description?: string;
}

// Alias for backward compatibility
export type WashService = ServicePackage;

export type VehicleCategory = 'SOLO' | 'TRACTOR' | 'TRAILER';

export interface Vehicle {
  id: string;
  category: VehicleCategory;
  plateNumber: string;
  nickname?: string;
}

export interface VehiclesResponse {
  solos: Vehicle[];
  tractors: Vehicle[];
  trailers: Vehicle[];
}

class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_URL;
  }

  // SECURITY: Default fetch options with credentials for httpOnly cookies
  private fetchOptions(options?: RequestInit): RequestInit {
    return {
      ...options,
      credentials: 'include', // Send cookies with cross-origin requests
    };
  }

  private handleSessionError(response: Response): void {
    // If session is invalid, clear localStorage and redirect to login
    if (response.status === 400 || response.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('vsys_session');
        localStorage.removeItem('vsys_driver');
        window.location.href = '/login';
      }
    }
  }

  async activate(inviteCode: string, pin: string): Promise<ActivateResponse> {
    const response = await fetch(`${this.baseUrl}/pwa/activate`, this.fetchOptions({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inviteCode, pin }),
    }));

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Activation failed');
    }

    return response.json();
  }

  async loginByPhone(phone: string, pin: string): Promise<ActivateResponse> {
    const response = await fetch(`${this.baseUrl}/pwa/login-phone`, this.fetchOptions({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phone, pin }),
    }));

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Bejelentkezés sikertelen');
    }

    return response.json();
  }

  async getProfile(sessionId: string): Promise<ActivateResponse> {
    const response = await fetch(`${this.baseUrl}/pwa/profile`, this.fetchOptions({
      headers: {
        'x-driver-session': sessionId,
      },
    }));

    if (!response.ok) {
      throw new Error('Failed to get profile');
    }

    return response.json();
  }

  async getLocations(sessionId: string): Promise<Location[]> {
    const response = await fetch(`${this.baseUrl}/pwa/locations`, this.fetchOptions({
      headers: {
        'x-driver-session': sessionId,
      },
    }));

    if (!response.ok) {
      this.handleSessionError(response);
      throw new Error('Failed to get locations');
    }

    return response.json();
  }

  async getLocationByCode(sessionId: string, code: string): Promise<Location> {
    const response = await fetch(`${this.baseUrl}/pwa/locations/${code}`, this.fetchOptions({
      headers: {
        'x-driver-session': sessionId,
      },
    }));

    if (!response.ok) {
      throw new Error('Location not found');
    }

    return response.json();
  }

  async getServices(sessionId: string, locationCode: string): Promise<ServicePackage[]> {
    const response = await fetch(`${this.baseUrl}/pwa/locations/${locationCode}/services`, this.fetchOptions({
      headers: {
        'x-driver-session': sessionId,
      },
    }));

    if (!response.ok) {
      throw new Error('Failed to get services');
    }

    const data = await response.json();
    // API returns { location, services }, we need just services
    return data.services || data;
  }

  async createWashEvent(
    sessionId: string,
    data: {
      locationId: string;
      // DEPRECATED - régi egyetlen szolgáltatás
      servicePackageId?: string;
      // ÚJ - Több szolgáltatás támogatása
      services?: Array<{
        servicePackageId: string;
        vehicleType?: string;
        vehicleRole?: 'TRACTOR' | 'TRAILER';
        plateNumber?: string;
        quantity?: number;
      }>;
      tractorVehicleId?: string;
      tractorPlateManual?: string;
      trailerVehicleId?: string;
      trailerPlateManual?: string;
    }
  ): Promise<WashEvent> {
    const response = await fetch(`${this.baseUrl}/pwa/wash-events`, this.fetchOptions({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-driver-session': sessionId,
      },
      body: JSON.stringify(data),
    }));

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create wash event');
    }

    return response.json();
  }

  async startWashEvent(sessionId: string, washEventId: string): Promise<WashEvent> {
    const response = await fetch(`${this.baseUrl}/pwa/wash-events/${washEventId}/start`, this.fetchOptions({
      method: 'POST',
      headers: {
        'x-driver-session': sessionId,
      },
    }));

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to start wash');
    }

    return response.json();
  }

  async completeWashEvent(sessionId: string, washEventId: string): Promise<WashEvent> {
    const response = await fetch(`${this.baseUrl}/pwa/wash-events/${washEventId}/complete`, this.fetchOptions({
      method: 'POST',
      headers: {
        'x-driver-session': sessionId,
      },
    }));

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to complete wash');
    }

    return response.json();
  }

  async getActiveWashEvent(sessionId: string): Promise<WashEvent | null> {
    const response = await fetch(`${this.baseUrl}/pwa/wash-events/active`, this.fetchOptions({
      headers: {
        'x-driver-session': sessionId,
      },
    }));

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error('Failed to get active wash event');
    }

    return response.json();
  }

  async getWashEvent(sessionId: string, washEventId: string): Promise<WashEvent> {
    const response = await fetch(`${this.baseUrl}/pwa/wash-events/${washEventId}`, this.fetchOptions({
      headers: {
        'x-driver-session': sessionId,
      },
    }));

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get wash event');
    }

    return response.json();
  }

  async getWashHistory(sessionId: string): Promise<WashEvent[]> {
    const response = await fetch(`${this.baseUrl}/pwa/wash-events`, this.fetchOptions({
      headers: {
        'x-driver-session': sessionId,
      },
    }));

    if (!response.ok) {
      throw new Error('Failed to get wash history');
    }

    const result = await response.json();
    // API returns { data: [...], total: N }, we need just the array
    return result.data || result;
  }

  async getVehicles(sessionId: string): Promise<VehiclesResponse> {
    const response = await fetch(`${this.baseUrl}/pwa/vehicles`, this.fetchOptions({
      headers: {
        'x-driver-session': sessionId,
      },
    }));

    if (!response.ok) {
      this.handleSessionError(response);
      throw new Error('Failed to get vehicles');
    }

    return response.json();
  }

  async createVehicle(
    sessionId: string,
    data: {
      category: VehicleCategory;
      plateNumber: string;
      nickname?: string;
    }
  ): Promise<Vehicle> {
    const response = await fetch(`${this.baseUrl}/pwa/vehicles`, this.fetchOptions({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-driver-session': sessionId,
      },
      body: JSON.stringify(data),
    }));

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Nem sikerult a jarmu mentese');
    }

    return response.json();
  }

  async deleteVehicle(sessionId: string, vehicleId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/pwa/vehicles/${vehicleId}`, this.fetchOptions({
      method: 'DELETE',
      headers: {
        'x-driver-session': sessionId,
      },
    }));

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Nem sikerult torolni a jarmut');
    }
  }
}

export const api = new ApiClient();
