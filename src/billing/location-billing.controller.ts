import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { LocationBillingService } from './location-billing.service';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  BillingType,
  BillingCycle,
  InvoiceProvider,
  LocationInvoiceType,
  LocationInvoiceStatus,
  PaymentMethod,
} from '@prisma/client';

// =============================================================================
// DTOs
// =============================================================================

class UpdateLocationBillingSettingsDto {
  invoiceProvider?: InvoiceProvider;
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
}

class CreateLocationPartnerDto {
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
}

class UpdateLocationPartnerDto {
  name?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  billingType?: BillingType;
  billingCycle?: BillingCycle;
  billingName?: string;
  billingAddress?: string;
  billingCity?: string;
  billingZipCode?: string;
  billingCountry?: string;
  taxNumber?: string;
  euVatNumber?: string;
  paymentDueDays?: number;
  isActive?: boolean;
}

class CreateWalkInInvoiceDto {
  washEventId: string;
  paymentMethod: PaymentMethod;
  billingName: string;
  billingAddress: string;
  billingCity: string;
  billingZipCode: string;
  billingCountry?: string;
  billingTaxNumber?: string;
  billingEmail?: string;
}

class PreparePartnerInvoiceDto {
  locationPartnerId: string;
  periodStart: string; // ISO date
  periodEnd: string;   // ISO date
}

class CheckTaxNumberDto {
  taxNumber: string;
}

// =============================================================================
// CONTROLLER
// =============================================================================

@ApiTags('location-billing')
@Controller('location-billing')
export class LocationBillingController {
  constructor(
    private readonly locationBillingService: LocationBillingService,
    private readonly prisma: PrismaService,
  ) {}

  private validateLocationId(locationId: string | undefined): string {
    if (!locationId) {
      throw new BadRequestException('X-Location-ID header is required');
    }
    return locationId;
  }

  // =============================================================================
  // BILLING SETTINGS
  // =============================================================================

  @Get('settings')
  @ApiOperation({ summary: 'Get location billing settings' })
  @ApiHeader({ name: 'X-Location-ID', required: true })
  async getBillingSettings(@Headers('x-location-id') locationId: string) {
    const locId = this.validateLocationId(locationId);
    return this.locationBillingService.getBillingSettings(locId);
  }

  @Put('settings')
  @ApiOperation({ summary: 'Update location billing settings' })
  @ApiHeader({ name: 'X-Location-ID', required: true })
  async updateBillingSettings(
    @Headers('x-location-id') locationId: string,
    @Body() dto: UpdateLocationBillingSettingsDto,
  ) {
    const locId = this.validateLocationId(locationId);
    return this.locationBillingService.updateBillingSettings(locId, dto);
  }

  // =============================================================================
  // LOCATION PARTNERS
  // =============================================================================

  @Get('partners')
  @ApiOperation({ summary: 'Get all partners for this location' })
  @ApiHeader({ name: 'X-Location-ID', required: true })
  async getPartners(@Headers('x-location-id') locationId: string) {
    const locId = this.validateLocationId(locationId);
    return this.locationBillingService.getLocationPartners(locId);
  }

  @Get('partners/:id')
  @ApiOperation({ summary: 'Get a specific partner' })
  @ApiHeader({ name: 'X-Location-ID', required: true })
  @ApiParam({ name: 'id', description: 'Partner ID' })
  async getPartner(
    @Headers('x-location-id') locationId: string,
    @Param('id') id: string,
  ) {
    this.validateLocationId(locationId);
    return this.locationBillingService.getLocationPartner(id);
  }

  @Post('partners')
  @ApiOperation({ summary: 'Create a new partner for this location' })
  @ApiHeader({ name: 'X-Location-ID', required: true })
  async createPartner(
    @Headers('x-location-id') locationId: string,
    @Body() dto: CreateLocationPartnerDto,
  ) {
    const locId = this.validateLocationId(locationId);
    return this.locationBillingService.createLocationPartner(locId, dto);
  }

  @Put('partners/:id')
  @ApiOperation({ summary: 'Update a partner' })
  @ApiHeader({ name: 'X-Location-ID', required: true })
  @ApiParam({ name: 'id', description: 'Partner ID' })
  async updatePartner(
    @Headers('x-location-id') locationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateLocationPartnerDto,
  ) {
    this.validateLocationId(locationId);
    return this.locationBillingService.updateLocationPartner(id, dto);
  }

  @Delete('partners/:id')
  @ApiOperation({ summary: 'Delete (deactivate) a partner' })
  @ApiHeader({ name: 'X-Location-ID', required: true })
  @ApiParam({ name: 'id', description: 'Partner ID' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePartner(
    @Headers('x-location-id') locationId: string,
    @Param('id') id: string,
  ) {
    this.validateLocationId(locationId);
    await this.locationBillingService.deleteLocationPartner(id);
  }

  @Post('partners/check-tax-number')
  @ApiOperation({
    summary: 'Check if a tax number belongs to a Network partner',
    description: 'Returns whether the tax number is already registered as a Network partner. If yes, the subcontractor cannot add this company as their own partner.',
  })
  @ApiHeader({ name: 'X-Location-ID', required: true })
  async checkTaxNumber(
    @Headers('x-location-id') locationId: string,
    @Body() dto: CheckTaxNumberDto,
  ) {
    const locId = this.validateLocationId(locationId);
    return this.locationBillingService.checkTaxNumberCollision(locId, dto.taxNumber);
  }

  // =============================================================================
  // WALK-IN INVOICES
  // =============================================================================

  @Post('invoices/walk-in')
  @ApiOperation({
    summary: 'Create a walk-in invoice',
    description: 'Create and issue an immediate invoice for a walk-in customer (cash/card payment). This invoice is issued by the subcontractor, not the Network.',
  })
  @ApiHeader({ name: 'X-Location-ID', required: true })
  async createWalkInInvoice(
    @Headers('x-location-id') locationId: string,
    @Body() dto: CreateWalkInInvoiceDto,
  ) {
    const locId = this.validateLocationId(locationId);
    return this.locationBillingService.createWalkInInvoice(
      locId,
      dto.washEventId,
      dto.paymentMethod,
      {
        billingName: dto.billingName,
        billingAddress: dto.billingAddress,
        billingCity: dto.billingCity,
        billingZipCode: dto.billingZipCode,
        billingCountry: dto.billingCountry,
        billingTaxNumber: dto.billingTaxNumber,
        billingEmail: dto.billingEmail,
      },
    );
  }

  @Post('invoices/walk-in/check-billing')
  @ApiOperation({
    summary: 'Check if location can bill a customer',
    description: 'Returns whether the location can directly bill a customer or if the Network should handle it.',
  })
  @ApiHeader({ name: 'X-Location-ID', required: true })
  async checkCanBill(
    @Headers('x-location-id') locationId: string,
    @Body() body: { partnerCompanyId?: string; taxNumber?: string },
  ) {
    const locId = this.validateLocationId(locationId);
    return this.locationBillingService.canLocationBillCustomer(
      locId,
      body.partnerCompanyId,
      body.taxNumber,
    );
  }

  // =============================================================================
  // PARTNER INVOICES (Gyűjtőszámla)
  // =============================================================================

  @Post('invoices/partner/prepare')
  @ApiOperation({
    summary: 'Prepare a collection invoice for a location partner',
    description: 'Creates a DRAFT invoice for all uninvoiced wash events in the specified period.',
  })
  @ApiHeader({ name: 'X-Location-ID', required: true })
  async preparePartnerInvoice(
    @Headers('x-location-id') locationId: string,
    @Body() dto: PreparePartnerInvoiceDto,
  ) {
    const locId = this.validateLocationId(locationId);
    return this.locationBillingService.preparePartnerInvoice(
      locId,
      dto.locationPartnerId,
      new Date(dto.periodStart),
      new Date(dto.periodEnd),
    );
  }

  // =============================================================================
  // STATEMENTS (Network felé kimutatások)
  // =============================================================================

  @Get('statements')
  @ApiOperation({
    summary: 'Get all statements for this location',
    description: 'Returns monthly statements generated for billing the Network.',
  })
  @ApiHeader({ name: 'X-Location-ID', required: true })
  async getStatements(@Headers('x-location-id') locationId: string) {
    const locId = this.validateLocationId(locationId);
    return this.locationBillingService.getStatements(locId);
  }

  @Get('statements/:id')
  @ApiOperation({
    summary: 'Get statement details with wash events',
    description: 'Returns a statement with all wash events in the period.',
  })
  @ApiHeader({ name: 'X-Location-ID', required: true })
  @ApiParam({ name: 'id', description: 'Statement ID' })
  async getStatementDetails(
    @Headers('x-location-id') locationId: string,
    @Param('id') id: string,
  ) {
    this.validateLocationId(locationId);
    return this.locationBillingService.getStatementDetails(id);
  }

  @Post('statements/:id/create-invoice')
  @ApiOperation({
    summary: 'Create invoice to Network from statement',
    description: 'Creates a DRAFT invoice to the Network based on the statement.',
  })
  @ApiHeader({ name: 'X-Location-ID', required: true })
  @ApiParam({ name: 'id', description: 'Statement ID' })
  async createNetworkInvoice(
    @Headers('x-location-id') locationId: string,
    @Param('id') id: string,
  ) {
    this.validateLocationId(locationId);
    return this.locationBillingService.createNetworkInvoice(id);
  }

  // =============================================================================
  // INVOICES
  // =============================================================================

  @Get('invoices')
  @ApiOperation({ summary: 'Get all invoices for this location' })
  @ApiHeader({ name: 'X-Location-ID', required: true })
  @ApiQuery({ name: 'invoiceType', required: false, enum: LocationInvoiceType })
  @ApiQuery({ name: 'status', required: false, enum: LocationInvoiceStatus })
  @ApiQuery({ name: 'locationPartnerId', required: false })
  @ApiQuery({ name: 'issueDateFrom', required: false })
  @ApiQuery({ name: 'issueDateTo', required: false })
  async getInvoices(
    @Headers('x-location-id') locationId: string,
    @Query('invoiceType') invoiceType?: LocationInvoiceType,
    @Query('status') status?: LocationInvoiceStatus,
    @Query('locationPartnerId') locationPartnerId?: string,
    @Query('issueDateFrom') issueDateFrom?: string,
    @Query('issueDateTo') issueDateTo?: string,
  ) {
    const locId = this.validateLocationId(locationId);
    return this.locationBillingService.getLocationInvoices(locId, {
      invoiceType,
      status,
      locationPartnerId,
      issueDateFrom: issueDateFrom ? new Date(issueDateFrom) : undefined,
      issueDateTo: issueDateTo ? new Date(issueDateTo) : undefined,
    });
  }

  @Get('invoices/:id')
  @ApiOperation({ summary: 'Get invoice details' })
  @ApiHeader({ name: 'X-Location-ID', required: true })
  @ApiParam({ name: 'id', description: 'Invoice ID' })
  async getInvoice(
    @Headers('x-location-id') locationId: string,
    @Param('id') id: string,
  ) {
    this.validateLocationId(locationId);
    return this.locationBillingService.getLocationInvoice(id);
  }

  @Post('invoices/:id/issue')
  @ApiOperation({
    summary: 'Issue an invoice through the configured provider',
    description: 'Sends the DRAFT invoice to the configured billing provider (Szamlazz.hu, Billingo, etc.)',
  })
  @ApiHeader({ name: 'X-Location-ID', required: true })
  @ApiParam({ name: 'id', description: 'Invoice ID' })
  async issueInvoice(
    @Headers('x-location-id') locationId: string,
    @Param('id') id: string,
  ) {
    this.validateLocationId(locationId);
    return this.locationBillingService.issueLocationInvoice(id);
  }

  @Post('invoices/:id/mark-paid')
  @ApiOperation({ summary: 'Mark an invoice as paid' })
  @ApiHeader({ name: 'X-Location-ID', required: true })
  @ApiParam({ name: 'id', description: 'Invoice ID' })
  async markPaid(
    @Headers('x-location-id') locationId: string,
    @Param('id') id: string,
    @Body() body: { paidDate?: string },
  ) {
    this.validateLocationId(locationId);
    return this.locationBillingService.markLocationInvoicePaid(
      id,
      body.paidDate ? new Date(body.paidDate) : undefined,
    );
  }
}
