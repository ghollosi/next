import { Response, Request } from 'express';

/**
 * SECURITY: Session cookie helper for httpOnly cookies
 * This prevents XSS attacks from stealing session tokens
 */

export interface CookieOptions {
  name: string;
  maxAge?: number; // in milliseconds
}

// Cookie names for different session types
export const SESSION_COOKIES = {
  OPERATOR: 'vsys_operator_session',
  DRIVER: 'vsys_driver_session',
  PARTNER: 'vsys_partner_session',
} as const;

// Default cookie max age: 24 hours
const DEFAULT_MAX_AGE = 24 * 60 * 60 * 1000;

/**
 * Set a secure httpOnly cookie with session ID
 */
export function setSessionCookie(
  res: Response,
  cookieName: string,
  sessionId: string,
  maxAge: number = DEFAULT_MAX_AGE,
): void {
  const isProduction = process.env.NODE_ENV === 'production';

  res.cookie(cookieName, sessionId, {
    httpOnly: true,           // SECURITY: Not accessible via JavaScript
    secure: isProduction,      // SECURITY: Only send over HTTPS in production
    sameSite: 'strict',       // SECURITY: Strong CSRF protection - cookies only sent for same-site requests
    maxAge,                    // Cookie expiration
    path: '/',                 // Available for all paths
  });
}

/**
 * Clear a session cookie (for logout)
 */
export function clearSessionCookie(res: Response, cookieName: string): void {
  res.clearCookie(cookieName, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  });
}

/**
 * Get session ID from cookie or header (fallback for backwards compatibility)
 * Priority: Cookie > Header
 */
export function getSessionId(
  req: Request,
  cookieName: string,
  headerName: string,
): string | undefined {
  // Try cookie first (more secure)
  const cookieSession = req.cookies?.[cookieName];
  if (cookieSession) {
    return cookieSession;
  }

  // Fallback to header for backwards compatibility
  return req.get(headerName);
}
