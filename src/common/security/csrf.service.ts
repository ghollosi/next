import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';

/**
 * SECURITY: CSRF Token Service
 *
 * Provides Double Submit Cookie pattern for CSRF protection.
 * The token is stored in both a cookie and must be sent in a header.
 *
 * This complements our SameSite=Strict cookies with explicit CSRF validation.
 */
@Injectable()
export class CsrfService {
  private readonly logger = new Logger(CsrfService.name);
  private readonly TOKEN_LENGTH = 32;

  /**
   * Generate a cryptographically secure CSRF token
   */
  generateToken(): string {
    return randomBytes(this.TOKEN_LENGTH).toString('hex');
  }

  /**
   * Validate that the cookie token matches the header token
   */
  validateToken(cookieToken: string | undefined, headerToken: string | undefined): boolean {
    if (!cookieToken || !headerToken) {
      this.logger.debug('CSRF validation failed: missing token');
      return false;
    }

    // Constant-time comparison to prevent timing attacks
    if (cookieToken.length !== headerToken.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < cookieToken.length; i++) {
      result |= cookieToken.charCodeAt(i) ^ headerToken.charCodeAt(i);
    }

    const isValid = result === 0;
    if (!isValid) {
      this.logger.warn('CSRF validation failed: token mismatch');
    }

    return isValid;
  }
}
