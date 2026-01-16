import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { EmailService } from '../modules/email/email.service';
import { SubscriptionStatus } from '@prisma/client';
import Stripe from 'stripe';
import {
  SubscriptionDetailsDto,
  CheckoutSessionResponseDto,
  BillingPortalResponseDto,
} from './dto/stripe.dto';

@Injectable()
export class StripeService {
  private stripe: Stripe | null = null;
  private readonly logger = new Logger(StripeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  // =========================================================================
  // STRIPE CLIENT INITIALIZATION
  // =========================================================================

  private async getStripeClient(): Promise<Stripe> {
    if (this.stripe) return this.stripe;

    const settings = await this.prisma.platformSettings.findFirst();
    if (!settings?.stripeSecretKey) {
      throw new BadRequestException('Stripe nincs konfigurálva. Kérjük, adja meg a Stripe API kulcsokat a Platform Admin beállításokban.');
    }

    this.stripe = new Stripe(settings.stripeSecretKey, {
      apiVersion: '2025-02-24.acacia',
    });
    return this.stripe;
  }

  async isConfigured(): Promise<boolean> {
    const settings = await this.prisma.platformSettings.findFirst();
    return !!(settings?.stripeSecretKey && settings?.stripeBasePriceId);
  }

  async getPublishableKey(): Promise<string | null> {
    const settings = await this.prisma.platformSettings.findFirst();
    return settings?.stripePublishableKey || null;
  }

  // =========================================================================
  // CUSTOMER MANAGEMENT
  // =========================================================================

  async createCustomer(
    networkId: string,
    email: string,
    name: string,
  ): Promise<string> {
    const stripe = await this.getStripeClient();

    const network = await this.prisma.network.findUnique({
      where: { id: networkId },
    });

    // Ha már van customer, visszaadjuk azt
    if (network?.stripeCustomerId) {
      this.logger.log(`Network ${networkId} already has Stripe customer: ${network.stripeCustomerId}`);
      return network.stripeCustomerId;
    }

    const customer = await stripe.customers.create({
      email,
      name,
      metadata: {
        networkId,
        platform: 'vsys',
      },
    });

    await this.prisma.network.update({
      where: { id: networkId },
      data: { stripeCustomerId: customer.id },
    });

    this.logger.log(`Created Stripe customer ${customer.id} for network ${networkId}`);
    return customer.id;
  }

  async getOrCreateCustomer(
    networkId: string,
    email: string,
    name: string,
  ): Promise<string> {
    const network = await this.prisma.network.findUnique({
      where: { id: networkId },
    });

    if (network?.stripeCustomerId) {
      return network.stripeCustomerId;
    }

    return this.createCustomer(networkId, email, name);
  }

  // =========================================================================
  // CHECKOUT SESSION (Card Collection & Subscription Setup)
  // =========================================================================

  async createCheckoutSession(
    networkId: string,
    successUrl: string,
    cancelUrl: string,
  ): Promise<CheckoutSessionResponseDto> {
    const stripe = await this.getStripeClient();
    const settings = await this.prisma.platformSettings.findFirst();

    if (!settings?.stripeBasePriceId) {
      throw new BadRequestException('Stripe árazás nincs konfigurálva');
    }

    const network = await this.prisma.network.findUnique({
      where: { id: networkId },
      include: { networkAdmins: { where: { deletedAt: null }, take: 1 } },
    });

    if (!network) {
      throw new NotFoundException('Network nem található');
    }

    // Ensure we have a Stripe customer
    let customerId = network.stripeCustomerId;
    if (!customerId) {
      const adminEmail = network.networkAdmins[0]?.email || `network-${networkId}@vsys.hu`;
      customerId = await this.createCustomer(networkId, adminEmail, network.name);
    }

    // Calculate remaining trial days
    const trialDays = network.trialEndsAt
      ? Math.max(0, Math.ceil((network.trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : settings.defaultTrialDays;

    // Build line items
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      // Base monthly fee (flat rate)
      {
        price: settings.stripeBasePriceId,
        quantity: 1,
      },
    ];

    // Add usage-based price if configured
    if (settings.stripeUsagePriceId) {
      lineItems.push({
        price: settings.stripeUsagePriceId,
      });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      payment_method_types: ['card'],
      line_items: lineItems,
      subscription_data: {
        trial_period_days: trialDays > 0 ? trialDays : undefined,
        metadata: {
          networkId,
        },
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        networkId,
      },
      allow_promotion_codes: true,
    });

    this.logger.log(`Created checkout session ${session.id} for network ${networkId}`);

    return {
      sessionId: session.id,
      url: session.url!,
    };
  }

  // =========================================================================
  // SUBSCRIPTION MANAGEMENT
  // =========================================================================

  async getSubscription(networkId: string): Promise<SubscriptionDetailsDto> {
    const network = await this.prisma.network.findUnique({
      where: { id: networkId },
    });

    if (!network) {
      throw new NotFoundException('Network nem található');
    }

    const settings = await this.prisma.platformSettings.findFirst();

    // Effektív árak: egyedi ár, ha van, különben platform alapértelmezett
    const platformMonthlyFee = Number(settings?.baseMonthlyFee || 0);
    const platformPerWashFee = Number(settings?.perWashFee || 0);
    const effectiveMonthlyFee = network.customMonthlyFee !== null
      ? Number(network.customMonthlyFee)
      : platformMonthlyFee;
    const effectivePerWashFee = network.customPerWashFee !== null
      ? Number(network.customPerWashFee)
      : platformPerWashFee;

    // Ha nincs Stripe subscription, visszaadjuk a local státuszt
    if (!network.stripeSubscriptionId) {
      return {
        status: network.subscriptionStatus,
        cancelAtPeriodEnd: false,
        trialEnd: network.trialEndsAt,
        baseMonthlyFee: effectiveMonthlyFee,
        perWashFee: effectivePerWashFee,
        hasPaymentMethod: !!network.stripePaymentMethodId,
      };
    }

    try {
      const stripe = await this.getStripeClient();
      const subscription = await stripe.subscriptions.retrieve(
        network.stripeSubscriptionId,
      );

      // Get current month usage
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const washCount = await this.prisma.washEvent.count({
        where: {
          networkId,
          createdAt: { gte: startOfMonth },
        },
      });

      return {
        status: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        trialEnd: subscription.trial_end
          ? new Date(subscription.trial_end * 1000)
          : null,
        baseMonthlyFee: effectiveMonthlyFee,
        perWashFee: effectivePerWashFee,
        currentUsage: washCount,
        hasPaymentMethod: !!network.stripePaymentMethodId,
      };
    } catch (error) {
      this.logger.error(`Failed to get subscription: ${error.message}`);
      return {
        status: network.subscriptionStatus,
        cancelAtPeriodEnd: false,
        trialEnd: network.trialEndsAt,
        baseMonthlyFee: effectiveMonthlyFee,
        perWashFee: effectivePerWashFee,
        hasPaymentMethod: !!network.stripePaymentMethodId,
      };
    }
  }

  async cancelSubscription(networkId: string, atPeriodEnd = true): Promise<void> {
    const stripe = await this.getStripeClient();

    const network = await this.prisma.network.findUnique({
      where: { id: networkId },
    });

    if (!network?.stripeSubscriptionId) {
      throw new BadRequestException('Nincs aktív előfizetés');
    }

    if (atPeriodEnd) {
      await stripe.subscriptions.update(network.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
      this.logger.log(`Subscription ${network.stripeSubscriptionId} will cancel at period end`);
    } else {
      await stripe.subscriptions.cancel(network.stripeSubscriptionId);
      await this.prisma.network.update({
        where: { id: networkId },
        data: {
          subscriptionStatus: SubscriptionStatus.CANCELLED,
          subscriptionEndAt: new Date(),
        },
      });
      this.logger.log(`Subscription ${network.stripeSubscriptionId} cancelled immediately`);
    }
  }

  async reactivateSubscription(networkId: string): Promise<void> {
    const stripe = await this.getStripeClient();

    const network = await this.prisma.network.findUnique({
      where: { id: networkId },
    });

    if (!network?.stripeSubscriptionId) {
      throw new BadRequestException('Nincs előfizetés');
    }

    await stripe.subscriptions.update(network.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    this.logger.log(`Subscription ${network.stripeSubscriptionId} reactivated`);
  }

  // =========================================================================
  // USAGE REPORTING (Metered Billing)
  // =========================================================================

  async reportUsage(networkId: string, quantity: number): Promise<void> {
    const settings = await this.prisma.platformSettings.findFirst();

    // Ha nincs usage-based pricing, nem csinálunk semmit
    if (!settings?.stripeUsagePriceId) {
      return;
    }

    const network = await this.prisma.network.findUnique({
      where: { id: networkId },
    });

    if (!network?.stripeSubscriptionId) {
      this.logger.debug(`Cannot report usage: Network ${networkId} has no subscription`);
      return;
    }

    try {
      const stripe = await this.getStripeClient();

      // Get the subscription to find the metered item
      const subscription = await stripe.subscriptions.retrieve(
        network.stripeSubscriptionId,
      );

      // Find the metered subscription item
      const meteredItem = subscription.items.data.find(
        (item) => item.price.id === settings.stripeUsagePriceId,
      );

      if (!meteredItem) {
        this.logger.warn(`No metered item found for network ${networkId}`);
        return;
      }

      // Report usage (increment)
      await stripe.subscriptionItems.createUsageRecord(meteredItem.id, {
        quantity,
        timestamp: Math.floor(Date.now() / 1000),
        action: 'increment',
      });

      this.logger.debug(`Reported ${quantity} usage for network ${networkId}`);
    } catch (error) {
      this.logger.error(`Failed to report usage: ${error.message}`);
      // Don't throw - usage reporting should not break the wash flow
    }
  }

  // =========================================================================
  // BILLING PORTAL
  // =========================================================================

  async createBillingPortalSession(
    networkId: string,
    returnUrl: string,
  ): Promise<BillingPortalResponseDto> {
    const stripe = await this.getStripeClient();

    const network = await this.prisma.network.findUnique({
      where: { id: networkId },
    });

    if (!network?.stripeCustomerId) {
      throw new BadRequestException('Network nem rendelkezik Stripe fiókkal');
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: network.stripeCustomerId,
      return_url: returnUrl,
    });

    return { url: session.url };
  }

  // =========================================================================
  // WEBHOOK HANDLING
  // =========================================================================

  async handleWebhook(
    payload: Buffer,
    signature: string,
  ): Promise<{ received: boolean }> {
    const stripe = await this.getStripeClient();
    const settings = await this.prisma.platformSettings.findFirst();

    if (!settings?.stripeWebhookSecret) {
      throw new BadRequestException('Stripe webhook secret nincs konfigurálva');
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        payload,
        signature,
        settings.stripeWebhookSecret,
      );
    } catch (err) {
      this.logger.error(`Webhook signature verification failed: ${err}`);
      throw new BadRequestException('Webhook signature verification failed');
    }

    this.logger.log(`Received Stripe webhook: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
        await this.handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.paid':
        await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'customer.subscription.trial_will_end':
        await this.handleTrialWillEnd(event.data.object as Stripe.Subscription);
        break;

      default:
        this.logger.debug(`Unhandled event type: ${event.type}`);
    }

    return { received: true };
  }

  // =========================================================================
  // WEBHOOK HANDLERS
  // =========================================================================

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const networkId = session.metadata?.networkId;
    if (!networkId) {
      this.logger.warn('Checkout session without networkId metadata');
      return;
    }

    const subscriptionId = session.subscription as string;
    const paymentMethod = session.payment_method_types?.[0] || null;

    await this.prisma.network.update({
      where: { id: networkId },
      data: {
        stripeSubscriptionId: subscriptionId,
        stripePaymentMethodId: paymentMethod,
      },
    });

    this.logger.log(`Checkout completed for network ${networkId}, subscription: ${subscriptionId}`);
  }

  private async handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
    const networkId = subscription.metadata?.networkId;
    if (!networkId) {
      // Try to find by customer
      const network = await this.prisma.network.findFirst({
        where: { stripeCustomerId: subscription.customer as string },
      });
      if (!network) return;

      const status = this.mapStripeStatusToLocal(subscription.status);
      await this.prisma.network.update({
        where: { id: network.id },
        data: {
          stripeSubscriptionId: subscription.id,
          subscriptionStatus: status,
          subscriptionStartAt: new Date(subscription.current_period_start * 1000),
          trialEndsAt: subscription.trial_end
            ? new Date(subscription.trial_end * 1000)
            : null,
        },
      });
      return;
    }

    const status = this.mapStripeStatusToLocal(subscription.status);

    await this.prisma.network.update({
      where: { id: networkId },
      data: {
        stripeSubscriptionId: subscription.id,
        subscriptionStatus: status,
        subscriptionStartAt: new Date(subscription.current_period_start * 1000),
        trialEndsAt: subscription.trial_end
          ? new Date(subscription.trial_end * 1000)
          : null,
      },
    });

    this.logger.log(`Subscription created for network ${networkId}: ${subscription.id}`);
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    const network = await this.prisma.network.findFirst({
      where: { stripeSubscriptionId: subscription.id },
    });

    if (!network) {
      this.logger.warn(`No network found for subscription ${subscription.id}`);
      return;
    }

    const status = this.mapStripeStatusToLocal(subscription.status);

    await this.prisma.network.update({
      where: { id: network.id },
      data: {
        subscriptionStatus: status,
        subscriptionEndAt: subscription.cancel_at
          ? new Date(subscription.cancel_at * 1000)
          : null,
        trialEndsAt: subscription.trial_end
          ? new Date(subscription.trial_end * 1000)
          : null,
      },
    });

    this.logger.log(`Subscription updated for network ${network.id}: ${status}`);
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const network = await this.prisma.network.findFirst({
      where: { stripeSubscriptionId: subscription.id },
    });

    if (!network) return;

    await this.prisma.network.update({
      where: { id: network.id },
      data: {
        subscriptionStatus: SubscriptionStatus.CANCELLED,
        subscriptionEndAt: new Date(),
      },
    });

    this.logger.log(`Subscription deleted for network ${network.id}`);
  }

  private async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    const subscriptionId = invoice.subscription as string;
    if (!subscriptionId) return;

    const network = await this.prisma.network.findFirst({
      where: { stripeSubscriptionId: subscriptionId },
    });

    if (!network) return;

    await this.prisma.network.update({
      where: { id: network.id },
      data: {
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        lastPaymentStatus: 'succeeded',
        lastPaymentDate: new Date(),
        paymentFailedAt: null,
        paymentRetryCount: 0,
      },
    });

    this.logger.log(`Invoice paid for network ${network.id}`);
  }

  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const subscriptionId = invoice.subscription as string;
    if (!subscriptionId) return;

    const network = await this.prisma.network.findFirst({
      where: { stripeSubscriptionId: subscriptionId },
    });

    if (!network) return;

    await this.prisma.network.update({
      where: { id: network.id },
      data: {
        subscriptionStatus: SubscriptionStatus.SUSPENDED,
        lastPaymentStatus: 'failed',
        paymentFailedAt: new Date(),
        paymentRetryCount: { increment: 1 },
      },
    });

    // Send email notification about failed payment
    this.logger.warn(`Payment failed for network ${network.id}`);

    // Get network admins to notify
    const networkAdmins = await this.prisma.networkAdmin.findMany({
      where: { networkId: network.id, isActive: true },
      select: { email: true, name: true },
    });

    for (const admin of networkAdmins) {
      if (admin.email) {
        try {
          await this.emailService.sendPaymentFailedEmail(
            admin.email,
            network.name,
            0, // Amount would come from invoice in real implementation
            'HUF',
          );
          this.logger.log(`Payment failed email sent to ${admin.email} for network ${network.name}`);
        } catch (emailError) {
          this.logger.error(`Failed to send payment failed email: ${emailError.message}`);
        }
      }
    }
  }

  private async handleTrialWillEnd(subscription: Stripe.Subscription): Promise<void> {
    const network = await this.prisma.network.findFirst({
      where: { stripeSubscriptionId: subscription.id },
    });

    if (!network) return;

    // Send email notification that trial is ending in 3 days
    this.logger.log(`Trial ending soon for network ${network.id}`);

    const trialEndDate = subscription.trial_end ? new Date(subscription.trial_end * 1000) : new Date();
    const daysRemaining = Math.ceil((trialEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    // Get network admins to notify
    const networkAdmins = await this.prisma.networkAdmin.findMany({
      where: { networkId: network.id, isActive: true },
      select: { email: true, name: true },
    });

    for (const admin of networkAdmins) {
      if (admin.email) {
        try {
          await this.emailService.sendTrialEndingEmail(
            admin.email,
            network.name,
            trialEndDate,
            daysRemaining,
          );
          this.logger.log(`Trial ending email sent to ${admin.email} for network ${network.name}`);
        } catch (emailError) {
          this.logger.error(`Failed to send trial ending email: ${emailError.message}`);
        }
      }
    }
  }

  // =========================================================================
  // HELPERS
  // =========================================================================

  private mapStripeStatusToLocal(stripeStatus: Stripe.Subscription.Status): SubscriptionStatus {
    switch (stripeStatus) {
      case 'trialing':
        return SubscriptionStatus.TRIAL;
      case 'active':
        return SubscriptionStatus.ACTIVE;
      case 'past_due':
      case 'unpaid':
        return SubscriptionStatus.SUSPENDED;
      case 'canceled':
      case 'incomplete':
      case 'incomplete_expired':
        return SubscriptionStatus.CANCELLED;
      default:
        return SubscriptionStatus.TRIAL;
    }
  }
}
