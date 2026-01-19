import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { InvoiceProvider, CreateInvoiceRequest, InvoiceLineItem } from './invoice-provider.interface';
import { SzamlazzProvider } from './szamlazz.provider';
import { BillingoProvider } from './billingo.provider';
import { NavOnlineProvider } from './nav-online.provider';
import { ViesService } from './vies.service';
import { Decimal } from '@prisma/client/runtime/library';
import {
  VehicleType,
  InvoiceProvider as InvoiceProviderEnum,
  LocationInvoiceType,
  LocationInvoiceStatus,
  LocationStatementStatus,
  BillingType,
  BillingCycle,
  PaymentMethod,
} from '@prisma/client';

@Injectable()
export class LocationBillingService {
  private readonly logger = new Logger(LocationBillingService.name);
  private providers: Map<string, InvoiceProvider> = new Map();

  constructor(
    private prisma: PrismaService,
    private szamlazzProvider: SzamlazzProvider,
    private billingoProvider: BillingoProvider,
    private navOnlineProvider: NavOnlineProvider,
    private viesService: ViesService,
  ) {
    this.providers.set('szamlazz', this.szamlazzProvider);
    this.providers.set('billingo', this.billingoProvider);
    this.providers.set('nav_online', this.navOnlineProvider);
  }

  // =============================================================================
  // PROVIDER CONFIGURATION
  // =============================================================================

  /**
   * Get the configured invoice provider for a location (subcontractor)
   */
  async getProviderForLocation(locationId: string): Promise<{ provider: InvoiceProvider | null; providerName: string }> {
    const settings = await this.prisma.locationBillingSettings.findUnique({
      where: { locationId },
    });

    if (!settings || settings.invoiceProvider === InvoiceProviderEnum.NONE || settings.invoiceProvider === InvoiceProviderEnum.MANUAL) {
      return { provider: null, providerName: 'none' };
    }

    if (settings.invoiceProvider === InvoiceProviderEnum.SZAMLAZZ) {
      if (settings.szamlazzAgentKey) {
        // TODO: Configure szamlazz with location-specific key
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

    if (settings.invoiceProvider === InvoiceProviderEnum.NAV_ONLINE) {
      if (settings.navOnlineUser && settings.navOnlineSignKey) {
        this.navOnlineProvider.configure(
          settings.navOnlineUser,
          settings.navOnlinePassword || '',
          settings.navOnlineTaxNum || '',
          settings.navOnlineSignKey,
          settings.navOnlineExchKey || '',
          false,
        );
        return { provider: this.navOnlineProvider, providerName: 'nav_online' };
      }
      return { provider: null, providerName: 'nav_online' };
    }

    return { provider: null, providerName: 'none' };
  }

  // =============================================================================
  // LOCATION BILLING SETTINGS
  // =============================================================================

  async getBillingSettings(locationId: string) {
    const location = await this.prisma.location.findUnique({
      where: { id: locationId },
      include: { billingSettings: true },
    });

    if (!location) {
      throw new NotFoundException('Location not found');
    }

    return location.billingSettings;
  }

  async updateBillingSettings(
    locationId: string,
    data: {
      invoiceProvider?: InvoiceProviderEnum;
      szamlazzAgentKey?: string;
      billingoApiKey?: string;
      billingoBlockId?: number;
      billingoBankAccountId?: number;
      navOnlineUser?: string;
      navOnlinePassword?: string;
      navOnlineTaxNum?: string;
      navOnlineSignKey?: string;
      navOnlineExchKey?: string;
      sellerName?: string;
      sellerAddress?: string;
      sellerCity?: string;
      sellerZipCode?: string;
      sellerCountry?: string;
      sellerTaxNumber?: string;
      sellerEuVatNumber?: string;
      sellerBankAccount?: string;
      sellerBankName?: string;
      contactEmail?: string;
      contactPhone?: string;
    },
  ) {
    const location = await this.prisma.location.findUnique({
      where: { id: locationId },
    });

    if (!location) {
      throw new NotFoundException('Location not found');
    }

    if (location.operationType !== 'SUBCONTRACTOR') {
      throw new BadRequestException('Billing settings can only be configured for SUBCONTRACTOR locations');
    }

    return this.prisma.locationBillingSettings.upsert({
      where: { locationId },
      update: data,
      create: {
        locationId,
        ...data,
      },
    });
  }

  // =============================================================================
  // LOCATION PARTNER MANAGEMENT
  // =============================================================================

  /**
   * Check if a tax number belongs to a Network partner
   * This prevents subcontractors from adding Network partners as their own
   */
  async checkTaxNumberCollision(locationId: string, taxNumber: string): Promise<{
    isNetworkPartner: boolean;
    partnerName?: string;
  }> {
    const location = await this.prisma.location.findUnique({
      where: { id: locationId },
      select: { networkId: true },
    });

    if (!location) {
      throw new NotFoundException('Location not found');
    }

    const networkPartner = await this.prisma.partnerCompany.findFirst({
      where: {
        networkId: location.networkId,
        taxNumber,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true, name: true },
    });

    return {
      isNetworkPartner: !!networkPartner,
      partnerName: networkPartner?.name,
    };
  }

  /**
   * Create a location partner with collision check
   */
  async createLocationPartner(
    locationId: string,
    data: {
      name: string;
      code: string;
      contactName?: string;
      email?: string;
      phone?: string;
      billingType: BillingType;
      billingCycle?: BillingCycle;
      billingName?: string;
      billingAddress?: string;
      billingCity?: string;
      billingZipCode?: string;
      billingCountry?: string;
      taxNumber?: string;
      euVatNumber?: string;
      paymentDueDays?: number;
    },
  ) {
    const location = await this.prisma.location.findUnique({
      where: { id: locationId },
      include: { network: true },
    });

    if (!location) {
      throw new NotFoundException('Location not found');
    }

    if (location.operationType !== 'SUBCONTRACTOR') {
      throw new BadRequestException('Partners can only be added to SUBCONTRACTOR locations');
    }

    // Check for tax number collision with Network partners
    if (data.taxNumber) {
      const collision = await this.checkTaxNumberCollision(locationId, data.taxNumber);
      if (collision.isNetworkPartner) {
        // Notify Network about the attempt (could be done via event/queue)
        this.logger.warn(
          `Subcontractor location ${locationId} attempted to add Network partner ${collision.partnerName} (tax: ${data.taxNumber}) as their own partner`,
        );

        throw new ConflictException(
          `Ez a cég már a Network partnere (${collision.partnerName}). ` +
          `Közvetlen szerződésre és számlázásra nincs lehetőség. ` +
          `A Network közvetlenül számlázza az ügyfelet.`,
        );
      }
    }

    return this.prisma.locationPartner.create({
      data: {
        locationId,
        name: data.name,
        code: data.code,
        contactName: data.contactName,
        email: data.email,
        phone: data.phone,
        billingType: data.billingType,
        billingCycle: data.billingCycle,
        billingName: data.billingName,
        billingAddress: data.billingAddress,
        billingCity: data.billingCity,
        billingZipCode: data.billingZipCode,
        billingCountry: data.billingCountry,
        taxNumber: data.taxNumber,
        euVatNumber: data.euVatNumber,
        paymentDueDays: data.paymentDueDays || 8,
      },
    });
  }

  async getLocationPartners(locationId: string) {
    return this.prisma.locationPartner.findMany({
      where: {
        locationId,
        isActive: true,
        deletedAt: null,
      },
      orderBy: { name: 'asc' },
    });
  }

  async getLocationPartner(partnerId: string) {
    return this.prisma.locationPartner.findUnique({
      where: { id: partnerId },
    });
  }

  async updateLocationPartner(
    partnerId: string,
    data: Partial<{
      name: string;
      contactName: string;
      email: string;
      phone: string;
      billingType: BillingType;
      billingCycle: BillingCycle;
      billingName: string;
      billingAddress: string;
      billingCity: string;
      billingZipCode: string;
      billingCountry: string;
      taxNumber: string;
      euVatNumber: string;
      paymentDueDays: number;
      isActive: boolean;
    }>,
  ) {
    const partner = await this.prisma.locationPartner.findUnique({
      where: { id: partnerId },
    });

    if (!partner) {
      throw new NotFoundException('Location partner not found');
    }

    // If tax number is being updated, check for collision
    if (data.taxNumber && data.taxNumber !== partner.taxNumber) {
      const collision = await this.checkTaxNumberCollision(partner.locationId, data.taxNumber);
      if (collision.isNetworkPartner) {
        throw new ConflictException(
          `Ez a cég már a Network partnere (${collision.partnerName}). ` +
          `Közvetlen szerződésre és számlázásra nincs lehetőség.`,
        );
      }
    }

    return this.prisma.locationPartner.update({
      where: { id: partnerId },
      data,
    });
  }

  async deleteLocationPartner(partnerId: string) {
    return this.prisma.locationPartner.update({
      where: { id: partnerId },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });
  }

  // =============================================================================
  // NETWORK PARTNER BILLING BLOCK
  // =============================================================================

  /**
   * Check if a customer can be billed directly by the subcontractor
   * Returns false if the customer is a Network partner (must be billed by Network)
   */
  async canLocationBillCustomer(
    locationId: string,
    partnerCompanyId?: string,
    taxNumber?: string,
  ): Promise<{
    canBill: boolean;
    reason?: string;
    networkPartnerName?: string;
  }> {
    const location = await this.prisma.location.findUnique({
      where: { id: locationId },
      select: { networkId: true, operationType: true },
    });

    if (!location) {
      throw new NotFoundException('Location not found');
    }

    // Only applies to subcontractor locations
    if (location.operationType !== 'SUBCONTRACTOR') {
      return { canBill: true };
    }

    // Check if this is a Network partner by ID
    if (partnerCompanyId) {
      const networkPartner = await this.prisma.partnerCompany.findFirst({
        where: {
          id: partnerCompanyId,
          networkId: location.networkId,
          isActive: true,
        },
        select: { name: true },
      });

      if (networkPartner) {
        return {
          canBill: false,
          reason: 'Ez az ügyfél a Network szerződéses partnere. A számlázást a Network végzi közvetlenül.',
          networkPartnerName: networkPartner.name,
        };
      }
    }

    // Check by tax number (for walk-in billing attempts)
    if (taxNumber) {
      const collision = await this.checkTaxNumberCollision(locationId, taxNumber);
      if (collision.isNetworkPartner) {
        return {
          canBill: false,
          reason: 'Ez az ügyfél a Network szerződéses partnere. A számlázást a Network végzi közvetlenül.',
          networkPartnerName: collision.partnerName,
        };
      }
    }

    return { canBill: true };
  }

  // =============================================================================
  // WALK-IN INVOICE (Helyszíni azonnali számla)
  // =============================================================================

  /**
   * Create and issue a walk-in invoice for immediate cash/card payment
   * This is issued by the SUBCONTRACTOR, not the Network
   */
  async createWalkInInvoice(
    locationId: string,
    washEventId: string,
    paymentMethod: PaymentMethod,
    billingData: {
      billingName: string;
      billingAddress: string;
      billingCity: string;
      billingZipCode: string;
      billingCountry?: string;
      billingTaxNumber?: string;
      billingEmail?: string;
    },
  ) {
    const washEvent = await this.prisma.washEvent.findUnique({
      where: { id: washEventId },
      include: {
        location: { include: { billingSettings: true } },
        services: { include: { servicePackage: true } },
      },
    });

    if (!washEvent) {
      throw new NotFoundException('Wash event not found');
    }

    if (washEvent.locationId !== locationId) {
      throw new BadRequestException('Wash event does not belong to this location');
    }

    if (washEvent.locationInvoiceId) {
      throw new BadRequestException('Wash event already has a location invoice');
    }

    // Check if this tax number belongs to a Network partner
    if (billingData.billingTaxNumber) {
      const canBill = await this.canLocationBillCustomer(locationId, undefined, billingData.billingTaxNumber);
      if (!canBill.canBill) {
        throw new BadRequestException(canBill.reason);
      }
    }

    const location = washEvent.location;
    const billingSettings = location.billingSettings;

    if (!billingSettings) {
      throw new BadRequestException('Location billing settings not configured');
    }

    // Calculate totals from wash event services
    let subtotal = 0;
    const items: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      vatRate: number;
      washEventId: string;
      vehicleType: VehicleType | null;
    }> = [];

    for (const service of washEvent.services) {
      const price = Number(service.totalPrice);
      subtotal += price;
      items.push({
        description: `${service.servicePackage.name} - ${service.vehicleRole || 'Jármű'} (${service.plateNumber || ''})`,
        quantity: service.quantity,
        unitPrice: Number(service.unitPrice),
        totalPrice: price,
        vatRate: 27,
        washEventId: washEvent.id,
        vehicleType: service.vehicleType,
      });
    }

    // If no services, use legacy pricing
    if (items.length === 0 && washEvent.finalPrice) {
      subtotal = Number(washEvent.finalPrice);
      items.push({
        description: 'Járműmosás',
        quantity: 1,
        unitPrice: subtotal,
        totalPrice: subtotal,
        vatRate: 27,
        washEventId: washEvent.id,
        vehicleType: null,
      });
    }

    const vatAmount = subtotal * 0.27;
    const total = subtotal + vatAmount;

    // Create location invoice
    const invoice = await this.prisma.locationInvoice.create({
      data: {
        locationId,
        invoiceType: LocationInvoiceType.WALK_IN,
        subtotal: new Decimal(subtotal),
        vatRate: 27,
        vatAmount: new Decimal(vatAmount),
        total: new Decimal(total),
        currency: 'HUF',
        status: LocationInvoiceStatus.DRAFT,
        paymentMethod,
        issueDate: new Date(),
        dueDate: new Date(),
        // Buyer data
        buyerName: billingData.billingName,
        buyerAddress: billingData.billingAddress,
        buyerCity: billingData.billingCity,
        buyerZipCode: billingData.billingZipCode,
        buyerCountry: billingData.billingCountry || 'HU',
        buyerTaxNumber: billingData.billingTaxNumber,
        buyerEmail: billingData.billingEmail,
        // Seller data (from location billing settings)
        sellerName: billingSettings.sellerName || location.subcontractorCompanyName || '',
        sellerAddress: billingSettings.sellerAddress || location.subcontractorAddress || '',
        sellerCity: billingSettings.sellerCity || location.subcontractorCity || '',
        sellerZipCode: billingSettings.sellerZipCode || location.subcontractorZipCode || '',
        sellerCountry: billingSettings.sellerCountry || 'HU',
        sellerTaxNumber: billingSettings.sellerTaxNumber || location.subcontractorTaxNumber,
        sellerBankAccount: billingSettings.sellerBankAccount || location.subcontractorBankAccount,
        sellerBankName: billingSettings.sellerBankName,
        items: {
          create: items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: new Decimal(item.unitPrice),
            totalPrice: new Decimal(item.totalPrice),
            vatRate: item.vatRate,
            washEventId: item.washEventId,
            vehicleType: item.vehicleType,
          })),
        },
      },
      include: { items: true },
    });

    // Link wash event to location invoice
    await this.prisma.washEvent.update({
      where: { id: washEventId },
      data: {
        locationInvoiceId: invoice.id,
        paymentMethod,
        paidAt: new Date(),
        // Also update walk-in billing data for record keeping
        walkInInvoiceRequested: true,
        walkInBillingName: billingData.billingName,
        walkInBillingAddress: billingData.billingAddress,
        walkInBillingCity: billingData.billingCity,
        walkInBillingZipCode: billingData.billingZipCode,
        walkInBillingCountry: billingData.billingCountry,
        walkInBillingTaxNumber: billingData.billingTaxNumber,
        walkInBillingEmail: billingData.billingEmail,
      },
    });

    return invoice;
  }

  // =============================================================================
  // LOCATION PARTNER INVOICE (Gyűjtőszámla saját partnernek)
  // =============================================================================

  /**
   * Prepare a collection invoice for a location partner
   */
  async preparePartnerInvoice(
    locationId: string,
    locationPartnerId: string,
    periodStart: Date,
    periodEnd: Date,
  ) {
    const partner = await this.prisma.locationPartner.findUnique({
      where: { id: locationPartnerId },
    });

    if (!partner) {
      throw new NotFoundException('Location partner not found');
    }

    if (partner.locationId !== locationId) {
      throw new BadRequestException('Partner does not belong to this location');
    }

    const location = await this.prisma.location.findUnique({
      where: { id: locationId },
      include: { billingSettings: true },
    });

    if (!location) {
      throw new NotFoundException('Location not found');
    }

    // Get all completed wash events for this partner in the period that are not yet invoiced
    const washEvents = await this.prisma.washEvent.findMany({
      where: {
        locationId,
        locationPartnerId,
        status: 'COMPLETED',
        completedAt: {
          gte: periodStart,
          lte: periodEnd,
        },
        locationInvoiceId: null,
      },
      include: {
        services: { include: { servicePackage: true } },
      },
    });

    if (washEvents.length === 0) {
      throw new BadRequestException('No uninvoiced wash events found in the specified period');
    }

    // Calculate totals
    let subtotal = 0;
    const items: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      vatRate: number;
      washEventId: string;
      vehicleType: VehicleType | null;
    }> = [];

    for (const event of washEvents) {
      for (const service of event.services) {
        const price = Number(service.totalPrice);
        subtotal += price;
        items.push({
          description: `${service.servicePackage.name} - ${service.vehicleRole || ''} (${service.plateNumber || ''})`,
          quantity: service.quantity,
          unitPrice: Number(service.unitPrice),
          totalPrice: price,
          vatRate: 27,
          washEventId: event.id,
          vehicleType: service.vehicleType,
        });
      }

      // Fallback to legacy pricing
      if (event.services.length === 0 && event.finalPrice) {
        subtotal += Number(event.finalPrice);
        items.push({
          description: 'Járműmosás',
          quantity: 1,
          unitPrice: Number(event.finalPrice),
          totalPrice: Number(event.finalPrice),
          vatRate: 27,
          washEventId: event.id,
          vehicleType: null,
        });
      }
    }

    // Calculate discount based on wash count
    const discountPercent = this.calculateLocationPartnerDiscount(partner, washEvents.length);
    const discountAmount = subtotal * (discountPercent / 100);
    const subtotalAfterDiscount = subtotal - discountAmount;
    const vatAmount = subtotalAfterDiscount * 0.27;
    const total = subtotalAfterDiscount + vatAmount;

    const periodLabel = this.formatPeriodLabel(periodStart, periodEnd);

    // Create invoice
    const invoice = await this.prisma.locationInvoice.create({
      data: {
        locationId,
        locationPartnerId,
        invoiceType: LocationInvoiceType.PARTNER,
        periodStart,
        periodEnd,
        periodLabel: `${periodLabel} járműmosás gyűjtőszámla`,
        subtotal: new Decimal(subtotalAfterDiscount),
        vatRate: 27,
        vatAmount: new Decimal(vatAmount),
        total: new Decimal(total),
        currency: 'HUF',
        discountPercent: discountPercent || null,
        discountAmount: discountAmount > 0 ? new Decimal(discountAmount) : null,
        status: LocationInvoiceStatus.DRAFT,
        // Buyer data
        buyerName: partner.billingName || partner.name,
        buyerAddress: partner.billingAddress || '',
        buyerCity: partner.billingCity || '',
        buyerZipCode: partner.billingZipCode || '',
        buyerCountry: partner.billingCountry || 'HU',
        buyerTaxNumber: partner.taxNumber,
        buyerEuVatNumber: partner.euVatNumber,
        // Seller data
        sellerName: location.billingSettings?.sellerName || location.subcontractorCompanyName || '',
        sellerAddress: location.billingSettings?.sellerAddress || location.subcontractorAddress || '',
        sellerCity: location.billingSettings?.sellerCity || location.subcontractorCity || '',
        sellerZipCode: location.billingSettings?.sellerZipCode || location.subcontractorZipCode || '',
        sellerCountry: location.billingSettings?.sellerCountry || 'HU',
        sellerTaxNumber: location.billingSettings?.sellerTaxNumber || location.subcontractorTaxNumber,
        sellerBankAccount: location.billingSettings?.sellerBankAccount || location.subcontractorBankAccount,
        sellerBankName: location.billingSettings?.sellerBankName,
        items: {
          create: items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: new Decimal(item.unitPrice),
            totalPrice: new Decimal(item.totalPrice),
            vatRate: item.vatRate,
            washEventId: item.washEventId,
            vehicleType: item.vehicleType,
          })),
        },
      },
      include: { items: true, locationPartner: true },
    });

    // Link wash events to invoice
    await this.prisma.washEvent.updateMany({
      where: { id: { in: washEvents.map((e) => e.id) } },
      data: { locationInvoiceId: invoice.id },
    });

    return invoice;
  }

  private calculateLocationPartnerDiscount(partner: any, washCount: number): number {
    if (partner.discountThreshold5 && washCount >= partner.discountThreshold5) {
      return partner.discountPercent5 || 0;
    }
    if (partner.discountThreshold4 && washCount >= partner.discountThreshold4) {
      return partner.discountPercent4 || 0;
    }
    if (partner.discountThreshold3 && washCount >= partner.discountThreshold3) {
      return partner.discountPercent3 || 0;
    }
    if (partner.discountThreshold2 && washCount >= partner.discountThreshold2) {
      return partner.discountPercent2 || 0;
    }
    if (partner.discountThreshold1 && washCount >= partner.discountThreshold1) {
      return partner.discountPercent1 || 0;
    }
    return 0;
  }

  // =============================================================================
  // LOCATION STATEMENT (Network felé kimutatás)
  // =============================================================================

  /**
   * Generate monthly statement for a subcontractor location
   * This is called by cron job on the 1st of each month
   */
  async generateStatement(locationId: string, periodStart: Date, periodEnd: Date) {
    const location = await this.prisma.location.findUnique({
      where: { id: locationId },
      include: { network: true },
    });

    if (!location) {
      throw new NotFoundException('Location not found');
    }

    if (location.operationType !== 'SUBCONTRACTOR') {
      throw new BadRequestException('Statements are only generated for SUBCONTRACTOR locations');
    }

    // Check if statement already exists for this period
    const existingStatement = await this.prisma.locationStatement.findFirst({
      where: {
        locationId,
        periodStart,
        periodEnd,
      },
    });

    if (existingStatement) {
      return existingStatement;
    }

    // Get all completed wash events in the period
    const washEvents = await this.prisma.washEvent.findMany({
      where: {
        locationId,
        status: 'COMPLETED',
        completedAt: {
          gte: periodStart,
          lte: periodEnd,
        },
      },
      include: {
        services: true,
        partnerCompany: true,
      },
    });

    // Calculate total amount
    let totalAmount = 0;
    for (const event of washEvents) {
      if (event.services.length > 0) {
        for (const service of event.services) {
          totalAmount += Number(service.totalPrice);
        }
      } else if (event.finalPrice) {
        totalAmount += Number(event.finalPrice);
      }
    }

    const periodLabel = this.formatPeriodLabel(periodStart, periodEnd);

    // Create statement
    const statement = await this.prisma.locationStatement.create({
      data: {
        locationId,
        periodStart,
        periodEnd,
        periodLabel,
        washCount: washEvents.length,
        totalAmount: new Decimal(totalAmount),
        currency: 'HUF',
        status: LocationStatementStatus.GENERATED,
      },
    });

    return statement;
  }

  /**
   * Get statements for a location
   */
  async getStatements(locationId: string) {
    return this.prisma.locationStatement.findMany({
      where: { locationId },
      orderBy: { periodStart: 'desc' },
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            total: true,
          },
        },
      },
    });
  }

  /**
   * Get statement details with wash events
   */
  async getStatementDetails(statementId: string) {
    const statement = await this.prisma.locationStatement.findUnique({
      where: { id: statementId },
      include: {
        location: true,
        invoice: true,
      },
    });

    if (!statement) {
      throw new NotFoundException('Statement not found');
    }

    // Get wash events for this period
    const washEvents = await this.prisma.washEvent.findMany({
      where: {
        locationId: statement.locationId,
        status: 'COMPLETED',
        completedAt: {
          gte: statement.periodStart,
          lte: statement.periodEnd,
        },
      },
      include: {
        services: { include: { servicePackage: true } },
        partnerCompany: { select: { id: true, name: true, code: true } },
        driver: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { completedAt: 'asc' },
    });

    return {
      ...statement,
      washEvents,
    };
  }

  // =============================================================================
  // NETWORK INVOICE (Alvállalkozó számla a Network felé)
  // =============================================================================

  /**
   * Create invoice to Network based on statement
   */
  async createNetworkInvoice(statementId: string) {
    const statement = await this.prisma.locationStatement.findUnique({
      where: { id: statementId },
      include: {
        location: {
          include: {
            billingSettings: true,
            network: { include: { settings: true } },
          },
        },
      },
    });

    if (!statement) {
      throw new NotFoundException('Statement not found');
    }

    if (statement.invoiceId) {
      throw new BadRequestException('Statement already has an invoice');
    }

    const location = statement.location;
    const network = location.network;
    const networkSettings = network.settings;

    if (!location.billingSettings) {
      throw new BadRequestException('Location billing settings not configured');
    }

    const vatAmount = Number(statement.totalAmount) * 0.27;
    const total = Number(statement.totalAmount) + vatAmount;

    // Create invoice to Network
    const invoice = await this.prisma.locationInvoice.create({
      data: {
        locationId: location.id,
        invoiceType: LocationInvoiceType.NETWORK,
        periodStart: statement.periodStart,
        periodEnd: statement.periodEnd,
        periodLabel: `${statement.periodLabel} járműmosás gyűjtőszámla`,
        subtotal: statement.totalAmount,
        vatRate: 27,
        vatAmount: new Decimal(vatAmount),
        total: new Decimal(total),
        currency: statement.currency,
        status: LocationInvoiceStatus.DRAFT,
        // Buyer = Network
        buyerName: networkSettings?.companyName || network.name,
        buyerAddress: networkSettings?.companyAddress || network.billingAddress || '',
        buyerCity: networkSettings?.companyCity || network.billingCity || '',
        buyerZipCode: networkSettings?.companyZipCode || network.billingZipCode || '',
        buyerCountry: networkSettings?.companyCountry || network.billingCountry || 'HU',
        buyerTaxNumber: networkSettings?.taxNumber || network.billingTaxNumber,
        buyerEuVatNumber: networkSettings?.euVatNumber || network.billingEuVatNumber,
        // Seller = Subcontractor
        sellerName: location.billingSettings.sellerName || location.subcontractorCompanyName || '',
        sellerAddress: location.billingSettings.sellerAddress || location.subcontractorAddress || '',
        sellerCity: location.billingSettings.sellerCity || location.subcontractorCity || '',
        sellerZipCode: location.billingSettings.sellerZipCode || location.subcontractorZipCode || '',
        sellerCountry: location.billingSettings.sellerCountry || 'HU',
        sellerTaxNumber: location.billingSettings.sellerTaxNumber || location.subcontractorTaxNumber,
        sellerBankAccount: location.billingSettings.sellerBankAccount || location.subcontractorBankAccount,
        sellerBankName: location.billingSettings.sellerBankName,
        items: {
          create: [
            {
              description: `${statement.periodLabel} járműmosás gyűjtőszámla`,
              quantity: statement.washCount,
              unitPrice: new Decimal(Number(statement.totalAmount) / statement.washCount),
              totalPrice: statement.totalAmount,
              vatRate: 27,
            },
          ],
        },
      },
      include: { items: true },
    });

    // Link statement to invoice
    await this.prisma.locationStatement.update({
      where: { id: statementId },
      data: {
        invoiceId: invoice.id,
        status: LocationStatementStatus.INVOICE_PENDING,
      },
    });

    return invoice;
  }

  // =============================================================================
  // ISSUE LOCATION INVOICE
  // =============================================================================

  /**
   * Issue a location invoice through the configured provider
   */
  async issueLocationInvoice(invoiceId: string) {
    const invoice = await this.prisma.locationInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        items: true,
        location: { include: { billingSettings: true } },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status !== LocationInvoiceStatus.DRAFT) {
      throw new BadRequestException('Invoice is not in DRAFT status');
    }

    const { provider, providerName } = await this.getProviderForLocation(invoice.locationId);

    if (!provider) {
      throw new BadRequestException('No invoice provider configured for this location');
    }

    // VIES validation for EU cross-border
    if (invoice.buyerCountry !== invoice.sellerCountry && invoice.buyerEuVatNumber) {
      const viesResult = await this.viesService.validateVatNumber(invoice.buyerEuVatNumber);
      if (!viesResult.valid) {
        throw new BadRequestException(
          `EU adószám VIES ellenőrzése sikertelen: ${viesResult.error || 'Érvénytelen adószám'}`,
        );
      }
    }

    // Prepare line items
    const lineItems: InvoiceLineItem[] = invoice.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      vatRate: item.vatRate,
      unit: 'db',
    }));

    // Map payment method
    const paymentMethodMap: Record<string, 'cash' | 'transfer' | 'card' | 'other'> = {
      CASH: 'cash',
      CARD: 'card',
      DKV: 'other',
      UTA: 'other',
      MOL: 'other',
      SHELL: 'other',
      TRAVIS: 'other',
      OTHER: 'other',
    };

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
      paymentMethod: invoice.paymentMethod
        ? paymentMethodMap[invoice.paymentMethod] || 'transfer'
        : 'transfer',
      paymentDueDays: 8, // Default for location invoices
      items: lineItems,
    };

    const result = await provider.createInvoice(createRequest);

    if (result.success) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 8);

      await this.prisma.locationInvoice.update({
        where: { id: invoiceId },
        data: {
          status: LocationInvoiceStatus.ISSUED,
          invoiceNumber: result.invoiceNumber,
          externalId: result.externalId,
          issueDate: new Date(),
          dueDate,
          providerName,
          providerPdfUrl: result.pdfUrl,
          providerResponse: result.rawResponse,
        },
      });

      // Update statement status if this is a Network invoice
      if (invoice.invoiceType === LocationInvoiceType.NETWORK) {
        await this.prisma.locationStatement.updateMany({
          where: { invoiceId },
          data: { status: LocationStatementStatus.INVOICED },
        });
      }

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

  // =============================================================================
  // QUERY METHODS
  // =============================================================================

  async getLocationInvoices(
    locationId: string,
    filters?: {
      invoiceType?: LocationInvoiceType;
      status?: LocationInvoiceStatus;
      locationPartnerId?: string;
      issueDateFrom?: Date;
      issueDateTo?: Date;
    },
  ) {
    return this.prisma.locationInvoice.findMany({
      where: {
        locationId,
        ...(filters?.invoiceType && { invoiceType: filters.invoiceType }),
        ...(filters?.status && { status: filters.status }),
        ...(filters?.locationPartnerId && { locationPartnerId: filters.locationPartnerId }),
        ...(filters?.issueDateFrom && { issueDate: { gte: filters.issueDateFrom } }),
        ...(filters?.issueDateTo && { issueDate: { lte: filters.issueDateTo } }),
      },
      include: {
        locationPartner: { select: { id: true, name: true, code: true } },
        _count: { select: { items: true, washEvents: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getLocationInvoice(invoiceId: string) {
    return this.prisma.locationInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        items: true,
        locationPartner: true,
        washEvents: {
          include: {
            services: { include: { servicePackage: true } },
            driver: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        location: true,
      },
    });
  }

  async markLocationInvoicePaid(invoiceId: string, paidDate?: Date) {
    const invoice = await this.prisma.locationInvoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status === LocationInvoiceStatus.PAID) {
      throw new BadRequestException('Invoice is already paid');
    }

    if (invoice.status === LocationInvoiceStatus.CANCELLED) {
      throw new BadRequestException('Cannot mark cancelled invoice as paid');
    }

    const updatedInvoice = await this.prisma.locationInvoice.update({
      where: { id: invoiceId },
      data: {
        status: LocationInvoiceStatus.PAID,
        paidDate: paidDate || new Date(),
      },
    });

    // Update statement status if this is a Network invoice
    if (invoice.invoiceType === LocationInvoiceType.NETWORK) {
      await this.prisma.locationStatement.updateMany({
        where: { invoiceId },
        data: { status: LocationStatementStatus.PAID },
      });
    }

    return updatedInvoice;
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  private formatPeriodLabel(periodStart: Date, periodEnd: Date): string {
    const months = [
      'január', 'február', 'március', 'április', 'május', 'június',
      'július', 'augusztus', 'szeptember', 'október', 'november', 'december',
    ];
    const year = periodStart.getFullYear();
    const month = months[periodStart.getMonth()];
    return `${year}. ${month}`;
  }
}
