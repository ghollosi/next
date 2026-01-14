import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { InvoiceProvider, CreateInvoiceRequest, InvoiceLineItem } from './invoice-provider.interface';
import { SzamlazzProvider } from './szamlazz.provider';
import { BillingoProvider } from './billingo.provider';
import { ViesService } from './vies.service';
import { Decimal } from '@prisma/client/runtime/library';
import { VehicleType, InvoiceProvider as InvoiceProviderEnum } from '@prisma/client';
import * as ExcelJS from 'exceljs';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private providers: Map<string, InvoiceProvider> = new Map();

  constructor(
    private prisma: PrismaService,
    private szamlazzProvider: SzamlazzProvider,
    private billingoProvider: BillingoProvider,
    private viesService: ViesService,
  ) {
    // Register available providers
    this.providers.set('szamlazz', this.szamlazzProvider);
    this.providers.set('billingo', this.billingoProvider);
  }

  /**
   * Get the configured invoice provider for a network
   */
  async getProviderForNetwork(networkId: string): Promise<{ provider: InvoiceProvider | null; providerName: string }> {
    const settings = await this.prisma.networkSettings.findUnique({
      where: { networkId },
    });

    if (!settings || settings.invoiceProvider === InvoiceProviderEnum.NONE || settings.invoiceProvider === InvoiceProviderEnum.MANUAL) {
      return { provider: null, providerName: 'none' };
    }

    if (settings.invoiceProvider === InvoiceProviderEnum.SZAMLAZZ) {
      // Configure the provider with network-specific settings
      // Note: SzamlazzProvider uses environment variables, but we could extend it
      return { provider: this.szamlazzProvider, providerName: 'szamlazz' };
    }

    if (settings.invoiceProvider === InvoiceProviderEnum.BILLINGO) {
      // Configure Billingo with network-specific settings
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
   * Get provider by name (for explicit provider selection)
   */
  getProvider(providerName: string): InvoiceProvider | undefined {
    return this.providers.get(providerName);
  }

  /**
   * Get price for a specific service + vehicle type combination
   * First checks partner custom prices, then falls back to default prices
   */
  async getPrice(
    networkId: string,
    servicePackageId: string,
    vehicleType: VehicleType,
    partnerCompanyId?: string,
  ): Promise<{ price: number; currency: string; isCustomPrice: boolean } | null> {
    // Check for custom partner price first
    if (partnerCompanyId) {
      const customPrice = await this.prisma.partnerCustomPrice.findUnique({
        where: {
          partnerCompanyId_servicePackageId_vehicleType: {
            partnerCompanyId,
            servicePackageId,
            vehicleType,
          },
        },
      });

      if (customPrice && customPrice.isActive) {
        return {
          price: Number(customPrice.price),
          currency: customPrice.currency,
          isCustomPrice: true,
        };
      }
    }

    // Fall back to default price
    const defaultPrice = await this.prisma.servicePrice.findUnique({
      where: {
        networkId_servicePackageId_vehicleType: {
          networkId,
          servicePackageId,
          vehicleType,
        },
      },
    });

    if (defaultPrice && defaultPrice.isActive) {
      return {
        price: Number(defaultPrice.price),
        currency: defaultPrice.currency,
        isCustomPrice: false,
      };
    }

    return null;
  }

  /**
   * Calculate discount for a partner based on their wash count and discount tiers
   * Supports separate discount structures for OWN and SUBCONTRACTOR locations
   */
  async calculateDiscount(
    partnerCompanyId: string,
    periodStart: Date,
    periodEnd: Date,
    operationType?: 'OWN' | 'SUBCONTRACTOR',
  ): Promise<{ washCount: number; discountPercent: number }> {
    const partner = await this.prisma.partnerCompany.findUnique({
      where: { id: partnerCompanyId },
    });

    if (!partner) {
      throw new NotFoundException('Partner company not found');
    }

    // Count completed washes in the period, optionally filtered by operation type
    const washCount = await this.prisma.washEvent.count({
      where: {
        partnerCompanyId,
        status: 'COMPLETED',
        completedAt: {
          gte: periodStart,
          lte: periodEnd,
        },
        ...(operationType && {
          location: {
            operationType,
          },
        }),
      },
    });

    // Determine discount tier based on operation type
    let discountPercent = 0;

    if (operationType === 'SUBCONTRACTOR') {
      // Use SUBCONTRACTOR discount tiers
      if (partner.subDiscountThreshold5 && washCount >= partner.subDiscountThreshold5) {
        discountPercent = partner.subDiscountPercent5 || 0;
      } else if (partner.subDiscountThreshold4 && washCount >= partner.subDiscountThreshold4) {
        discountPercent = partner.subDiscountPercent4 || 0;
      } else if (partner.subDiscountThreshold3 && washCount >= partner.subDiscountThreshold3) {
        discountPercent = partner.subDiscountPercent3 || 0;
      } else if (partner.subDiscountThreshold2 && washCount >= partner.subDiscountThreshold2) {
        discountPercent = partner.subDiscountPercent2 || 0;
      } else if (partner.subDiscountThreshold1 && washCount >= partner.subDiscountThreshold1) {
        discountPercent = partner.subDiscountPercent1 || 0;
      }
    } else {
      // Use OWN discount tiers (default)
      if (partner.ownDiscountThreshold5 && washCount >= partner.ownDiscountThreshold5) {
        discountPercent = partner.ownDiscountPercent5 || 0;
      } else if (partner.ownDiscountThreshold4 && washCount >= partner.ownDiscountThreshold4) {
        discountPercent = partner.ownDiscountPercent4 || 0;
      } else if (partner.ownDiscountThreshold3 && washCount >= partner.ownDiscountThreshold3) {
        discountPercent = partner.ownDiscountPercent3 || 0;
      } else if (partner.ownDiscountThreshold2 && washCount >= partner.ownDiscountThreshold2) {
        discountPercent = partner.ownDiscountPercent2 || 0;
      } else if (partner.ownDiscountThreshold1 && washCount >= partner.ownDiscountThreshold1) {
        discountPercent = partner.ownDiscountPercent1 || 0;
      }
    }

    return { washCount, discountPercent };
  }

  /**
   * Prepare invoice for a billing period (creates DRAFT invoice)
   */
  async prepareInvoice(
    networkId: string,
    partnerCompanyId: string,
    periodStart: Date,
    periodEnd: Date,
  ) {
    const partner = await this.prisma.partnerCompany.findUnique({
      where: { id: partnerCompanyId },
    });

    if (!partner) {
      throw new NotFoundException('Partner company not found');
    }

    // Get all completed wash events in the period that are not yet invoiced
    const washEvents = await this.prisma.washEvent.findMany({
      where: {
        networkId,
        partnerCompanyId,
        status: 'COMPLETED',
        completedAt: {
          gte: periodStart,
          lte: periodEnd,
        },
        invoiceId: null,
      },
      include: {
        servicePackage: true,
        tractorVehicle: true,
        trailerVehicle: true,
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
      servicePackageId: string;
      vehicleType: VehicleType | null;
    }> = [];

    for (const event of washEvents) {
      // Skip if no servicePackageId
      if (!event.servicePackageId) continue;

      // Add tractor wash
      if (event.tractorPrice) {
        const price = Number(event.tractorPrice);
        subtotal += price;
        items.push({
          description: `${event.servicePackage?.name || 'Szolgáltatás'} - Vontató (${event.tractorVehicle?.plateNumber || event.tractorPlateManual})`,
          quantity: 1,
          unitPrice: price,
          totalPrice: price,
          vatRate: 27,
          washEventId: event.id,
          servicePackageId: event.servicePackageId,
          vehicleType: null, // Vehicle type now stored in WashEventService, not Vehicle
        });
      }

      // Add trailer wash if applicable
      if (event.trailerPrice && (event.trailerVehicleId || event.trailerPlateManual)) {
        const price = Number(event.trailerPrice);
        subtotal += price;
        items.push({
          description: `${event.servicePackage?.name || 'Szolgáltatás'} - Pótkocsi (${event.trailerVehicle?.plateNumber || event.trailerPlateManual})`,
          quantity: 1,
          unitPrice: price,
          totalPrice: price,
          vatRate: 27,
          washEventId: event.id,
          servicePackageId: event.servicePackageId,
          vehicleType: null, // Vehicle type now stored in WashEventService, not Vehicle
        });
      }
    }

    // Calculate discount
    const { discountPercent } = await this.calculateDiscount(partnerCompanyId, periodStart, periodEnd);
    const discountAmount = subtotal * (discountPercent / 100);
    const subtotalAfterDiscount = subtotal - discountAmount;
    const vatAmount = subtotalAfterDiscount * 0.27;
    const total = subtotalAfterDiscount + vatAmount;

    // Create invoice
    const invoice = await this.prisma.invoice.create({
      data: {
        networkId,
        partnerCompanyId,
        periodStart,
        periodEnd,
        subtotal: new Decimal(subtotalAfterDiscount),
        vatRate: 27,
        vatAmount: new Decimal(vatAmount),
        total: new Decimal(total),
        currency: 'HUF',
        discountPercent: discountPercent || null,
        discountAmount: discountAmount > 0 ? new Decimal(discountAmount) : null,
        status: 'DRAFT',
        billingName: partner.billingName || partner.name,
        billingAddress: partner.billingAddress || '',
        billingCity: partner.billingCity || '',
        billingZipCode: partner.billingZipCode || '',
        billingCountry: partner.billingCountry || 'HU',
        taxNumber: partner.taxNumber,
        euVatNumber: partner.euVatNumber,
        items: {
          create: items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: new Decimal(item.unitPrice),
            totalPrice: new Decimal(item.totalPrice),
            vatRate: item.vatRate,
            washEventId: item.washEventId,
            servicePackageId: item.servicePackageId,
            vehicleType: item.vehicleType,
          })),
        },
      },
      include: {
        items: true,
        partnerCompany: true,
      },
    });

    // Link wash events to invoice
    await this.prisma.washEvent.updateMany({
      where: {
        id: { in: washEvents.map((e) => e.id) },
      },
      data: {
        invoiceId: invoice.id,
      },
    });

    return invoice;
  }

  /**
   * Issue invoice through external provider (e.g., szamlazz.hu)
   */
  async issueInvoice(invoiceId: string, providerName: string = 'szamlazz') {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        items: true,
        partnerCompany: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status !== 'DRAFT') {
      throw new BadRequestException('Invoice is not in DRAFT status');
    }

    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new BadRequestException(`Invoice provider "${providerName}" not found`);
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
        name: invoice.billingName,
        address: invoice.billingAddress,
        city: invoice.billingCity,
        zipCode: invoice.billingZipCode,
        country: invoice.billingCountry,
        taxNumber: invoice.taxNumber || undefined,
        euVatNumber: invoice.euVatNumber || undefined,
      },
      currency: invoice.currency,
      language: 'hu',
      paymentMethod: invoice.paymentMethod
        ? paymentMethodMap[invoice.paymentMethod] || 'transfer'
        : 'transfer',
      paymentDueDays: invoice.partnerCompany.paymentDueDays,
      items: lineItems,
    };

    const result = await provider.createInvoice(createRequest);

    if (result.success) {
      // Update invoice with provider response
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + invoice.partnerCompany.paymentDueDays);

      await this.prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          status: 'ISSUED',
          invoiceNumber: result.invoiceNumber,
          externalId: result.externalId,
          issueDate: new Date(),
          dueDate,
          szamlazzPdfUrl: result.pdfUrl,
          szamlazzResponse: result.rawResponse,
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
   * Create and immediately issue invoice for cash payment
   */
  async createCashInvoice(
    networkId: string,
    washEventId: string,
    paymentMethod: string,
  ) {
    const washEvent = await this.prisma.washEvent.findUnique({
      where: { id: washEventId },
      include: {
        partnerCompany: true,
        servicePackage: true,
        tractorVehicle: true,
        trailerVehicle: true,
      },
    });

    if (!washEvent) {
      throw new NotFoundException('Wash event not found');
    }

    if (washEvent.invoiceId) {
      throw new BadRequestException('Wash event already has an invoice');
    }

    const partner = washEvent.partnerCompany;

    // Calculate totals
    let subtotal = 0;
    const items: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      vatRate: number;
      servicePackageId: string;
      vehicleType: VehicleType | null;
    }> = [];

    if (washEvent.tractorPrice && washEvent.servicePackageId) {
      const price = Number(washEvent.tractorPrice);
      subtotal += price;
      items.push({
        description: `${washEvent.servicePackage?.name || 'Szolgáltatás'} - Vontató`,
        quantity: 1,
        unitPrice: price,
        totalPrice: price,
        vatRate: 27,
        servicePackageId: washEvent.servicePackageId,
        vehicleType: null, // Vehicle type now stored in WashEventService, not Vehicle
      });
    }

    if (washEvent.trailerPrice && washEvent.servicePackageId) {
      const price = Number(washEvent.trailerPrice);
      subtotal += price;
      items.push({
        description: `${washEvent.servicePackage?.name || 'Szolgáltatás'} - Pótkocsi`,
        quantity: 1,
        unitPrice: price,
        totalPrice: price,
        vatRate: 27,
        servicePackageId: washEvent.servicePackageId,
        vehicleType: null, // Vehicle type now stored in WashEventService, not Vehicle
      });
    }

    const vatAmount = subtotal * 0.27;
    const total = subtotal + vatAmount;

    // Create invoice in ISSUED status (cash invoices are issued immediately)
    const invoice = await this.prisma.invoice.create({
      data: {
        networkId,
        partnerCompanyId: partner.id,
        subtotal: new Decimal(subtotal),
        vatRate: 27,
        vatAmount: new Decimal(vatAmount),
        total: new Decimal(total),
        currency: 'HUF',
        status: 'DRAFT', // Will be updated after issuing
        paymentMethod: paymentMethod as any,
        issueDate: new Date(),
        dueDate: new Date(), // Immediate payment
        billingName: partner.billingName || partner.name,
        billingAddress: partner.billingAddress || '',
        billingCity: partner.billingCity || '',
        billingZipCode: partner.billingZipCode || '',
        billingCountry: partner.billingCountry || 'HU',
        taxNumber: partner.taxNumber,
        euVatNumber: partner.euVatNumber,
        items: {
          create: items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: new Decimal(item.unitPrice),
            totalPrice: new Decimal(item.totalPrice),
            vatRate: item.vatRate,
            washEventId,
            servicePackageId: item.servicePackageId,
            vehicleType: item.vehicleType,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    // Link wash event to invoice
    await this.prisma.washEvent.update({
      where: { id: washEventId },
      data: {
        invoiceId: invoice.id,
        paymentMethod: paymentMethod as any,
        paidAt: new Date(),
      },
    });

    return invoice;
  }

  /**
   * Mark invoice as paid
   */
  async markPaid(invoiceId: string, paymentMethod: string, paidDate?: Date) {
    const invoice = await this.prisma.invoice.findUnique({
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

    return this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'PAID',
        paymentMethod: paymentMethod as any,
        paidDate: paidDate || new Date(),
      },
    });
  }

  /**
   * Cancel (storno) an invoice
   */
  async cancelInvoice(invoiceId: string, providerName: string = 'szamlazz') {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status === 'CANCELLED') {
      throw new BadRequestException('Invoice is already cancelled');
    }

    // If invoice was issued externally, cancel it there too
    if (invoice.invoiceNumber && invoice.status === 'ISSUED') {
      const provider = this.providers.get(providerName);
      if (provider) {
        const result = await provider.cancelInvoice({
          invoiceNumber: invoice.invoiceNumber,
        });

        if (!result.success) {
          throw new BadRequestException(`Failed to cancel invoice in ${providerName}: ${result.error}`);
        }
      }
    }

    // Unlink wash events
    await this.prisma.washEvent.updateMany({
      where: { invoiceId },
      data: { invoiceId: null },
    });

    return this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });
  }

  /**
   * Validate EU VAT number
   */
  async validateVatNumber(vatNumber: string) {
    return this.viesService.validateVatNumber(vatNumber);
  }

  /**
   * Get invoice with full details
   */
  async getInvoice(invoiceId: string) {
    return this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        items: {
          include: {
            servicePackage: true,
          },
        },
        partnerCompany: true,
        washEvents: {
          include: {
            servicePackage: true,
            location: true,
          },
        },
      },
    });
  }

  /**
   * Query invoices with filters
   */
  async queryInvoices(
    networkId: string,
    filters: {
      partnerCompanyId?: string;
      status?: string;
      issueDateFrom?: Date;
      issueDateTo?: Date;
      dueDateFrom?: Date;
      dueDateTo?: Date;
    },
  ) {
    return this.prisma.invoice.findMany({
      where: {
        networkId,
        ...(filters.partnerCompanyId && { partnerCompanyId: filters.partnerCompanyId }),
        ...(filters.status && { status: filters.status as any }),
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
        partnerCompany: {
          select: {
            id: true,
            code: true,
            name: true,
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
   * Get overdue invoices and update their status
   */
  async processOverdueInvoices(networkId: string) {
    const now = new Date();

    const overdueInvoices = await this.prisma.invoice.updateMany({
      where: {
        networkId,
        status: 'ISSUED',
        dueDate: {
          lt: now,
        },
      },
      data: {
        status: 'OVERDUE',
      },
    });

    return overdueInvoices.count;
  }

  // ==================== Excel Export/Import ====================

  // Vehicle type labels in Hungarian
  private readonly vehicleTypeLabels: Record<string, string> = {
    // Nyerges szerelvények
    SEMI_TRUCK: 'Nyerges szerelvény',

    // Gabonaszállító
    GRAIN_CARRIER: 'Gabonaszállító',

    // Pótkocsik
    TRAILER_ONLY: 'Csak pótkocsi',

    // Konténerszállító
    CONTAINER_CARRIER: 'Konténer szállító',

    // Traktor
    TRACTOR: 'Traktor',

    // Tehergépjárművek súly szerint
    TRUCK_1_5T: 'Tehergépjármű 1,5 t-ig',
    TRUCK_3_5T: 'Tehergépjármű 3,5t-ig',
    TRUCK_7_5T: 'Tehergépjármű 7,5t-ig',
    TRUCK_12T: 'Tehergépjármű 12t-ig',
    TRUCK_12T_PLUS: 'Tehergépjármű 12t felett',

    // Tartályautók
    TANK_SOLO: 'Tartályautó (szóló)',
    TANK_12T: 'Tartályautó 12t-ig',
    TANK_TRUCK: 'Tartályautó',
    TANK_SEMI_TRAILER: 'Tartályfélpótkocsi',

    // Tandem
    TANDEM_7_5T: 'Tandem 7,5t-ig',
    TANDEM_7_5T_PLUS: 'Tandem 7,5t felett',

    // Siló
    SILO: 'Siló',
    SILO_TANDEM: 'Siló (tandem)',

    // Speciális
    TIPPER_MIXER: 'Billencs, Mixer',
    CAR_CARRIER: 'Autószállító',

    // Buszok
    MINIBUS: 'Kisbusz (8-9 személyes)',
    MIDIBUS: 'Nagybusz (14-15 személyes)',
    BUS: 'Autóbusz',

    // Személygépkocsik
    CAR: 'Személygépkocsi',
    SUV_MPV: 'Egyterű, terepjáró',

    // Munkagépek
    MACHINERY: 'Munkagép',
    FORKLIFT: 'Targonca',

    // Egyéb
    MOTORCYCLE: 'Motorkerékpár',

    // Speciális mosások
    BUILDING_PARTS: 'Épület / Alkatrész mosás',
    CHILD_SEAT: 'Gyerekülés',
  };

  // Ordered vehicle types for Excel rows
  private readonly vehicleTypeOrder = [
    'SEMI_TRUCK',
    'GRAIN_CARRIER',
    'TRAILER_ONLY',
    'CONTAINER_CARRIER',
    'TRACTOR',
    'TRUCK_1_5T',
    'TRUCK_3_5T',
    'TRUCK_7_5T',
    'TRUCK_12T',
    'TRUCK_12T_PLUS',
    'TANK_SOLO',
    'TANK_12T',
    'TANK_TRUCK',
    'TANK_SEMI_TRAILER',
    'TANDEM_7_5T',
    'TANDEM_7_5T_PLUS',
    'SILO',
    'SILO_TANDEM',
    'TIPPER_MIXER',
    'CAR_CARRIER',
    'MINIBUS',
    'MIDIBUS',
    'BUS',
    'CAR',
    'SUV_MPV',
    'MACHINERY',
    'FORKLIFT',
    'MOTORCYCLE',
    'BUILDING_PARTS',
    'CHILD_SEAT',
  ];

  /**
   * Export all service prices to Excel
   */
  async exportPricesToExcel(networkId: string): Promise<Buffer> {
    // Get all service packages
    const servicePackages = await this.prisma.servicePackage.findMany({
      where: { networkId, isActive: true },
      orderBy: { code: 'asc' },
    });

    // Get all prices
    const prices = await this.prisma.servicePrice.findMany({
      where: { networkId, isActive: true },
    });

    // Create price lookup map
    const priceMap = new Map<string, number>();
    for (const price of prices) {
      const key = `${price.servicePackageId}_${price.vehicleType}`;
      priceMap.set(key, Number(price.price));
    }

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'vSys';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Árlista');

    // Header row: Járműtípus | Service1 | Service2 | ...
    const headerRow = ['Járműtípus', 'Kód'];
    for (const sp of servicePackages) {
      headerRow.push(sp.name);
    }
    worksheet.addRow(headerRow);

    // Style header row
    const header = worksheet.getRow(1);
    header.font = { bold: true };
    header.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' },
    };

    // Add service codes as second row (hidden reference)
    const codeRow = ['', ''];
    for (const sp of servicePackages) {
      codeRow.push(sp.code);
    }
    worksheet.addRow(codeRow);
    worksheet.getRow(2).hidden = true;

    // Data rows: one per vehicle type
    for (const vehicleType of this.vehicleTypeOrder) {
      const row = [
        this.vehicleTypeLabels[vehicleType] || vehicleType,
        vehicleType,
      ];

      for (const sp of servicePackages) {
        const key = `${sp.id}_${vehicleType}`;
        const price = priceMap.get(key);
        row.push(price !== undefined ? String(price) : '');
      }

      worksheet.addRow(row);
    }

    // Set column widths
    worksheet.getColumn(1).width = 25;
    worksheet.getColumn(2).width = 25;
    for (let i = 3; i <= servicePackages.length + 2; i++) {
      worksheet.getColumn(i).width = 15;
    }

    // Format price cells as numbers
    for (let row = 3; row <= this.vehicleTypeOrder.length + 2; row++) {
      for (let col = 3; col <= servicePackages.length + 2; col++) {
        const cell = worksheet.getCell(row, col);
        if (cell.value) {
          cell.numFmt = '#,##0';
        }
      }
    }

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Import prices from Excel file
   */
  async importPricesFromExcel(
    networkId: string,
    fileBuffer: Buffer,
  ): Promise<{ imported: number; errors: string[] }> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer as any);

    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      throw new BadRequestException('Excel fájl nem tartalmaz munkalapot');
    }

    // Get service packages for code lookup
    const servicePackages = await this.prisma.servicePackage.findMany({
      where: { networkId },
    });
    const serviceByCode = new Map(servicePackages.map((sp) => [sp.code, sp]));
    const serviceByName = new Map(servicePackages.map((sp) => [sp.name, sp]));

    // Parse header row to get service package columns
    const headerRow = worksheet.getRow(1);
    const codeRow = worksheet.getRow(2);
    const serviceColumns: { col: number; servicePackageId: string }[] = [];

    for (let col = 3; col <= headerRow.cellCount; col++) {
      const headerValue = String(headerRow.getCell(col).value || '').trim();
      const codeValue = String(codeRow.getCell(col).value || '').trim();

      // Try to find service by code first, then by name
      let service = serviceByCode.get(codeValue) || serviceByName.get(headerValue);

      if (service) {
        serviceColumns.push({ col, servicePackageId: service.id });
      }
    }

    if (serviceColumns.length === 0) {
      throw new BadRequestException('Nem található szolgáltatás oszlop az Excel fájlban');
    }

    const errors: string[] = [];
    let imported = 0;

    // Process data rows (starting from row 3)
    for (let rowNum = 3; rowNum <= worksheet.rowCount; rowNum++) {
      const row = worksheet.getRow(rowNum);
      const vehicleTypeCell = row.getCell(2).value;
      const vehicleType = String(vehicleTypeCell || '').trim();

      if (!vehicleType || !this.vehicleTypeLabels[vehicleType]) {
        // Try to find by label
        const labelCell = String(row.getCell(1).value || '').trim();
        const foundType = Object.entries(this.vehicleTypeLabels).find(
          ([, label]) => label === labelCell,
        );

        if (!foundType) {
          if (labelCell) {
            errors.push(`Sor ${rowNum}: Ismeretlen járműtípus: ${labelCell}`);
          }
          continue;
        }
      }

      const finalVehicleType = vehicleType ||
        Object.entries(this.vehicleTypeLabels).find(
          ([, label]) => label === String(row.getCell(1).value || '').trim(),
        )?.[0];

      if (!finalVehicleType) {
        continue;
      }

      for (const { col, servicePackageId } of serviceColumns) {
        const cellValue = row.getCell(col).value;

        if (cellValue === null || cellValue === undefined || cellValue === '') {
          continue;
        }

        const price = typeof cellValue === 'number'
          ? cellValue
          : parseFloat(String(cellValue).replace(/[^\d.-]/g, ''));

        if (isNaN(price) || price < 0) {
          errors.push(`Sor ${rowNum}, oszlop ${col}: Érvénytelen ár: ${cellValue}`);
          continue;
        }

        try {
          // Upsert price
          await this.prisma.servicePrice.upsert({
            where: {
              networkId_servicePackageId_vehicleType: {
                networkId,
                servicePackageId,
                vehicleType: finalVehicleType as any,
              },
            },
            update: {
              price: new Decimal(price),
              isActive: true,
              updatedAt: new Date(),
            },
            create: {
              networkId,
              servicePackageId,
              vehicleType: finalVehicleType as any,
              price: new Decimal(price),
              currency: 'HUF',
              isActive: true,
            },
          });
          imported++;
        } catch (err: any) {
          errors.push(`Sor ${rowNum}: Hiba az ár mentésekor: ${err.message}`);
        }
      }
    }

    return { imported, errors };
  }

  /**
   * Bulk update prices from JSON
   */
  async bulkUpdatePrices(
    networkId: string,
    prices: Array<{ serviceCode: string; vehicleType: string; price: number }>,
    currency: string = 'HUF',
  ): Promise<{ updated: number; created: number; errors: string[] }> {
    // Get service packages for code lookup
    const servicePackages = await this.prisma.servicePackage.findMany({
      where: { networkId },
    });
    const serviceByCode = new Map(servicePackages.map((sp) => [sp.code, sp]));

    let updated = 0;
    let created = 0;
    const errors: string[] = [];

    for (const item of prices) {
      const service = serviceByCode.get(item.serviceCode);
      if (!service) {
        errors.push(`Szolgáltatás nem található: ${item.serviceCode}`);
        continue;
      }

      if (!this.vehicleTypeLabels[item.vehicleType]) {
        errors.push(`Ismeretlen járműtípus: ${item.vehicleType}`);
        continue;
      }

      try {
        const existing = await this.prisma.servicePrice.findUnique({
          where: {
            networkId_servicePackageId_vehicleType: {
              networkId,
              servicePackageId: service.id,
              vehicleType: item.vehicleType as any,
            },
          },
        });

        if (existing) {
          await this.prisma.servicePrice.update({
            where: { id: existing.id },
            data: {
              price: new Decimal(item.price),
              currency,
              isActive: true,
            },
          });
          updated++;
        } else {
          await this.prisma.servicePrice.create({
            data: {
              networkId,
              servicePackageId: service.id,
              vehicleType: item.vehicleType as any,
              price: new Decimal(item.price),
              currency,
              isActive: true,
            },
          });
          created++;
        }
      } catch (err: any) {
        errors.push(`Hiba (${item.serviceCode}/${item.vehicleType}): ${err.message}`);
      }
    }

    return { updated, created, errors };
  }

  /**
   * Get all service packages for a network
   */
  async getServicePackages(networkId: string) {
    return this.prisma.servicePackage.findMany({
      where: { networkId, isActive: true, deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Import prices from vertical Excel format (VehicleCategory | ServiceType | Price | Duration)
   * Each row contains: A = vehicle category name, B = service/wash type name, C = price, D = duration (minutes, optional)
   *
   * This method will AUTO-CREATE missing service packages (wash types) if they don't exist.
   * The Excel becomes the "source of truth" for the price list.
   */
  async importPricesFromVerticalExcel(
    networkId: string,
    fileBuffer: Buffer,
  ): Promise<{ imported: number; skipped: number; created: number; errors: string[] }> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer as any);

    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      throw new BadRequestException('Excel fájl nem tartalmaz munkalapot');
    }

    // Create lookup maps - normalize names for matching
    const normalizeText = (text: string) =>
      text.toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[áàâä]/g, 'a')
        .replace(/[éèêë]/g, 'e')
        .replace(/[íìîï]/g, 'i')
        .replace(/[óòôö]/g, 'o')
        .replace(/[úùûü]/g, 'u')
        .replace(/[őŐ]/g, 'o')
        .replace(/[űŰ]/g, 'u')
        .trim();

    // Generate code from name (for new service packages)
    const generateCode = (name: string) => {
      return name
        .toUpperCase()
        .replace(/[áàâä]/gi, 'A')
        .replace(/[éèêë]/gi, 'E')
        .replace(/[íìîï]/gi, 'I')
        .replace(/[óòôö]/gi, 'O')
        .replace(/[úùûü]/gi, 'U')
        .replace(/[őŐ]/gi, 'O')
        .replace(/[űŰ]/gi, 'U')
        .replace(/[^A-Z0-9\s]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 30);
    };

    // Helper to parse and validate duration (must be multiple of 5 minutes)
    const parseDuration = (value: any): number | null => {
      if (value === null || value === undefined || value === '') {
        return null; // Will use default 30 minutes
      }
      const duration = typeof value === 'number' ? value : parseInt(String(value).replace(/[^\d]/g, ''), 10);
      if (isNaN(duration) || duration < 5) {
        return null;
      }
      // Round to nearest 5 minutes
      return Math.round(duration / 5) * 5;
    };

    // Get existing service packages for name lookup
    let servicePackages = await this.prisma.servicePackage.findMany({
      where: { networkId },
    });

    // Create mutable lookup maps
    const serviceByNormalizedName = new Map(
      servicePackages.map((sp) => [normalizeText(sp.name), sp])
    );
    const serviceByExactName = new Map(
      servicePackages.map((sp) => [sp.name.trim(), sp])
    );

    const errors: string[] = [];
    let imported = 0;
    let skipped = 0;
    let created = 0;

    // Detect header row - skip if first row looks like headers
    let startRow = 1;
    const firstRowA = String(worksheet.getRow(1).getCell(1).value || '').toLowerCase();
    if (firstRowA.includes('járm') || firstRowA.includes('kateg') || firstRowA.includes('vehicle') ||
        firstRowA.includes('tipus') || firstRowA.includes('típus')) {
      startRow = 2;
    }

    // Process each row
    for (let rowNum = startRow; rowNum <= worksheet.rowCount; rowNum++) {
      const row = worksheet.getRow(rowNum);

      const vehicleCategoryRaw = String(row.getCell(1).value || '').trim();
      const serviceTypeRaw = String(row.getCell(2).value || '').trim();
      const priceRaw = row.getCell(3).value;
      const durationRaw = row.getCell(4).value; // NEW: Duration column (D)

      // Skip empty rows
      if (!vehicleCategoryRaw || !serviceTypeRaw) {
        continue;
      }

      // Find vehicle type by Hungarian label
      const vehicleType = Object.entries(this.vehicleTypeLabels).find(
        ([, label]) => normalizeText(label) === normalizeText(vehicleCategoryRaw)
      )?.[0];

      if (!vehicleType) {
        errors.push(`Sor ${rowNum}: Ismeretlen járműkategória: "${vehicleCategoryRaw}" - Kérlek add hozzá a rendszerhez!`);
        skipped++;
        continue;
      }

      // Find service package by name (try exact match first, then normalized)
      let servicePackage = serviceByExactName.get(serviceTypeRaw) ||
                           serviceByNormalizedName.get(normalizeText(serviceTypeRaw));

      // AUTO-CREATE missing service package if not found
      if (!servicePackage) {
        try {
          const code = generateCode(serviceTypeRaw);
          // Check if code already exists, add suffix if needed
          let finalCode = code;
          let suffix = 1;
          while (await this.prisma.servicePackage.findFirst({
            where: { networkId, code: finalCode }
          })) {
            finalCode = `${code}_${suffix}`;
            suffix++;
          }

          servicePackage = await this.prisma.servicePackage.create({
            data: {
              networkId,
              name: serviceTypeRaw,
              code: finalCode,
              description: serviceTypeRaw,
              isActive: true,
            },
          });

          // Add to lookup maps
          serviceByExactName.set(serviceTypeRaw, servicePackage);
          serviceByNormalizedName.set(normalizeText(serviceTypeRaw), servicePackage);
          created++;
          errors.push(`Sor ${rowNum}: Új mosástípus létrehozva: "${serviceTypeRaw}" (${finalCode})`);
        } catch (err: any) {
          errors.push(`Sor ${rowNum}: Nem sikerült létrehozni mosástípust: "${serviceTypeRaw}" - ${err.message}`);
          skipped++;
          continue;
        }
      }

      // Parse price
      let price: number;
      if (typeof priceRaw === 'number') {
        price = priceRaw;
      } else {
        const priceStr = String(priceRaw || '').replace(/[^\d.,]/g, '').replace(',', '.');
        price = parseFloat(priceStr);
      }

      if (isNaN(price) || price < 0) {
        errors.push(`Sor ${rowNum}: Érvénytelen ár: "${priceRaw}"`);
        skipped++;
        continue;
      }

      // Round to 2 decimal places
      price = Math.round(price * 100) / 100;

      // Parse duration (optional, default 30 minutes)
      const durationMinutes = parseDuration(durationRaw) || 30;

      try {
        // Upsert price with duration
        await this.prisma.servicePrice.upsert({
          where: {
            networkId_servicePackageId_vehicleType: {
              networkId,
              servicePackageId: servicePackage.id,
              vehicleType: vehicleType as any,
            },
          },
          update: {
            price: new Decimal(price),
            durationMinutes,
            isActive: true,
            updatedAt: new Date(),
          },
          create: {
            networkId,
            servicePackageId: servicePackage.id,
            vehicleType: vehicleType as any,
            price: new Decimal(price),
            durationMinutes,
            currency: 'HUF',
            isActive: true,
          },
        });
        imported++;
      } catch (err: any) {
        errors.push(`Sor ${rowNum}: Hiba mentéskor: ${err.message}`);
        skipped++;
      }
    }

    return { imported, skipped, created, errors };
  }
}
