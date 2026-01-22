import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { InvoiceProvider, CreateInvoiceRequest, InvoiceLineItem } from '../billing/invoice-provider.interface';
import { SzamlazzProvider } from '../billing/szamlazz.provider';
import { BillingoProvider } from '../billing/billingo.provider';
import { Decimal } from '@prisma/client/runtime/library';
import { InvoiceProvider as InvoiceProviderEnum } from '@prisma/client';

// Define PlatformInvoiceStatus locally since Prisma client might not be regenerated yet
type PlatformInvoiceStatus = 'DRAFT' | 'ISSUED' | 'SENT' | 'PAID' | 'CANCELLED' | 'OVERDUE';

/**
 * Platform Billing Service - handles invoicing from Platform to Networks
 *
 * This service manages the billing cycle where the Platform (vSys) invoices
 * individual Networks for their usage (monthly base fee + per-wash fees).
 */
@Injectable()
export class PlatformBillingService {
  private readonly logger = new Logger(PlatformBillingService.name);
  private providers: Map<string, InvoiceProvider> = new Map();

  constructor(
    private prisma: PrismaService,
    private szamlazzProvider: SzamlazzProvider,
    private billingoProvider: BillingoProvider,
  ) {
    this.providers.set('szamlazz', this.szamlazzProvider);
    this.providers.set('billingo', this.billingoProvider);
  }

  /**
   * Get Platform settings with company data for invoicing
   */
  private async getPlatformSettings() {
    const settings = await this.prisma.platformSettings.findFirst();
    if (!settings) {
      throw new BadRequestException('Platform settings not configured');
    }
    return settings;
  }

  /**
   * Get Network settings with company data for invoicing
   */
  private async getNetworkBillingInfo(networkId: string) {
    const network = await this.prisma.network.findUnique({
      where: { id: networkId },
      include: { settings: true },
    });

    if (!network) {
      throw new NotFoundException('Network not found');
    }

    return {
      network,
      settings: network.settings,
    };
  }

  /**
   * Get the configured invoice provider for Platform-level invoicing
   */
  async getProviderForPlatform(): Promise<{ provider: InvoiceProvider | null; providerName: string }> {
    const settings = await this.getPlatformSettings();

    if (!settings.invoiceProvider || settings.invoiceProvider === InvoiceProviderEnum.NONE || settings.invoiceProvider === InvoiceProviderEnum.MANUAL) {
      return { provider: null, providerName: 'none' };
    }

    if (settings.invoiceProvider === InvoiceProviderEnum.SZAMLAZZ) {
      if (settings.szamlazzAgentKey) {
        // Configure provider with platform settings
        // Note: SzamlazzProvider uses env vars by default, but we could pass settings
        return { provider: this.szamlazzProvider, providerName: 'szamlazz' };
      }
      return { provider: null, providerName: 'szamlazz' };
    }

    if (settings.invoiceProvider === InvoiceProviderEnum.BILLINGO) {
      if (settings.billingoApiKey && settings.billingoBlockId) {
        this.billingoProvider.configure(
          settings.billingoApiKey,
          settings.billingoBlockId,
          settings.billingoBankAccountId || undefined,
        );
        return { provider: this.billingoProvider, providerName: 'billingo' };
      }
      return { provider: null, providerName: 'billingo' };
    }

    return { provider: null, providerName: 'none' };
  }

  /**
   * Calculate usage for a network in a given period
   */
  async calculateNetworkUsage(
    networkId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<{
    washCount: number;
    driverCount: number;
    locationCount: number;
    baseFeeDue: number;
    washFeeDue: number;
    totalDue: number;
  }> {
    const { network } = await this.getNetworkBillingInfo(networkId);
    const platformSettings = await this.getPlatformSettings();

    // Count completed washes in the period
    const washCount = await this.prisma.washEvent.count({
      where: {
        networkId,
        status: 'COMPLETED',
        completedAt: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
    });

    // Count active drivers
    const driverCount = await this.prisma.driver.count({
      where: {
        networkId,
        isActive: true,
        deletedAt: null,
      },
    });

    // Count active locations
    const locationCount = await this.prisma.location.count({
      where: {
        networkId,
        isActive: true,
        deletedAt: null,
      },
    });

    // Calculate fees (use custom pricing if set, otherwise platform defaults)
    // Havi alapdíj: alapdíj × helyszínek száma (minden aktív mosóért külön díj)
    const baseMonthlyFeePerLocation = network.customMonthlyFee
      ? Number(network.customMonthlyFee)
      : Number(platformSettings.baseMonthlyFee);

    const perWashFee = network.customPerWashFee
      ? Number(network.customPerWashFee)
      : Number(platformSettings.perWashFee);

    // Havi alapdíj = alapdíj/mosó × aktív helyszínek száma
    const baseFeeDue = baseMonthlyFeePerLocation * locationCount;
    const washFeeDue = washCount * perWashFee;
    const totalDue = baseFeeDue + washFeeDue;

    return {
      washCount,
      driverCount,
      locationCount,
      baseFeeDue,
      washFeeDue,
      totalDue,
    };
  }

  /**
   * Create a UsageLog entry for a network's billing period
   */
  async createUsageLog(
    networkId: string,
    periodStart: Date,
    periodEnd: Date,
  ) {
    const usage = await this.calculateNetworkUsage(networkId, periodStart, periodEnd);

    return this.prisma.usageLog.create({
      data: {
        networkId,
        periodStart,
        periodEnd,
        washCount: usage.washCount,
        driverCount: usage.driverCount,
        locationCount: usage.locationCount,
        baseFeeDue: new Decimal(usage.baseFeeDue),
        washFeeDue: new Decimal(usage.washFeeDue),
        totalDue: new Decimal(usage.totalDue),
        isPaid: false,
      },
    });
  }

  /**
   * Prepare a Platform Invoice for a Network (creates DRAFT invoice)
   */
  async preparePlatformInvoice(
    networkId: string,
    periodStart: Date,
    periodEnd: Date,
  ) {
    const { network } = await this.getNetworkBillingInfo(networkId);
    const platformSettings = await this.getPlatformSettings();

    // Check if network has billing data for Platform invoicing
    if (!network.billingCompanyName) {
      throw new BadRequestException(
        'Network számlázási adatok nincsenek beállítva. Kérjük, konfigurálja a Platform Admin > Networks > Számlázás fülön.',
      );
    }

    // Validate required billing fields
    if (!network.billingAddress || !network.billingCity || !network.billingZipCode) {
      throw new BadRequestException(
        'Network számlázási cím hiányos. Kérjük, adja meg a címet, várost és irányítószámot.',
      );
    }

    // Check if platform has company data for invoicing
    if (!platformSettings.companyName) {
      throw new BadRequestException(
        'Platform company data not configured. Please configure company details in Platform Settings.',
      );
    }

    // Calculate usage
    const usage = await this.calculateNetworkUsage(networkId, periodStart, periodEnd);

    if (usage.totalDue <= 0) {
      throw new BadRequestException('No fees due for this period');
    }

    // Create invoice items
    const items: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      vatRate: number;
      unit: string;
      itemType: string;
    }> = [];

    // Base monthly fee - per location
    if (usage.baseFeeDue > 0 && usage.locationCount > 0) {
      const perLocationFee = usage.baseFeeDue / usage.locationCount;
      items.push({
        description: `vSys Platform - Havi alapdíj (${periodStart.toISOString().split('T')[0]} - ${periodEnd.toISOString().split('T')[0]}) - ${usage.locationCount} mosó`,
        quantity: usage.locationCount,
        unitPrice: perLocationFee,
        totalPrice: usage.baseFeeDue,
        vatRate: 27,
        unit: 'db',
        itemType: 'BASE_FEE',
      });
    }

    // Per-wash fee
    if (usage.washCount > 0 && usage.washFeeDue > 0) {
      const perWashFee = usage.washFeeDue / usage.washCount;
      items.push({
        description: `vSys Platform - Mosás díj (${usage.washCount} db)`,
        quantity: usage.washCount,
        unitPrice: perWashFee,
        totalPrice: usage.washFeeDue,
        vatRate: 27,
        unit: 'db',
        itemType: 'WASH_FEE',
      });
    }

    // Calculate totals
    const subtotal = usage.totalDue;
    const vatAmount = subtotal * 0.27;
    const total = subtotal + vatAmount;

    // Default payment due days (8 days)
    const paymentDueDays = 8;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + paymentDueDays);

    // Create the invoice
    const invoice = await this.prisma.platformInvoice.create({
      data: {
        networkId,
        periodStart,
        periodEnd,
        subtotal: new Decimal(subtotal),
        vatRate: 27,
        vatAmount: new Decimal(vatAmount),
        total: new Decimal(total),
        currency: 'HUF',
        status: 'DRAFT',
        dueDate,
        // Buyer (Network) data - from Network billing fields (Platform Admin managed)
        buyerName: network.billingCompanyName,
        buyerAddress: network.billingAddress || '',
        buyerCity: network.billingCity || '',
        buyerZipCode: network.billingZipCode || '',
        buyerCountry: network.billingCountry || 'HU',
        buyerTaxNumber: network.billingTaxNumber,
        buyerEuVatNumber: network.billingEuVatNumber,
        // Seller (Platform) data
        sellerName: platformSettings.companyName,
        sellerAddress: platformSettings.companyAddress || '',
        sellerCity: platformSettings.companyCity || '',
        sellerZipCode: platformSettings.companyZipCode || '',
        sellerCountry: platformSettings.companyCountry || 'HU',
        sellerTaxNumber: platformSettings.taxNumber,
        sellerEuVatNumber: platformSettings.euVatNumber,
        sellerBankAccount: platformSettings.bankAccountNumber || platformSettings.bankAccountIban,
        sellerBankName: platformSettings.bankName,
        // Items
        items: {
          create: items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: new Decimal(item.unitPrice),
            totalPrice: new Decimal(item.totalPrice),
            vatRate: item.vatRate,
            unit: item.unit,
            itemType: item.itemType,
          })),
        },
      },
      include: {
        items: true,
        network: true,
      },
    });

    // Create or link UsageLog
    await this.prisma.usageLog.create({
      data: {
        networkId,
        periodStart,
        periodEnd,
        washCount: usage.washCount,
        driverCount: usage.driverCount,
        locationCount: usage.locationCount,
        baseFeeDue: new Decimal(usage.baseFeeDue),
        washFeeDue: new Decimal(usage.washFeeDue),
        totalDue: new Decimal(usage.totalDue),
        isPaid: false,
        platformInvoiceId: invoice.id,
      },
    });

    return invoice;
  }

  /**
   * Issue a Platform Invoice through the configured provider
   */
  async issuePlatformInvoice(invoiceId: string) {
    const invoice = await this.prisma.platformInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        items: true,
        network: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status !== 'DRAFT') {
      throw new BadRequestException('Invoice is not in DRAFT status');
    }

    const { provider, providerName } = await this.getProviderForPlatform();

    if (!provider) {
      throw new BadRequestException(
        'No invoice provider configured. Please configure Számlázz.hu or Billingo in Platform Settings.',
      );
    }

    // Prepare line items
    const lineItems: InvoiceLineItem[] = invoice.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      vatRate: item.vatRate,
      unit: item.unit,
    }));

    const createRequest: CreateInvoiceRequest = {
      customer: {
        name: invoice.buyerName,
        address: invoice.buyerAddress,
        city: invoice.buyerCity,
        zipCode: invoice.buyerZipCode,
        country: invoice.buyerCountry,
        taxNumber: invoice.buyerTaxNumber || undefined,
        euVatNumber: invoice.buyerEuVatNumber || undefined,
      },
      currency: invoice.currency,
      language: 'hu',
      paymentMethod: 'transfer',
      paymentDueDays: invoice.dueDate
        ? Math.ceil((invoice.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : 8,
      items: lineItems,
    };

    const result = await provider.createInvoice(createRequest);

    if (result.success) {
      // Update invoice with provider response
      await this.prisma.platformInvoice.update({
        where: { id: invoiceId },
        data: {
          status: 'ISSUED',
          invoiceNumber: result.invoiceNumber,
          externalId: result.externalId,
          issueDate: new Date(),
          providerName,
          providerPdfUrl: result.pdfUrl,
          providerResponse: result.rawResponse,
        },
      });

      return {
        success: true,
        invoiceNumber: result.invoiceNumber,
        pdfUrl: result.pdfUrl,
      };
    } else {
      return {
        success: false,
        error: result.error,
      };
    }
  }

  /**
   * Mark a Platform Invoice as paid
   */
  async markPlatformInvoicePaid(invoiceId: string, paidDate?: Date) {
    const invoice = await this.prisma.platformInvoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status === 'PAID') {
      throw new BadRequestException('Invoice is already paid');
    }

    if (invoice.status === 'CANCELLED') {
      throw new BadRequestException('Cannot mark cancelled invoice as paid');
    }

    // Update invoice
    await this.prisma.platformInvoice.update({
      where: { id: invoiceId },
      data: {
        status: 'PAID',
        paidDate: paidDate || new Date(),
      },
    });

    // Update linked usage logs
    await this.prisma.usageLog.updateMany({
      where: { platformInvoiceId: invoiceId },
      data: {
        isPaid: true,
        paidAt: paidDate || new Date(),
        invoiceNumber: invoice.invoiceNumber,
      },
    });

    return this.prisma.platformInvoice.findUnique({
      where: { id: invoiceId },
      include: { items: true, network: true },
    });
  }

  /**
   * Cancel a Platform Invoice
   */
  async cancelPlatformInvoice(invoiceId: string, reason?: string) {
    const invoice = await this.prisma.platformInvoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status === 'CANCELLED') {
      throw new BadRequestException('Invoice is already cancelled');
    }

    // If invoice was issued externally, cancel it there too
    if (invoice.invoiceNumber && invoice.status === 'ISSUED' && invoice.providerName) {
      const provider = this.providers.get(invoice.providerName);
      if (provider) {
        const result = await provider.cancelInvoice({
          invoiceNumber: invoice.invoiceNumber,
          reason,
        });

        if (!result.success) {
          throw new BadRequestException(
            `Failed to cancel invoice in ${invoice.providerName}: ${result.error}`,
          );
        }
      }
    }

    // Unlink usage logs
    await this.prisma.usageLog.updateMany({
      where: { platformInvoiceId: invoiceId },
      data: { platformInvoiceId: null },
    });

    return this.prisma.platformInvoice.update({
      where: { id: invoiceId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });
  }

  /**
   * Get a Platform Invoice with full details
   */
  async getPlatformInvoice(invoiceId: string) {
    return this.prisma.platformInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        items: true,
        network: true,
        usageLogs: true,
      },
    });
  }

  /**
   * Query Platform Invoices with filters
   */
  async queryPlatformInvoices(filters: {
    networkId?: string;
    status?: PlatformInvoiceStatus;
    issueDateFrom?: Date;
    issueDateTo?: Date;
    dueDateFrom?: Date;
    dueDateTo?: Date;
  }) {
    return this.prisma.platformInvoice.findMany({
      where: {
        ...(filters.networkId && { networkId: filters.networkId }),
        ...(filters.status && { status: filters.status }),
        ...(filters.issueDateFrom && {
          issueDate: { gte: filters.issueDateFrom },
        }),
        ...(filters.issueDateTo && {
          issueDate: { lte: filters.issueDateTo },
        }),
        ...(filters.dueDateFrom && {
          dueDate: { gte: filters.dueDateFrom },
        }),
        ...(filters.dueDateTo && {
          dueDate: { lte: filters.dueDateTo },
        }),
      },
      include: {
        network: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        _count: {
          select: {
            items: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Process overdue Platform Invoices
   */
  async processOverduePlatformInvoices() {
    const now = new Date();

    const result = await this.prisma.platformInvoice.updateMany({
      where: {
        status: 'ISSUED',
        dueDate: {
          lt: now,
        },
      },
      data: {
        status: 'OVERDUE',
      },
    });

    return result.count;
  }

  /**
   * Generate invoices for all active networks for a billing period
   * Typically called at the end of each month
   */
  async generateMonthlyInvoices(year: number, month: number) {
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0, 23, 59, 59, 999); // Last day of month

    // Get all active networks with active subscription
    const networks = await this.prisma.network.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        subscriptionStatus: { in: ['ACTIVE', 'TRIAL'] },
      },
    });

    const results: Array<{
      networkId: string;
      networkName: string;
      success: boolean;
      invoiceId?: string;
      error?: string;
    }> = [];

    for (const network of networks) {
      try {
        // Check if invoice already exists for this period
        const existingInvoice = await this.prisma.platformInvoice.findFirst({
          where: {
            networkId: network.id,
            periodStart,
            periodEnd,
          },
        });

        if (existingInvoice) {
          results.push({
            networkId: network.id,
            networkName: network.name,
            success: false,
            error: 'Invoice already exists for this period',
          });
          continue;
        }

        const invoice = await this.preparePlatformInvoice(
          network.id,
          periodStart,
          periodEnd,
        );

        results.push({
          networkId: network.id,
          networkName: network.name,
          success: true,
          invoiceId: invoice.id,
        });
      } catch (error: any) {
        results.push({
          networkId: network.id,
          networkName: network.name,
          success: false,
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Get billing summary for Platform Admin dashboard
   */
  async getPlatformBillingSummary() {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Count invoices by status
    const invoicesByStatus = await this.prisma.platformInvoice.groupBy({
      by: ['status'],
      _count: { id: true },
      _sum: { total: true },
    });

    // This month's revenue (paid invoices)
    const thisMonthRevenue = await this.prisma.platformInvoice.aggregate({
      where: {
        status: 'PAID',
        paidDate: { gte: thisMonthStart },
      },
      _sum: { total: true },
    });

    // Last month's revenue
    const lastMonthRevenue = await this.prisma.platformInvoice.aggregate({
      where: {
        status: 'PAID',
        paidDate: {
          gte: lastMonthStart,
          lte: lastMonthEnd,
        },
      },
      _sum: { total: true },
    });

    // Outstanding amount (issued + overdue)
    const outstanding = await this.prisma.platformInvoice.aggregate({
      where: {
        status: { in: ['ISSUED', 'OVERDUE'] },
      },
      _sum: { total: true },
      _count: { id: true },
    });

    // Active networks count
    const activeNetworks = await this.prisma.network.count({
      where: {
        isActive: true,
        deletedAt: null,
        subscriptionStatus: { in: ['ACTIVE', 'TRIAL'] },
      },
    });

    return {
      invoicesByStatus: invoicesByStatus.map((s) => ({
        status: s.status,
        count: s._count.id,
        totalAmount: Number(s._sum.total || 0),
      })),
      thisMonthRevenue: Number(thisMonthRevenue._sum.total || 0),
      lastMonthRevenue: Number(lastMonthRevenue._sum.total || 0),
      outstandingAmount: Number(outstanding._sum.total || 0),
      outstandingCount: outstanding._count.id,
      activeNetworks,
    };
  }
}
