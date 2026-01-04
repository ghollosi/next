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
  Headers,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
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
import { WashEntryMode, BillingType, BillingCycle } from '@prisma/client';
import { CreateWashEventOperatorDto } from './dto/create-wash-event.dto';
import { QueryWashEventsDto } from './dto/query-wash-events.dto';
import {
  CreatePartnerCompanyDto,
  UpdatePartnerCompanyDto,
} from './dto/partner-company.dto';

@ApiTags('operator')
@Controller('operator')
export class OperatorController {
  constructor(
    private readonly washEventService: WashEventService,
    private readonly partnerCompanyService: PartnerCompanyService,
    private readonly locationService: LocationService,
    private readonly servicePackageService: ServicePackageService,
    private readonly driverService: DriverService,
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

    if (!query.locationId) {
      throw new BadRequestException('locationId query parameter is required');
    }

    return this.washEventService.findByLocation(networkId, query.locationId, {
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
  async getLocations(@Headers('x-network-id') networkId: string) {
    if (!networkId) {
      throw new BadRequestException('X-Network-ID header is required');
    }

    return this.locationService.findActive(networkId);
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
}
