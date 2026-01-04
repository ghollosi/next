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
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface Location {
  id: string;
  code: string;
  name: string;
  city?: string;
  state?: string;
}

export interface ServicePackage {
  id: string;
  code: string;
  name: string;
  description?: string;
}

// Alias for backward compatibility
export type WashService = ServicePackage;

class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_URL;
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
    const response = await fetch(`${this.baseUrl}/pwa/activate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inviteCode, pin }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Activation failed');
    }

    return response.json();
  }

  async getProfile(sessionId: string): Promise<ActivateResponse> {
    const response = await fetch(`${this.baseUrl}/pwa/profile`, {
      headers: {
        'x-driver-session': sessionId,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get profile');
    }

    return response.json();
  }

  async getLocations(sessionId: string): Promise<Location[]> {
    const response = await fetch(`${this.baseUrl}/pwa/locations`, {
      headers: {
        'x-driver-session': sessionId,
      },
    });

    if (!response.ok) {
      this.handleSessionError(response);
      throw new Error('Failed to get locations');
    }

    return response.json();
  }

  async getLocationByCode(sessionId: string, code: string): Promise<Location> {
    const response = await fetch(`${this.baseUrl}/pwa/locations/${code}`, {
      headers: {
        'x-driver-session': sessionId,
      },
    });

    if (!response.ok) {
      throw new Error('Location not found');
    }

    return response.json();
  }

  async getServices(sessionId: string, locationCode: string): Promise<ServicePackage[]> {
    const response = await fetch(`${this.baseUrl}/pwa/locations/${locationCode}/services`, {
      headers: {
        'x-driver-session': sessionId,
      },
    });

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
      locationCode: string;
      servicePackageCode: string;
      tractorPlateManual?: string;
      trailerPlateManual?: string;
    }
  ): Promise<WashEvent> {
    const response = await fetch(`${this.baseUrl}/pwa/wash-events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-driver-session': sessionId,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create wash event');
    }

    return response.json();
  }

  async startWashEvent(sessionId: string, washEventId: string): Promise<WashEvent> {
    const response = await fetch(`${this.baseUrl}/pwa/wash-events/${washEventId}/start`, {
      method: 'POST',
      headers: {
        'x-driver-session': sessionId,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to start wash');
    }

    return response.json();
  }

  async completeWashEvent(sessionId: string, washEventId: string): Promise<WashEvent> {
    const response = await fetch(`${this.baseUrl}/pwa/wash-events/${washEventId}/complete`, {
      method: 'POST',
      headers: {
        'x-driver-session': sessionId,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to complete wash');
    }

    return response.json();
  }

  async getActiveWashEvent(sessionId: string): Promise<WashEvent | null> {
    const response = await fetch(`${this.baseUrl}/pwa/wash-events/active`, {
      headers: {
        'x-driver-session': sessionId,
      },
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error('Failed to get active wash event');
    }

    return response.json();
  }

  async getWashEvent(sessionId: string, washEventId: string): Promise<WashEvent> {
    const response = await fetch(`${this.baseUrl}/pwa/wash-events/${washEventId}`, {
      headers: {
        'x-driver-session': sessionId,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get wash event');
    }

    return response.json();
  }

  async getWashHistory(sessionId: string): Promise<WashEvent[]> {
    const response = await fetch(`${this.baseUrl}/pwa/wash-events`, {
      headers: {
        'x-driver-session': sessionId,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get wash history');
    }

    return response.json();
  }
}

export const api = new ApiClient();
