import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  Headers,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import * as QRCode from 'qrcode';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
  ApiHeader,
} from '@nestjs/swagger';
import { Request } from 'express';
import { WashEventService } from '../modules/wash-event/wash-event.service';
import { PartnerCompanyService } from '../modules/partner-company/partner-company.service';
import { LocationService } from '../modules/location/location.service';
import { ServicePackageService } from '../modules/service-package/service-package.service';
import { DriverService } from '../modules/driver/driver.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { WashEntryMode, BillingType, BillingCycle } from '@prisma/client';
import { CreateWashEventOperatorDto } from './dto/create-wash-event.dto';
import { QueryWashEventsDto } from './dto/query-wash-events.dto';
import {
  CreatePartnerCompanyDto,
  UpdatePartnerCompanyDto,
} from './dto/partner-company.dto';
import {
  CreateDriverDto,
  UpdateDriverDto,
  UpdateDriverPinDto,
} from './dto/driver.dto';
import {
  CreateLocationDto,
  UpdateLocationDto,
  OperationType,
} from './dto/location.dto';

@ApiTags('operator')
@Controller('operator')
export class OperatorController {
  constructor(
    private readonly washEventService: WashEventService,
    private readonly partnerCompanyService: PartnerCompanyService,
    private readonly locationService: LocationService,
    private readonly servicePackageService: ServicePackageService,
    private readonly driverService: DriverService,
    private readonly prisma: PrismaService,
  ) {}

  private getRequestMetadata(req: Request) {
    return {
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.get('user-agent'),
    };
  }

  private getTenantContext(
    networkId: string | undefined,
    userId: string | undefined,
  ) {
    if (!networkId) {
      throw new BadRequestException('X-Network-ID header is required');
    }
    if (!userId) {
      throw new BadRequestException('X-User-ID header is required');
    }
    return { networkId, userId };
  }

  @Post('wash-events')
  @ApiOperation({ summary: 'Create a new wash event (manual operator mode)' })
  @ApiHeader({
    name: 'X-Network-ID',
    description: 'Network (tenant) ID',
    required: true,
  })
  @ApiHeader({
    name: 'X-User-ID',
    description: 'Operator user ID',
    required: true,
  })
  @ApiBody({ type: CreateWashEventOperatorDto })
  @ApiResponse({ status: 201, description: 'Wash event created' })
  async createWashEvent(
    @Body() dto: CreateWashEventOperatorDto,
    @Headers('x-network-id') networkId: string,
    @Headers('x-user-id') userId: string,
    @Req() req: Request,
  ) {
    const { networkId: tenantId, userId: operatorId } = this.getTenantContext(
      networkId,
      userId,
    );
    const metadata = this.getRequestMetadata(req);

    const washEvent = await this.washEventService.createManualOperator(
      tenantId,
      {
        entryMode: WashEntryMode.MANUAL_OPERATOR,
        locationId: dto.locationId,
        partnerCompanyId: dto.partnerCompanyId,
        driverNameManual: dto.driverNameManual,
        servicePackageId: dto.servicePackageId,
        tractorPlateManual: dto.tractorPlateManual,
        trailerPlateManual: dto.trailerPlateManual,
        createdByUserId: operatorId,
      },
      {
        actorType: 'USER',
        actorId: operatorId,
        ...metadata,
      },
    );

    return washEvent;
  }

  @Get('wash-events')
  @ApiOperation({ summary: 'List wash events with filters' })
  @ApiHeader({
    name: 'X-Network-ID',
    description: 'Network (tenant) ID',
    required: true,
  })
  @ApiResponse({ status: 200, description: 'List of wash events' })
  async getWashEvents(
    @Query() query: QueryWashEventsDto,
    @Headers('x-network-id') networkId: string,
  ) {
    if (!networkId) {
      throw new BadRequestException('X-Network-ID header is required');
    }

    // Ha van locationId, csak az adott helyszín mosásai
    if (query.locationId) {
      return this.washEventService.findByLocation(networkId, query.locationId, {
        status: query.status,
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined,
        limit: query.limit,
        offset: query.offset,
      });
    }

    // Ha nincs locationId, az összes mosás a networkben (admin számára)
    return this.washEventService.findByNetwork(networkId, {
      status: query.status,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Get('wash-events/:id')
  @ApiOperation({ summary: 'Get a single wash event by ID' })
  @ApiHeader({
    name: 'X-Network-ID',
    description: 'Network (tenant) ID',
    required: true,
  })
  @ApiParam({ name: 'id', description: 'Wash event ID' })
  @ApiResponse({ status: 200, description: 'Wash event details' })
  async getWashEvent(
    @Param('id') id: string,
    @Headers('x-network-id') networkId: string,
  ) {
    if (!networkId) {
      throw new BadRequestException('X-Network-ID header is required');
    }

    return this.washEventService.findById(networkId, id);
  }

  @Post('wash-events/:id/authorize')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authorize a wash event' })
  @ApiHeader({
    name: 'X-Network-ID',
    description: 'Network (tenant) ID',
    required: true,
  })
  @ApiHeader({
    name: 'X-User-ID',
    description: 'Operator user ID',
    required: true,
  })
  @ApiParam({ name: 'id', description: 'Wash event ID' })
  @ApiResponse({ status: 200, description: 'Wash event authorized' })
  async authorizeWashEvent(
    @Param('id') id: string,
    @Headers('x-network-id') networkId: string,
    @Headers('x-user-id') userId: string,
    @Req() req: Request,
  ) {
    const { networkId: tenantId, userId: operatorId } = this.getTenantContext(
      networkId,
      userId,
    );
    const metadata = this.getRequestMetadata(req);

    return this.washEventService.authorize(tenantId, id, {
      actorType: 'USER',
      actorId: operatorId,
      ...metadata,
    });
  }

  @Post('wash-events/:id/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start a wash event' })
  @ApiHeader({
    name: 'X-Network-ID',
    description: 'Network (tenant) ID',
    required: true,
  })
  @ApiHeader({
    name: 'X-User-ID',
    description: 'Operator user ID',
    required: true,
  })
  @ApiParam({ name: 'id', description: 'Wash event ID' })
  @ApiResponse({ status: 200, description: 'Wash event started' })
  async startWashEvent(
    @Param('id') id: string,
    @Headers('x-network-id') networkId: string,
    @Headers('x-user-id') userId: string,
    @Req() req: Request,
  ) {
    const { networkId: tenantId, userId: operatorId } = this.getTenantContext(
      networkId,
      userId,
    );
    const metadata = this.getRequestMetadata(req);

    return this.washEventService.start(tenantId, id, {
      actorType: 'USER',
      actorId: operatorId,
      ...metadata,
    });
  }

  @Post('wash-events/:id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete a wash event' })
  @ApiHeader({
    name: 'X-Network-ID',
    description: 'Network (tenant) ID',
    required: true,
  })
  @ApiHeader({
    name: 'X-User-ID',
    description: 'Operator user ID',
    required: true,
  })
  @ApiParam({ name: 'id', description: 'Wash event ID' })
  @ApiResponse({ status: 200, description: 'Wash event completed' })
  async completeWashEvent(
    @Param('id') id: string,
    @Headers('x-network-id') networkId: string,
    @Headers('x-user-id') userId: string,
    @Req() req: Request,
  ) {
    const { networkId: tenantId, userId: operatorId } = this.getTenantContext(
      networkId,
      userId,
    );
    const metadata = this.getRequestMetadata(req);

    return this.washEventService.complete(tenantId, id, {
      actorType: 'USER',
      actorId: operatorId,
      ...metadata,
    });
  }

  @Post('wash-events/:id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a wash event' })
  @ApiHeader({
    name: 'X-Network-ID',
    description: 'Network (tenant) ID',
    required: true,
  })
  @ApiHeader({
    name: 'X-User-ID',
    description: 'Operator user ID',
    required: true,
  })
  @ApiParam({ name: 'id', description: 'Wash event ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Rejection reason' },
      },
      required: ['reason'],
    },
  })
  @ApiResponse({ status: 200, description: 'Wash event rejected' })
  async rejectWashEvent(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Headers('x-network-id') networkId: string,
    @Headers('x-user-id') userId: string,
    @Req() req: Request,
  ) {
    if (!reason) {
      throw new BadRequestException('Rejection reason is required');
    }

    const { networkId: tenantId, userId: operatorId } = this.getTenantContext(
      networkId,
      userId,
    );
    const metadata = this.getRequestMetadata(req);

    return this.washEventService.reject(tenantId, id, reason, {
      actorType: 'USER',
      actorId: operatorId,
      ...metadata,
    });
  }

  @Post('wash-events/:id/lock')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lock a completed wash event' })
  @ApiHeader({
    name: 'X-Network-ID',
    description: 'Network (tenant) ID',
    required: true,
  })
  @ApiHeader({
    name: 'X-User-ID',
    description: 'Operator user ID',
    required: true,
  })
  @ApiParam({ name: 'id', description: 'Wash event ID' })
  @ApiResponse({ status: 200, description: 'Wash event locked' })
  async lockWashEvent(
    @Param('id') id: string,
    @Headers('x-network-id') networkId: string,
    @Headers('x-user-id') userId: string,
    @Req() req: Request,
  ) {
    const { networkId: tenantId, userId: operatorId } = this.getTenantContext(
      networkId,
      userId,
    );
    const metadata = this.getRequestMetadata(req);

    return this.washEventService.lock(tenantId, id, {
      actorType: 'USER',
      actorId: operatorId,
      ...metadata,
    });
  }

  // =========================================================================
  // PARTNER COMPANY CRUD
  // =========================================================================

  @Get('partner-companies')
  @ApiOperation({ summary: 'List all partner companies' })
  @ApiHeader({
    name: 'X-Network-ID',
    description: 'Network (tenant) ID',
    required: true,
  })
  @ApiResponse({ status: 200, description: 'List of partner companies' })
  async getPartnerCompanies(
    @Headers('x-network-id') networkId: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    if (!networkId) {
      throw new BadRequestException('X-Network-ID header is required');
    }

    if (activeOnly === 'true') {
      return this.partnerCompanyService.findActive(networkId);
    }
    return this.partnerCompanyService.findAll(networkId);
  }

  @Get('partner-companies/:id')
  @ApiOperation({ summary: 'Get partner company by ID' })
  @ApiHeader({
    name: 'X-Network-ID',
    description: 'Network (tenant) ID',
    required: true,
  })
  @ApiParam({ name: 'id', description: 'Partner company ID' })
  @ApiResponse({ status: 200, description: 'Partner company details' })
  async getPartnerCompany(
    @Param('id') id: string,
    @Headers('x-network-id') networkId: string,
  ) {
    if (!networkId) {
      throw new BadRequestException('X-Network-ID header is required');
    }

    return this.partnerCompanyService.findById(networkId, id);
  }

  @Post('partner-companies')
  @ApiOperation({ summary: 'Create a new partner company' })
  @ApiHeader({
    name: 'X-Network-ID',
    description: 'Network (tenant) ID',
    required: true,
  })
  @ApiBody({ type: CreatePartnerCompanyDto })
  @ApiResponse({ status: 201, description: 'Partner company created' })
  async createPartnerCompany(
    @Body() dto: CreatePartnerCompanyDto,
    @Headers('x-network-id') networkId: string,
  ) {
    if (!networkId) {
      throw new BadRequestException('X-Network-ID header is required');
    }

    return this.partnerCompanyService.create(networkId, {
      ...dto,
      billingType: dto.billingType as BillingType,
      billingCycle: dto.billingCycle as BillingCycle | undefined,
    });
  }

  @Put('partner-companies/:id')
  @ApiOperation({ summary: 'Update a partner company' })
  @ApiHeader({
    name: 'X-Network-ID',
    description: 'Network (tenant) ID',
    required: true,
  })
  @ApiParam({ name: 'id', description: 'Partner company ID' })
  @ApiBody({ type: UpdatePartnerCompanyDto })
  @ApiResponse({ status: 200, description: 'Partner company updated' })
  async updatePartnerCompany(
    @Param('id') id: string,
    @Body() dto: UpdatePartnerCompanyDto,
    @Headers('x-network-id') networkId: string,
  ) {
    if (!networkId) {
      throw new BadRequestException('X-Network-ID header is required');
    }

    return this.partnerCompanyService.update(networkId, id, {
      ...dto,
      billingType: dto.billingType as BillingType | undefined,
      billingCycle: dto.billingCycle as BillingCycle | null | undefined,
    });
  }

  @Delete('partner-companies/:id')
  @ApiOperation({ summary: 'Delete a partner company (soft delete)' })
  @ApiHeader({
    name: 'X-Network-ID',
    description: 'Network (tenant) ID',
    required: true,
  })
  @ApiParam({ name: 'id', description: 'Partner company ID' })
  @ApiResponse({ status: 200, description: 'Partner company deleted' })
  async deletePartnerCompany(
    @Param('id') id: string,
    @Headers('x-network-id') networkId: string,
  ) {
    if (!networkId) {
      throw new BadRequestException('X-Network-ID header is required');
    }

    return this.partnerCompanyService.softDelete(networkId, id);
  }

  // =========================================================================
  // REFERENCE DATA ENDPOINTS
  // =========================================================================

  @Get('locations')
  @ApiOperation({ summary: 'List locations' })
  @ApiHeader({
    name: 'X-Network-ID',
    description: 'Network (tenant) ID',
    required: true,
  })
  @ApiResponse({ status: 200, description: 'List of locations' })
  async getLocations(
    @Headers('x-network-id') networkId: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    if (!networkId) {
      throw new BadRequestException('X-Network-ID header is required');
    }

    if (activeOnly === 'true') {
      return this.locationService.findActive(networkId);
    }
    return this.locationService.findAll(networkId);
  }

  @Get('locations/:id')
  @ApiOperation({ summary: 'Get location by ID' })
  @ApiHeader({
    name: 'X-Network-ID',
    description: 'Network (tenant) ID',
    required: true,
  })
  @ApiParam({ name: 'id', description: 'Location ID' })
  @ApiResponse({ status: 200, description: 'Location details' })
  async getLocation(
    @Param('id') id: string,
    @Headers('x-network-id') networkId: string,
  ) {
    if (!networkId) {
      throw new BadRequestException('X-Network-ID header is required');
    }

    return this.locationService.findById(networkId, id);
  }

  @Post('locations')
  @ApiOperation({ summary: 'Create a new location' })
  @ApiHeader({
    name: 'X-Network-ID',
    description: 'Network (tenant) ID',
    required: true,
  })
  @ApiBody({ type: CreateLocationDto })
  @ApiResponse({ status: 201, description: 'Location created' })
  async createLocation(
    @Body() dto: CreateLocationDto,
    @Headers('x-network-id') networkId: string,
  ) {
    if (!networkId) {
      throw new BadRequestException('X-Network-ID header is required');
    }

    return this.locationService.create(networkId, {
      ...dto,
      operationType: dto.operationType as any,
    });
  }

  @Put('locations/:id')
  @ApiOperation({ summary: 'Update a location' })
  @ApiHeader({
    name: 'X-Network-ID',
    description: 'Network (tenant) ID',
    required: true,
  })
  @ApiParam({ name: 'id', description: 'Location ID' })
  @ApiBody({ type: UpdateLocationDto })
  @ApiResponse({ status: 200, description: 'Location updated' })
  async updateLocation(
    @Param('id') id: string,
    @Body() dto: UpdateLocationDto,
    @Headers('x-network-id') networkId: string,
  ) {
    if (!networkId) {
      throw new BadRequestException('X-Network-ID header is required');
    }

    return this.locationService.update(networkId, id, {
      ...dto,
      operationType: dto.operationType as any,
    });
  }

  @Delete('locations/:id')
  @ApiOperation({ summary: 'Delete a location (soft delete)' })
  @ApiHeader({
    name: 'X-Network-ID',
    description: 'Network (tenant) ID',
    required: true,
  })
  @ApiParam({ name: 'id', description: 'Location ID' })
  @ApiResponse({ status: 200, description: 'Location deleted' })
  async deleteLocation(
    @Param('id') id: string,
    @Headers('x-network-id') networkId: string,
  ) {
    if (!networkId) {
      throw new BadRequestException('X-Network-ID header is required');
    }

    return this.locationService.softDelete(networkId, id);
  }

  @Get('locations/:id/services')
  @ApiOperation({ summary: 'List available services at a location' })
  @ApiHeader({
    name: 'X-Network-ID',
    description: 'Network (tenant) ID',
    required: true,
  })
  @ApiParam({ name: 'id', description: 'Location ID' })
  @ApiResponse({ status: 200, description: 'Available services' })
  async getLocationServices(
    @Param('id') id: string,
    @Headers('x-network-id') networkId: string,
  ) {
    if (!networkId) {
      throw new BadRequestException('X-Network-ID header is required');
    }

    return this.servicePackageService.findAvailableAtLocation(networkId, id);
  }

  @Put('locations/:id/services')
  @ApiOperation({ summary: 'Update available services at a location' })
  @ApiHeader({
    name: 'X-Network-ID',
    description: 'Network (tenant) ID',
    required: true,
  })
  @ApiParam({ name: 'id', description: 'Location ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        servicePackageIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of service package IDs to enable at this location',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Services updated' })
  async updateLocationServices(
    @Param('id') id: string,
    @Headers('x-network-id') networkId: string,
    @Body() body: { servicePackageIds: string[] },
  ) {
    if (!networkId) {
      throw new BadRequestException('X-Network-ID header is required');
    }

    // Verify location exists
    await this.locationService.findById(networkId, id);

    // Get all service packages
    const allServices = await this.servicePackageService.findAll(networkId);

    // Update availability for each service
    for (const service of allServices) {
      const isEnabled = body.servicePackageIds.includes(service.id);
      await this.servicePackageService.setLocationAvailability(
        networkId,
        id,
        service.id,
        isEnabled,
      );
    }

    return this.servicePackageService.findAvailableAtLocation(networkId, id);
  }

  @Get('service-packages')
  @ApiOperation({ summary: 'List all service packages' })
  @ApiHeader({
    name: 'X-Network-ID',
    description: 'Network (tenant) ID',
    required: true,
  })
  @ApiResponse({ status: 200, description: 'All service packages' })
  async getAllServicePackages(
    @Headers('x-network-id') networkId: string,
  ) {
    if (!networkId) {
      throw new BadRequestException('X-Network-ID header is required');
    }

    return this.servicePackageService.findAll(networkId);
  }

  @Get('locations/:id/qr-code')
  @ApiOperation({ summary: 'Generate QR code for location wash start URL' })
  @ApiHeader({
    name: 'X-Network-ID',
    description: 'Network (tenant) ID',
    required: true,
  })
  @ApiParam({ name: 'id', description: 'Location ID' })
  @ApiResponse({
    status: 200,
    description: 'QR code image (PNG or SVG)',
    content: {
      'image/png': {},
      'image/svg+xml': {},
    },
  })
  async getLocationQRCode(
    @Param('id') id: string,
    @Headers('x-network-id') networkId: string,
    @Query('format') format: 'png' | 'svg' = 'png',
    @Query('size') size: string = '300',
    @Query('baseUrl') baseUrl: string | undefined,
    @Res() res: Response,
  ) {
    if (!networkId) {
      throw new BadRequestException('X-Network-ID header is required');
    }

    // Get location to validate it exists and get the code
    const location = await this.locationService.findById(networkId, id);

    // Default base URL for PWA - can be overridden via query param
    const pwaBaseUrl = baseUrl || process.env.PWA_BASE_URL || 'https://app.vemiax.com';
    const washUrl = `${pwaBaseUrl}/wash/new?location=${location.code}`;

    const qrSize = Math.min(Math.max(parseInt(size) || 300, 100), 1000);

    if (format === 'svg') {
      const svg = await QRCode.toString(washUrl, {
        type: 'svg',
        width: qrSize,
        margin: 2,
        color: {
          dark: '#1f2937', // gray-800
          light: '#ffffff',
        },
      });

      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="qr-${location.code}.svg"`,
      );
      return res.send(svg);
    }

    // Default: PNG
    const pngBuffer = await QRCode.toBuffer(washUrl, {
      type: 'png',
      width: qrSize,
      margin: 2,
      color: {
        dark: '#1f2937',
        light: '#ffffff',
      },
    });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="qr-${location.code}.png"`,
    );
    return res.send(pngBuffer);
  }

  @Get('locations/:id/qr-code-data')
  @ApiOperation({
    summary: 'Get QR code data as base64 (for embedding in HTML)',
  })
  @ApiHeader({
    name: 'X-Network-ID',
    description: 'Network (tenant) ID',
    required: true,
  })
  @ApiParam({ name: 'id', description: 'Location ID' })
  @ApiResponse({
    status: 200,
    description: 'QR code data with base64 image and URL',
  })
  async getLocationQRCodeData(
    @Param('id') id: string,
    @Headers('x-network-id') networkId: string,
    @Query('size') size: string = '300',
    @Query('baseUrl') baseUrl?: string,
  ) {
    if (!networkId) {
      throw new BadRequestException('X-Network-ID header is required');
    }

    // Get location to validate it exists and get the code
    const location = await this.locationService.findById(networkId, id);

    // Default base URL for PWA
    const pwaBaseUrl = baseUrl || process.env.PWA_BASE_URL || 'https://app.vemiax.com';
    const washUrl = `${pwaBaseUrl}/wash/new?location=${location.code}`;

    const qrSize = Math.min(Math.max(parseInt(size) || 300, 100), 1000);

    const dataUrl = await QRCode.toDataURL(washUrl, {
      width: qrSize,
      margin: 2,
      color: {
        dark: '#1f2937',
        light: '#ffffff',
      },
    });

    return {
      locationId: location.id,
      locationCode: location.code,
      locationName: location.name,
      washUrl,
      qrCodeDataUrl: dataUrl,
      size: qrSize,
    };
  }

  @Get('drivers')
  @ApiOperation({ summary: 'List all drivers' })
  @ApiHeader({
    name: 'X-Network-ID',
    description: 'Network (tenant) ID',
    required: true,
  })
  @ApiResponse({ status: 200, description: 'List of drivers' })
  async getDrivers(@Headers('x-network-id') networkId: string) {
    if (!networkId) {
      throw new BadRequestException('X-Network-ID header is required');
    }

    return this.driverService.findAll(networkId);
  }

  @Get('drivers/pending-approval')
  @ApiOperation({ summary: 'Get drivers pending approval' })
  @ApiHeader({
    name: 'X-Network-ID',
    description: 'Network (tenant) ID',
    required: true,
  })
  @ApiResponse({ status: 200, description: 'List of pending drivers' })
  async getPendingDrivers(@Headers('x-network-id') networkId: string) {
    if (!networkId) {
      throw new BadRequestException('X-Network-ID header is required');
    }

    return this.driverService.findPendingApproval(networkId);
  }

  @Get('drivers/:id')
  @ApiOperation({ summary: 'Get driver by ID' })
  @ApiHeader({
    name: 'X-Network-ID',
    description: 'Network (tenant) ID',
    required: true,
  })
  @ApiParam({ name: 'id', description: 'Driver ID' })
  @ApiResponse({ status: 200, description: 'Driver details' })
  async getDriver(
    @Param('id') id: string,
    @Headers('x-network-id') networkId: string,
  ) {
    if (!networkId) {
      throw new BadRequestException('X-Network-ID header is required');
    }

    return this.driverService.findById(networkId, id);
  }

  @Post('drivers')
  @ApiOperation({ summary: 'Create a new driver' })
  @ApiHeader({
    name: 'X-Network-ID',
    description: 'Network (tenant) ID',
    required: true,
  })
  @ApiBody({ type: CreateDriverDto })
  @ApiResponse({ status: 201, description: 'Driver created with invite code' })
  async createDriver(
    @Body() dto: CreateDriverDto,
    @Headers('x-network-id') networkId: string,
  ) {
    if (!networkId) {
      throw new BadRequestException('X-Network-ID header is required');
    }

    return this.driverService.create(networkId, dto);
  }

  @Put('drivers/:id')
  @ApiOperation({ summary: 'Update a driver' })
  @ApiHeader({
    name: 'X-Network-ID',
    description: 'Network (tenant) ID',
    required: true,
  })
  @ApiParam({ name: 'id', description: 'Driver ID' })
  @ApiBody({ type: UpdateDriverDto })
  @ApiResponse({ status: 200, description: 'Driver updated' })
  async updateDriver(
    @Param('id') id: string,
    @Body() dto: UpdateDriverDto,
    @Headers('x-network-id') networkId: string,
  ) {
    if (!networkId) {
      throw new BadRequestException('X-Network-ID header is required');
    }

    return this.driverService.update(networkId, id, dto);
  }

  @Put('drivers/:id/pin')
  @ApiOperation({ summary: 'Update driver PIN' })
  @ApiHeader({
    name: 'X-Network-ID',
    description: 'Network (tenant) ID',
    required: true,
  })
  @ApiParam({ name: 'id', description: 'Driver ID' })
  @ApiBody({ type: UpdateDriverPinDto })
  @ApiResponse({ status: 200, description: 'Driver PIN updated' })
  async updateDriverPin(
    @Param('id') id: string,
    @Body() dto: UpdateDriverPinDto,
    @Headers('x-network-id') networkId: string,
  ) {
    if (!networkId) {
      throw new BadRequestException('X-Network-ID header is required');
    }

    return this.driverService.updatePin(networkId, id, dto.pin);
  }

  @Delete('drivers/:id')
  @ApiOperation({ summary: 'Delete a driver (soft delete)' })
  @ApiHeader({
    name: 'X-Network-ID',
    description: 'Network (tenant) ID',
    required: true,
  })
  @ApiParam({ name: 'id', description: 'Driver ID' })
  @ApiResponse({ status: 200, description: 'Driver deleted' })
  async deleteDriver(
    @Param('id') id: string,
    @Headers('x-network-id') networkId: string,
  ) {
    if (!networkId) {
      throw new BadRequestException('X-Network-ID header is required');
    }

    return this.driverService.softDelete(networkId, id);
  }

  @Post('drivers/:id/regenerate-invite')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Regenerate driver invite code' })
  @ApiHeader({
    name: 'X-Network-ID',
    description: 'Network (tenant) ID',
    required: true,
  })
  @ApiParam({ name: 'id', description: 'Driver ID' })
  @ApiResponse({ status: 200, description: 'New invite code generated' })
  async regenerateDriverInvite(
    @Param('id') id: string,
    @Headers('x-network-id') networkId: string,
  ) {
    if (!networkId) {
      throw new BadRequestException('X-Network-ID header is required');
    }

    return this.driverService.regenerateInvite(networkId, id);
  }

  @Get('drivers/:id/invite')
  @ApiOperation({ summary: 'Get driver invite code' })
  @ApiHeader({
    name: 'X-Network-ID',
    description: 'Network (tenant) ID',
    required: true,
  })
  @ApiParam({ name: 'id', description: 'Driver ID' })
  @ApiResponse({ status: 200, description: 'Driver invite details' })
  async getDriverInvite(
    @Param('id') id: string,
    @Headers('x-network-id') networkId: string,
  ) {
    if (!networkId) {
      throw new BadRequestException('X-Network-ID header is required');
    }

    // First verify driver exists and belongs to network
    await this.driverService.findById(networkId, id);

    // Get the invite
    let invite = await this.driverService.getInvite(id);

    // If no invite exists, generate one automatically
    if (!invite) {
      invite = await this.driverService.regenerateInvite(networkId, id);
    }

    return invite;
  }

  // =========================================================================
  // DRIVER APPROVAL (for self-registered drivers)
  // =========================================================================

  @Post('drivers/:id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a self-registered driver' })
  @ApiHeader({
    name: 'X-Network-ID',
    description: 'Network (tenant) ID',
    required: true,
  })
  @ApiHeader({
    name: 'X-User-ID',
    description: 'Approving user ID',
    required: true,
  })
  @ApiParam({ name: 'id', description: 'Driver ID' })
  @ApiResponse({ status: 200, description: 'Driver approved with invite code' })
  async approveDriver(
    @Param('id') id: string,
    @Headers('x-network-id') networkId: string,
    @Headers('x-user-id') userId: string,
  ) {
    const { networkId: tenantId, userId: approverId } = this.getTenantContext(
      networkId,
      userId,
    );

    return this.driverService.approve(tenantId, id, approverId);
  }

  @Post('drivers/:id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a self-registered driver' })
  @ApiHeader({
    name: 'X-Network-ID',
    description: 'Network (tenant) ID',
    required: true,
  })
  @ApiHeader({
    name: 'X-User-ID',
    description: 'Rejecting user ID',
    required: true,
  })
  @ApiParam({ name: 'id', description: 'Driver ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Rejection reason' },
      },
      required: ['reason'],
    },
  })
  @ApiResponse({ status: 200, description: 'Driver rejected' })
  async rejectDriver(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Headers('x-network-id') networkId: string,
    @Headers('x-user-id') userId: string,
  ) {
    if (!reason) {
      throw new BadRequestException('Rejection reason is required');
    }

    const { networkId: tenantId, userId: rejecterId } = this.getTenantContext(
      networkId,
      userId,
    );

    return this.driverService.reject(tenantId, id, reason, rejecterId);
  }

  // =========================================================================
  // PARTNER COMPANY REGISTRATION QR CODE
  // =========================================================================

  @Get('partner-companies/:id/registration-qr-code')
  @ApiOperation({ summary: 'Generate driver registration QR code for partner company' })
  @ApiHeader({
    name: 'X-Network-ID',
    description: 'Network (tenant) ID',
    required: true,
  })
  @ApiParam({ name: 'id', description: 'Partner Company ID' })
  @ApiResponse({
    status: 200,
    description: 'QR code image (PNG or SVG)',
    content: {
      'image/png': {},
      'image/svg+xml': {},
    },
  })
  async getPartnerRegistrationQRCode(
    @Param('id') id: string,
    @Headers('x-network-id') networkId: string,
    @Query('format') format: 'png' | 'svg' = 'png',
    @Query('size') size: string = '300',
    @Query('baseUrl') baseUrl: string | undefined,
    @Res() res: Response,
  ) {
    if (!networkId) {
      throw new BadRequestException('X-Network-ID header is required');
    }

    // Get network to get slug
    const network = await this.prisma.network.findUnique({
      where: { id: networkId },
    });

    if (!network) {
      throw new BadRequestException('Network not found');
    }

    // Get partner company to validate it exists and get the code
    const partnerCompany = await this.partnerCompanyService.findById(networkId, id);

    // Default base URL for PWA - can be overridden via query param
    const pwaBaseUrl = baseUrl || process.env.PWA_BASE_URL || 'https://app.vemiax.com';
    const registerUrl = `${pwaBaseUrl}/register-qr/${network.slug}/${partnerCompany.code}`;

    const qrSize = Math.min(Math.max(parseInt(size) || 300, 100), 1000);

    if (format === 'svg') {
      const svg = await QRCode.toString(registerUrl, {
        type: 'svg',
        width: qrSize,
        margin: 2,
        color: {
          dark: '#1f2937', // gray-800
          light: '#ffffff',
        },
      });

      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="registration-qr-${partnerCompany.code}.svg"`,
      );
      return res.send(svg);
    }

    // Default: PNG
    const pngBuffer = await QRCode.toBuffer(registerUrl, {
      type: 'png',
      width: qrSize,
      margin: 2,
      color: {
        dark: '#1f2937',
        light: '#ffffff',
      },
    });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="registration-qr-${partnerCompany.code}.png"`,
    );
    return res.send(pngBuffer);
  }

  @Get('partner-companies/:id/registration-qr-data')
  @ApiOperation({
    summary: 'Get registration QR code data as base64 (for embedding in HTML)',
  })
  @ApiHeader({
    name: 'X-Network-ID',
    description: 'Network (tenant) ID',
    required: true,
  })
  @ApiParam({ name: 'id', description: 'Partner Company ID' })
  @ApiResponse({
    status: 200,
    description: 'QR code data with base64 image and URL',
  })
  async getPartnerRegistrationQRCodeData(
    @Param('id') id: string,
    @Headers('x-network-id') networkId: string,
    @Query('size') size: string = '300',
    @Query('baseUrl') baseUrl?: string,
  ) {
    if (!networkId) {
      throw new BadRequestException('X-Network-ID header is required');
    }

    // Get network to get slug
    const network = await this.prisma.network.findUnique({
      where: { id: networkId },
    });

    if (!network) {
      throw new BadRequestException('Network not found');
    }

    // Get partner company to validate it exists and get the code
    const partnerCompany = await this.partnerCompanyService.findById(networkId, id);

    // Default base URL for PWA
    const pwaBaseUrl = baseUrl || process.env.PWA_BASE_URL || 'https://app.vemiax.com';
    const registerUrl = `${pwaBaseUrl}/register-qr/${network.slug}/${partnerCompany.code}`;

    const qrSize = Math.min(Math.max(parseInt(size) || 300, 100), 1000);

    const dataUrl = await QRCode.toDataURL(registerUrl, {
      width: qrSize,
      margin: 2,
      color: {
        dark: '#1f2937',
        light: '#ffffff',
      },
    });

    return {
      partnerCompanyId: partnerCompany.id,
      partnerCompanyCode: partnerCompany.code,
      partnerCompanyName: partnerCompany.name,
      networkSlug: network.slug,
      networkName: network.name,
      registerUrl,
      qrCodeDataUrl: dataUrl,
      size: qrSize,
    };
  }
}
