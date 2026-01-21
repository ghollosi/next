import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { CsrfService } from './csrf.service';

export const CSRF_COOKIE_NAME = 'vsys-csrf-token';
export const CSRF_HEADER_NAME = 'x-csrf-token';
export const SKIP_CSRF_KEY = 'skipCsrf';

/**
 * Decorator to skip CSRF validation for specific endpoints
 * Use this for webhooks, public APIs, etc.
 */
export const SkipCsrf = () => {
  return (target: object, key?: string | symbol, descriptor?: PropertyDescriptor) => {
    if (descriptor) {
      Reflect.defineMetadata(SKIP_CSRF_KEY, true, descriptor.value);
      return descriptor;
    }
    Reflect.defineMetadata(SKIP_CSRF_KEY, true, target);
    return target;
  };
};

/**
 * SECURITY: CSRF Guard
 *
 * Validates CSRF tokens on state-changing requests (POST, PUT, PATCH, DELETE).
 * Uses Double Submit Cookie pattern.
 *
 * GET/HEAD/OPTIONS requests are exempt (safe methods).
 * Endpoints decorated with @SkipCsrf() are exempt.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly safeMethods = ['GET', 'HEAD', 'OPTIONS'];

  constructor(
    private readonly csrfService: CsrfService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Safe methods don't need CSRF protection
    if (this.safeMethods.includes(request.method)) {
      // Ensure CSRF cookie exists for future state-changing requests
      this.ensureCsrfCookie(request, response);
      return true;
    }

    // Check if endpoint is marked to skip CSRF
    const handler = context.getHandler();
    const controller = context.getClass();
    const skipCsrf =
      this.reflector.get<boolean>(SKIP_CSRF_KEY, handler) ||
      this.reflector.get<boolean>(SKIP_CSRF_KEY, controller);

    if (skipCsrf) {
      return true;
    }

    // Validate CSRF token
    const cookieToken = request.cookies?.[CSRF_COOKIE_NAME];
    const headerToken = request.headers[CSRF_HEADER_NAME] as string;

    if (!this.csrfService.validateToken(cookieToken, headerToken)) {
      throw new ForbiddenException('Invalid or missing CSRF token');
    }

    return true;
  }

  /**
   * Ensure CSRF cookie exists
   */
  private ensureCsrfCookie(request: Request, response: Response): void {
    if (!request.cookies?.[CSRF_COOKIE_NAME]) {
      const token = this.csrfService.generateToken();
      const isProduction = process.env.NODE_ENV === 'production';

      response.cookie(CSRF_COOKIE_NAME, token, {
        httpOnly: false, // Must be readable by JavaScript to send in header
        secure: isProduction,
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        path: '/',
      });
    }
  }
}
