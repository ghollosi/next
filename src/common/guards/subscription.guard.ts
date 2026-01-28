import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionStatus } from '@prisma/client';

export const SKIP_SUBSCRIPTION_CHECK = 'skipSubscriptionCheck';

/**
 * Decorator to skip subscription check for specific routes
 * Use on auth routes, subscription management routes, etc.
 */
export const SkipSubscriptionCheck = () => {
  return (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    if (propertyKey && descriptor) {
      // Method decorator
      Reflect.defineMetadata(SKIP_SUBSCRIPTION_CHECK, true, descriptor.value);
    } else {
      // Class decorator
      Reflect.defineMetadata(SKIP_SUBSCRIPTION_CHECK, true, target);
    }
    return descriptor || target;
  };
};

/**
 * Guard that checks if a network's subscription/trial is active
 * Blocks write operations (POST, PUT, PATCH, DELETE) for expired trials
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  private readonly logger = new Logger(SubscriptionGuard.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;

    // Only check write operations
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return true;
    }

    // Check if this route should skip subscription check
    const skipCheck = this.reflector.getAllAndOverride<boolean>(SKIP_SUBSCRIPTION_CHECK, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skipCheck) {
      return true;
    }

    // Get network ID from the authenticated user
    const user = request.user;
    if (!user?.networkId) {
      // No network context - allow (might be platform admin or public route)
      return true;
    }

    const networkId = user.networkId;

    // Fetch network subscription status
    const network = await this.prisma.network.findUnique({
      where: { id: networkId },
      select: {
        id: true,
        name: true,
        subscriptionStatus: true,
        trialEndsAt: true,
        subscriptionEndAt: true,
        isActive: true,
      },
    });

    if (!network) {
      this.logger.warn(`Network not found: ${networkId}`);
      throw new ForbiddenException('Hálózat nem található');
    }

    if (!network.isActive) {
      throw new ForbiddenException('A hálózat inaktív. Kérjük, vegye fel a kapcsolatot az ügyfélszolgálattal.');
    }

    const now = new Date();

    // Check subscription status
    switch (network.subscriptionStatus) {
      case SubscriptionStatus.ACTIVE:
        // Check if subscription has ended
        if (network.subscriptionEndAt && network.subscriptionEndAt < now) {
          this.logger.log(`Subscription expired for network ${network.name} (${networkId})`);
          throw new ForbiddenException(
            'Az előfizetés lejárt. Kérjük, hosszabbítsa meg előfizetését a szolgáltatások használatához.'
          );
        }
        return true;

      case SubscriptionStatus.TRIAL:
        // Check if trial has ended
        if (network.trialEndsAt && network.trialEndsAt < now) {
          this.logger.log(`Trial expired for network ${network.name} (${networkId})`);
          throw new ForbiddenException(
            'A próbaidőszak lejárt. Kérjük, válasszon előfizetési csomagot a szolgáltatások további használatához.'
          );
        }
        return true;

      case SubscriptionStatus.SUSPENDED:
        throw new ForbiddenException(
          'Az előfizetés felfüggesztve. Kérjük, rendezze a függő számlákat a szolgáltatások használatához.'
        );

      case SubscriptionStatus.CANCELLED:
        throw new ForbiddenException(
          'Az előfizetés lemondva. Kérjük, aktiválja újra előfizetését a szolgáltatások használatához.'
        );

      default:
        this.logger.warn(`Unknown subscription status for network ${networkId}: ${network.subscriptionStatus}`);
        return true;
    }
  }
}
