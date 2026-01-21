import { BadRequestException } from '@nestjs/common';

/**
 * SECURITY: Password policy validation
 *
 * Requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 *
 * Note: This only applies to NEW passwords. Existing passwords remain valid.
 */

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validatePasswordStrength(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (!password || password.length < 8) {
    errors.push('A jelszónak legalább 8 karakter hosszúnak kell lennie');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('A jelszónak tartalmaznia kell legalább egy nagybetűt');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('A jelszónak tartalmaznia kell legalább egy kisbetűt');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('A jelszónak tartalmaznia kell legalább egy számot');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates password and throws BadRequestException if invalid
 * Use this in service methods when creating/updating passwords
 */
export function assertValidPassword(password: string): void {
  const result = validatePasswordStrength(password);
  if (!result.isValid) {
    throw new BadRequestException({
      message: 'A jelszó nem felel meg a biztonsági követelményeknek',
      errors: result.errors,
    });
  }
}

/**
 * Password policy description for UI
 */
export const PASSWORD_POLICY_DESCRIPTION = {
  hu: 'A jelszónak legalább 8 karakter hosszúnak kell lennie, és tartalmaznia kell nagybetűt, kisbetűt és számot.',
  en: 'Password must be at least 8 characters long and contain uppercase, lowercase, and a number.',
};
