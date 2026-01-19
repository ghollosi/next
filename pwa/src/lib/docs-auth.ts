'use client';

/**
 * Documentation access control based on user roles
 *
 * Role hierarchy and access:
 * - PLATFORM_ADMIN/PLATFORM_OWNER: Can see ALL docs
 * - NETWORK_ADMIN/NETWORK_OWNER/NETWORK_CONTROLLER/NETWORK_ACCOUNTANT: All except platform-admin
 * - OPERATOR: Only operator docs
 * - PARTNER: Only partner docs
 * - DRIVER: Only driver docs
 */

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
  role: UserRole;
  allowedSections: DocSection[];
  redirectTo: string | null;
}

// Mapping of roles to allowed doc sections
const ROLE_ACCESS: Record<string, DocSection[]> = {
  'PLATFORM_OWNER': ['overview', 'platform-admin', 'network-admin', 'operator', 'driver', 'partner'],
  'PLATFORM_ADMIN': ['overview', 'platform-admin', 'network-admin', 'operator', 'driver', 'partner'],
  'NETWORK_OWNER': ['overview', 'network-admin', 'operator', 'driver', 'partner'],
  'NETWORK_ADMIN': ['overview', 'network-admin', 'operator', 'driver', 'partner'],
  'NETWORK_CONTROLLER': ['overview', 'network-admin', 'operator', 'driver', 'partner'],
  'NETWORK_ACCOUNTANT': ['overview', 'network-admin', 'operator', 'driver', 'partner'],
  'OPERATOR': ['operator'],
  'PARTNER': ['partner'],
  'DRIVER': ['driver'],
};

// Login pages for each role type
const LOGIN_PAGES: Record<string, string> = {
  'platform-admin': '/platform-admin',
  'network-admin': '/network-admin',
  'operator': '/operator-portal/login',
  'partner': '/partner/login',
  'driver': '/login',
  'overview': '/login',
};

/**
 * Check current user authentication status and role
 */
export function getAuthStatus(): AuthStatus {
  if (typeof window === 'undefined') {
    return {
      isAuthenticated: false,
      role: null,
      allowedSections: [],
      redirectTo: '/login',
    };
  }

  // Check Platform Admin (key: vsys_platform_admin)
  const platformAdmin = localStorage.getItem('vsys_platform_admin');
  if (platformAdmin) {
    try {
      const data = JSON.parse(platformAdmin);
      const role = data.role as UserRole;
      return {
        isAuthenticated: true,
        role,
        allowedSections: ROLE_ACCESS[role || ''] || [],
        redirectTo: null,
      };
    } catch (e) {
      // Invalid data, continue checking
    }
  }

  // Check Network Admin (key: vsys_network_admin_data)
  const networkAdmin = localStorage.getItem('vsys_network_admin_data');
  if (networkAdmin) {
    try {
      const data = JSON.parse(networkAdmin);
      const role = data.role as UserRole;
      return {
        isAuthenticated: true,
        role,
        allowedSections: ROLE_ACCESS[role || ''] || [],
        redirectTo: null,
      };
    } catch (e) {
      // Invalid data, continue checking
    }
  }

  // Check Operator
  const operatorSession = localStorage.getItem('operator_session');
  if (operatorSession) {
    return {
      isAuthenticated: true,
      role: 'OPERATOR',
      allowedSections: ROLE_ACCESS['OPERATOR'],
      redirectTo: null,
    };
  }

  // Check Partner
  const partnerSession = localStorage.getItem('partner_session');
  if (partnerSession) {
    return {
      isAuthenticated: true,
      role: 'PARTNER',
      allowedSections: ROLE_ACCESS['PARTNER'],
      redirectTo: null,
    };
  }

  // Check Driver
  const driverSession = localStorage.getItem('vsys_session');
  if (driverSession) {
    return {
      isAuthenticated: true,
      role: 'DRIVER',
      allowedSections: ROLE_ACCESS['DRIVER'],
      redirectTo: null,
    };
  }

  // Not authenticated
  return {
    isAuthenticated: false,
    role: null,
    allowedSections: [],
    redirectTo: '/login',
  };
}

/**
 * Check if user can access a specific doc section
 */
export function canAccessSection(section: DocSection): boolean {
  const { allowedSections } = getAuthStatus();
  return allowedSections.includes(section);
}

/**
 * Get the appropriate login page for a doc section
 */
export function getLoginPageForSection(section: DocSection): string {
  return LOGIN_PAGES[section] || '/login';
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
 * Filter navigation items based on user's allowed sections
 */
export function filterNavigationForRole(
  items: Array<{ href: string; name: string; [key: string]: unknown }>
): Array<{ href: string; name: string; [key: string]: unknown }> {
  const { allowedSections } = getAuthStatus();

  return items.filter(item => {
    const section = getSectionFromPath(item.href);
    return section === null || allowedSections.includes(section);
  });
}
