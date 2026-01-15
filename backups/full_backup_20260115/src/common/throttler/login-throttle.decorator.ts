import { Throttle } from '@nestjs/throttler';

/**
 * SECURITY: Strict rate limiting decorator for login endpoints
 *
 * Brute force protection: 5 attempts per minute per IP
 * This is much stricter than the global 100 req/min limit
 *
 * Usage: @LoginThrottle() on login endpoints
 */
export const LoginThrottle = () => Throttle({ default: { limit: 5, ttl: 60000 } });

/**
 * SECURITY: Moderate rate limiting for sensitive operations
 *
 * 10 attempts per minute per IP
 * Use for password reset, email verification, etc.
 */
export const SensitiveThrottle = () => Throttle({ default: { limit: 10, ttl: 60000 } });
