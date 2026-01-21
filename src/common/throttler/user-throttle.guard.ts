import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import { Request } from 'express';

/**
 * SECURITY: Enhanced Throttler Guard with User-based Rate Limiting
 *
 * Extends the default IP-based rate limiting to also track by user ID.
 * This prevents a single user from making excessive requests even if
 * they're using multiple IPs (e.g., VPN rotation).
 *
 * Key generation priority:
 * 1. If authenticated user: IP + userId
 * 2. If session cookie: IP + sessionId
 * 3. Default: IP only
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Request): Promise<string> {
    // Get base IP address
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';

    // Check for authenticated user (JWT payload attached by auth middleware)
    const user = (req as any).user;
    if (user?.sub) {
      return `${ip}-user:${user.sub}`;
    }

    // Check for session-based authentication
    const sessionId =
      req.cookies?.['vsys-driver-session'] ||
      req.cookies?.['vsys-partner-session'] ||
      req.cookies?.['vsys-operator-session'];

    if (sessionId) {
      // Hash the session ID to avoid exposing it in logs
      return `${ip}-session:${sessionId.substring(0, 16)}`;
    }

    // Fallback to IP only for unauthenticated requests
    return ip;
  }

  protected async throwThrottlingException(context: ExecutionContext): Promise<void> {
    const request = context.switchToHttp().getRequest<Request>();
    const tracker = await this.getTracker(request);

    // Log rate limit violation for security monitoring
    console.warn(`Rate limit exceeded for: ${tracker}`);

    throw new ThrottlerException('Too many requests. Please wait before trying again.');
  }
}
