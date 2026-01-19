'use client';

/**
 * Documentation access control based on portal source
 *
 * IMPORTANT: Portal source MUST come from URL ?from= parameter only!
 * NO sessionStorage, NO localStorage fallback for portal detection.
 *
 * Portal types and their allowed doc sections:
 * - platform: Can see ALL docs
 * - network: All except platform-admin docs
 * - operator: ONLY operator docs
 * - partner: ONLY partner docs
 * - driver: ONLY driver docs
 */

export type PortalSource = 'platform' | 'network' | 'operator' | 'partner' | 'driver' | null;

export type UserRole =
  | 'PLATFORM_OWNER'
  | 'PLATFORM_ADMIN'
  | 'NETWORK_OWNER'
  | 'NETWORK_ADMIN'
  | 'NETWORK_CONTROLLER'
  | 'NETWORK_ACCOUNTANT'
  | 'OPERATOR'
  | 'PARTNER'
  | 'DRIVER'
  | null;

export type DocSection =
  | 'platform-admin'
  | 'network-admin'
  | 'operator'
  | 'driver'
  | 'partner'
  | 'overview';

interface AuthStatus {
  isAuthenticated: boolean;
  portalSource: PortalSource;
  role: UserRole;
  allowedSections: DocSection[];
  redirectTo: string | null;
  backLink: string;
}

// Mapping of portal source to allowed doc sections
export const PORTAL_ACCESS: Record<string, DocSection[]> = {
  'platform': ['overview', 'platform-admin', 'network-admin', 'operator', 'driver', 'partner'],
  'network': ['overview', 'network-admin', 'operator', 'driver', 'partner'],
  'operator': ['operator'],
  'partner': ['partner'],
  'driver': ['driver'],
};

// Back links for each portal type
export const BACK_LINKS: Record<string, string> = {
  'platform': '/platform-admin/dashboard',
  'network': '/network-admin/dashboard',
  'operator': '/operator-portal/dashboard',
  'partner': '/partner/dashboard',
  'driver': '/dashboard',
};

// Login pages for each portal type
export const LOGIN_PAGES: Record<string, string> = {
  'platform': '/platform-admin',
  'network': '/network-admin',
  'operator': '/operator-portal/login',
  'partner': '/partner/login',
  'driver': '/login',
};

// Session storage keys for each portal type (for checking if user is logged in)
const SESSION_KEYS: Record<string, string[]> = {
  'platform': ['vsys_platform_admin', 'vsys_platform_token'],
  'network': ['vsys_network_admin_data', 'vsys_network_admin_token'],
  'operator': ['operator_session'],
  'partner': ['partner_session'],
  'driver': ['vsys_session'],
};

/**
 * Check if a specific portal session is valid in localStorage
 */
function isPortalSessionValid(portal: PortalSource): boolean {
  if (typeof window === 'undefined' || !portal) return false;

  const keys = SESSION_KEYS[portal];
  if (!keys) return false;

  // Check if ANY of the session keys exist and are valid
  for (const key of keys) {
    const value = localStorage.getItem(key);
    if (value) {
      // For JSON stored values, verify they can be parsed
      if (key.includes('_data') || key.includes('_admin')) {
        try {
          JSON.parse(value);
          return true;
        } catch {
          continue;
        }
      }
      // For simple session tokens
      return true;
    }
  }

  return false;
}

/**
 * Get the role from portal session
 */
function getRoleFromPortal(portal: PortalSource): UserRole {
  if (typeof window === 'undefined' || !portal) return null;

  switch (portal) {
    case 'platform': {
      const data = localStorage.getItem('vsys_platform_admin');
      if (data) {
        try {
          const parsed = JSON.parse(data);
          return parsed.role as UserRole;
        } catch {
          return 'PLATFORM_ADMIN';
        }
      }
      return 'PLATFORM_ADMIN';
    }
    case 'network': {
      const data = localStorage.getItem('vsys_network_admin_data');
      if (data) {
        try {
          const parsed = JSON.parse(data);
          return parsed.role as UserRole;
        } catch {
          return 'NETWORK_ADMIN';
        }
      }
      return 'NETWORK_ADMIN';
    }
    case 'operator':
      return 'OPERATOR';
    case 'partner':
      return 'PARTNER';
    case 'driver':
      return 'DRIVER';
    default:
      return null;
  }
}

/**
 * Check current user authentication status based on portal source
 * IMPORTANT: portalSource MUST be provided - this function does NOT read from URL or storage
 */
export function getAuthStatus(portalSource: PortalSource): AuthStatus {
  if (typeof window === 'undefined') {
    return {
      isAuthenticated: false,
      portalSource: null,
      role: null,
      allowedSections: [],
      redirectTo: '/login',
      backLink: '/',
    };
  }

  // If no portal source provided, user shouldn't be here
  if (!portalSource) {
    return {
      isAuthenticated: false,
      portalSource: null,
      role: null,
      allowedSections: [],
      redirectTo: '/login',
      backLink: '/',
    };
  }

  // Check if the session for this specific portal is valid
  if (!isPortalSessionValid(portalSource)) {
    return {
      isAuthenticated: false,
      portalSource: portalSource,
      role: null,
      allowedSections: [],
      redirectTo: LOGIN_PAGES[portalSource] || '/login',
      backLink: BACK_LINKS[portalSource] || '/',
    };
  }

  // User is authenticated for this portal
  const role = getRoleFromPortal(portalSource);
  const allowedSections = PORTAL_ACCESS[portalSource] || [];

  return {
    isAuthenticated: true,
    portalSource: portalSource,
    role,
    allowedSections,
    redirectTo: null,
    backLink: BACK_LINKS[portalSource] || '/',
  };
}

/**
 * Get the doc section from a pathname
 */
export function getSectionFromPath(pathname: string): DocSection | null {
  if (pathname === '/docs' || pathname === '/docs/') {
    return 'overview';
  }

  const match = pathname.match(/^\/docs\/([^/]+)/);
  if (match) {
    const section = match[1] as DocSection;
    if (['platform-admin', 'network-admin', 'operator', 'driver', 'partner'].includes(section)) {
      return section;
    }
  }

  return null;
}

/**
 * Build a docs URL with the portal source parameter
 */
export function buildDocsUrl(section: DocSection, portal: PortalSource): string {
  const base = section === 'overview' ? '/docs' : `/docs/${section}`;
  return portal ? `${base}?from=${portal}` : base;
}
