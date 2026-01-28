/**
 * Unified Authentication API and Session Management
 *
 * Single login endpoint for all user types:
 * - Platform Admin
 * - Network Admin
 * - Location Operator
 * - Partner Admin
 * - Driver
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export type UserRole =
  | 'platform_admin'
  | 'network_admin'
  | 'operator'
  | 'partner'
  | 'driver';

export interface FoundUser {
  role: UserRole;
  id: string;
  email: string;
  name: string;
  networkId?: string;
  networkName?: string;
  networkSlug?: string;
  locationId?: string;
  locationName?: string;
  partnerId?: string;
  partnerName?: string;
  platformRole?: string;
}

export interface UnifiedLoginResponse {
  multipleRoles: boolean;
  availableRoles?: FoundUser[];
  selectedRole?: FoundUser;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  redirectUrl?: string;
  tempToken?: string;
}

export interface SelectRoleResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  redirectUrl: string;
  selectedRole: FoundUser;
}

// Session storage keys
const UNIFIED_AUTH_KEY = 'unified_auth';
const UNIFIED_USER_KEY = 'unified_user';
const TEMP_TOKEN_KEY = 'unified_temp_token';
const AVAILABLE_ROLES_KEY = 'unified_available_roles';

/**
 * Unified login - searches all user tables for the given email
 */
export async function unifiedLogin(
  email: string,
  password: string,
): Promise<UnifiedLoginResponse> {
  const response = await fetch(`${API_URL}/auth/unified-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.toLowerCase().trim(), password }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Bejelentkezés sikertelen' }));
    throw new Error(error.message || 'Bejelentkezés sikertelen');
  }

  const data = await response.json();

  // If single role, save session immediately
  if (!data.multipleRoles && data.accessToken) {
    saveUnifiedSession(data.accessToken, data.refreshToken, data.selectedRole);
  }

  // If multiple roles, save temp token and roles for selection
  if (data.multipleRoles && data.availableRoles) {
    sessionStorage.setItem(AVAILABLE_ROLES_KEY, JSON.stringify(data.availableRoles));
    if (data.tempToken) {
      sessionStorage.setItem(TEMP_TOKEN_KEY, data.tempToken);
    }
  }

  return data;
}

/**
 * Select a role after multiple roles were found
 */
export async function selectRole(
  role: UserRole,
  entityId: string,
  tempToken: string,
): Promise<SelectRoleResponse> {
  const response = await fetch(`${API_URL}/auth/select-role`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role, entityId, tempToken }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Szerepkör kiválasztása sikertelen' }));
    throw new Error(error.message || 'Szerepkör kiválasztása sikertelen');
  }

  const data = await response.json();

  // Save session
  saveUnifiedSession(data.accessToken, data.refreshToken, data.selectedRole);

  // Clear temp data
  sessionStorage.removeItem(TEMP_TOKEN_KEY);
  sessionStorage.removeItem(AVAILABLE_ROLES_KEY);

  return data;
}

/**
 * Save unified session to localStorage
 */
export function saveUnifiedSession(
  accessToken: string,
  refreshToken: string | undefined,
  user: FoundUser,
): void {
  const authData = {
    accessToken,
    refreshToken,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  };

  localStorage.setItem(UNIFIED_AUTH_KEY, JSON.stringify(authData));
  localStorage.setItem(UNIFIED_USER_KEY, JSON.stringify(user));

  // Also save to legacy session stores for backwards compatibility
  saveLegacySession(user, accessToken);
}

/**
 * Save to legacy session stores for backwards compatibility with existing portals
 */
function saveLegacySession(user: FoundUser, token: string): void {
  switch (user.role) {
    case 'platform_admin':
      localStorage.setItem('platform_admin_token', token);
      localStorage.setItem('platform_admin_user', JSON.stringify({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.platformRole,
      }));
      break;

    case 'network_admin':
      localStorage.setItem('network_admin_token', token);
      localStorage.setItem('network_admin_user', JSON.stringify({
        id: user.id,
        name: user.name,
        email: user.email,
        networkId: user.networkId,
        networkName: user.networkName,
        networkSlug: user.networkSlug,
      }));
      break;

    case 'operator':
      // Operator uses session-based auth, but we can save some info
      localStorage.setItem('operator_unified_login', JSON.stringify({
        operatorId: user.id,
        operatorName: user.name,
        locationId: user.locationId,
        locationName: user.locationName,
        networkId: user.networkId,
      }));
      break;

    case 'partner':
      localStorage.setItem('partner_unified_login', JSON.stringify({
        partnerId: user.id,
        partnerName: user.name,
        networkId: user.networkId,
      }));
      break;

    case 'driver':
      // Driver session is typically managed differently
      localStorage.setItem('driver_unified_login', JSON.stringify({
        driverId: user.id,
        name: user.name,
        networkId: user.networkId,
        partnerId: user.partnerId,
        partnerName: user.partnerName,
      }));
      break;
  }
}

/**
 * Get current unified session
 */
export function getUnifiedSession(): { token: string; user: FoundUser } | null {
  try {
    const authStr = localStorage.getItem(UNIFIED_AUTH_KEY);
    const userStr = localStorage.getItem(UNIFIED_USER_KEY);

    if (!authStr || !userStr) return null;

    const auth = JSON.parse(authStr);
    const user = JSON.parse(userStr);

    // Check if expired
    if (auth.expiresAt && auth.expiresAt < Date.now()) {
      clearUnifiedSession();
      return null;
    }

    return { token: auth.accessToken, user };
  } catch {
    return null;
  }
}

/**
 * Get temp token for role selection
 */
export function getTempToken(): string | null {
  return sessionStorage.getItem(TEMP_TOKEN_KEY);
}

/**
 * Get available roles for selection
 */
export function getAvailableRoles(): FoundUser[] | null {
  try {
    const rolesStr = sessionStorage.getItem(AVAILABLE_ROLES_KEY);
    if (!rolesStr) return null;
    return JSON.parse(rolesStr);
  } catch {
    return null;
  }
}

/**
 * Clear unified session
 */
export function clearUnifiedSession(): void {
  localStorage.removeItem(UNIFIED_AUTH_KEY);
  localStorage.removeItem(UNIFIED_USER_KEY);
  sessionStorage.removeItem(TEMP_TOKEN_KEY);
  sessionStorage.removeItem(AVAILABLE_ROLES_KEY);

  // Also clear legacy sessions
  localStorage.removeItem('platform_admin_token');
  localStorage.removeItem('platform_admin_user');
  localStorage.removeItem('network_admin_token');
  localStorage.removeItem('network_admin_user');
  localStorage.removeItem('operator_unified_login');
  localStorage.removeItem('partner_unified_login');
  localStorage.removeItem('driver_unified_login');
}

/**
 * Get redirect URL for a role
 */
export function getRedirectUrl(role: UserRole): string {
  switch (role) {
    case 'platform_admin':
      return '/platform-admin/dashboard';
    case 'network_admin':
      return '/network-admin/dashboard';
    case 'operator':
      return '/operator-portal/dashboard';
    case 'partner':
      return '/partner/dashboard';
    case 'driver':
      return '/dashboard';
    default:
      return '/';
  }
}

/**
 * Get role display name in Hungarian
 */
export function getRoleDisplayName(role: UserRole): string {
  switch (role) {
    case 'platform_admin':
      return 'Platform Admin';
    case 'network_admin':
      return 'Network Admin';
    case 'operator':
      return 'Operátor';
    case 'partner':
      return 'Partner Admin';
    case 'driver':
      return 'Sofőr';
    default:
      return role;
  }
}

/**
 * Get role icon name for UI
 */
export function getRoleIcon(role: UserRole): string {
  switch (role) {
    case 'platform_admin':
      return 'shield'; // Shield icon for platform admin
    case 'network_admin':
      return 'building'; // Building icon for network admin
    case 'operator':
      return 'wrench'; // Wrench icon for operator
    case 'partner':
      return 'briefcase'; // Briefcase icon for partner
    case 'driver':
      return 'truck'; // Truck icon for driver
    default:
      return 'user';
  }
}
