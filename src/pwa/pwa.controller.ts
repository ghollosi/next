import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Req,
  Headers,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UnauthorizedException,
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
import { DriverService } from '../modules/driver/driver.service';
import { WashEventService } from '../modules/wash-event/wash-event.service';
import { VehicleService } from '../modules/vehicle/vehicle.service';
import { ServicePackageService } from '../modules/service-package/service-package.service';
import { LocationService } from '../modules/location/location.service';
import { PartnerCompanyService } from '../modules/partner-company/partner-company.service';
import { WashEntryMode, DriverApprovalStatus } from '@prisma/client';
import { ActivateDto, ActivateResponseDto } from './dto/activate.dto';
import { CreateWashEventPwaDto } from './dto/create-wash-event.dto';
import {
  SelfRegisterDto,
  SelfRegisterResponseDto,
  CheckApprovalDto,
  CheckApprovalResponseDto,
} from './dto/register.dto';

// Simple in-memory session store for activated drivers
// In production, this would be JWT tokens or Redis sessions
const driverSessions = new Map<
  string,
  { driverId: string; networkId: string; partnerCompanyId: string }
>();

// Default network ID for self-registration
// In production, this would come from QR code or subdomain
const DEFAULT_NETWORK_ID = 'cf808392-6283-4487-9fbd-e72951ca5bf8';

@ApiTags('pwa')
@Controller('pwa')
export class PwaController {
  constructor(
    private readonly driverService: DriverService,
    private readonly washEventService: WashEventService,
    private readonly vehicleService: VehicleService,
    private readonly servicePackageService: ServicePackageService,
    private readonly locationService: LocationService,
    private readonly partnerCompanyService: PartnerCompanyService,
  ) {}

  private getRequestMetadata(req: Request) {
    return {
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.get('user-agent'),
    };
  }

  private getDriverSession(req: Request) {
    // In real implementation, this would validate JWT token
    // For now, we use a simple header-based session
    const sessionId = req.get('x-driver-session');
    if (!sessionId) {
      throw new BadRequestException('Driver session required');
    }

    const session = driverSessions.get(sessionId);
    if (!session) {
      throw new BadRequestException('Invalid or expired session');
    }

    return session;
  }

  // =========================================================================
  // PUBLIC ENDPOINTS (No session required)
  // =========================================================================

  @Get('partner-companies')
  @ApiOperation({ summary: 'Get list of partner companies for registration' })
  @ApiHeader({
    name: 'x-network-id',
    required: false,
    description: 'Network ID (uses default if not provided)',
  })
  @ApiResponse({ status: 200, description: 'List of partner companies' })
  async getPartnerCompanies(
    @Headers('x-network-id') networkId?: string,
  ) {
    const nid = networkId || DEFAULT_NETWORK_ID;
    const companies = await this.partnerCompanyService.findActive(nid);

    return companies.map((company) => ({
      id: company.id,
      code: company.code,
      name: company.name,
    }));
  }

  @Post('register')
  @ApiOperation({ summary: 'Self-register as a new driver' })
  @ApiHeader({
    name: 'x-network-id',
    required: false,
    description: 'Network ID (uses default if not provided)',
  })
  @ApiBody({ type: SelfRegisterDto })
  @ApiResponse({
    status: 201,
    description: 'Driver registered, pending approval',
    type: SelfRegisterResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid registration data' })
  async selfRegister(
    @Body() dto: SelfRegisterDto,
    @Headers('x-network-id') networkId?: string,
  ): Promise<SelfRegisterResponseDto> {
    const nid = networkId || DEFAULT_NETWORK_ID;

    // Verify partner company exists
    await this.partnerCompanyService.findById(nid, dto.partnerCompanyId);

    // Create driver with pending status
    const driver = await this.driverService.selfRegister(nid, {
      partnerCompanyId: dto.partnerCompanyId,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      email: dto.email,
      pin: dto.pin,
    });

    // Create vehicles if provided
    if (dto.vehicles && dto.vehicles.length > 0) {
      for (const vehicle of dto.vehicles) {
        await this.vehicleService.create(nid, {
          partnerCompanyId: dto.partnerCompanyId,
          driverId: driver.id,
          type: vehicle.type,
          plateNumber: vehicle.plateNumber,
          plateState: vehicle.plateState,
        });
      }
    }

    return {
      driverId: driver.id,
      firstName: driver.firstName,
      lastName: driver.lastName,
      approvalStatus: driver.approvalStatus,
      message: 'Regisztráció sikeres! A fiókod jóváhagyásra vár. Értesítést kapsz, ha aktiválásra került.',
    };
  }

  @Post('check-approval')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check driver approval status' })
  @ApiHeader({
    name: 'x-network-id',
    required: false,
    description: 'Network ID (uses default if not provided)',
  })
  @ApiBody({ type: CheckApprovalDto })
  @ApiResponse({
    status: 200,
    description: 'Approval status',
    type: CheckApprovalResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid PIN' })
  async checkApproval(
    @Body() dto: CheckApprovalDto,
    @Headers('x-network-id') networkId?: string,
  ): Promise<CheckApprovalResponseDto> {
    const nid = networkId || DEFAULT_NETWORK_ID;

    // Verify PIN first
    const isValid = await this.driverService.validateDriverPin(
      nid,
      dto.driverId,
      dto.pin,
    );

    if (!isValid) {
      throw new UnauthorizedException('Hibás PIN kód');
    }

    const { status, rejectionReason } = await this.driverService.checkApprovalStatus(
      nid,
      dto.driverId,
    );

    let message: string;
    let inviteCode: string | undefined;

    switch (status) {
      case DriverApprovalStatus.PENDING:
        message = 'A regisztrációd még jóváhagyásra vár. Kérjük, várj türelemmel!';
        break;
      case DriverApprovalStatus.APPROVED:
        message = 'A regisztrációd jóváhagyva! Az alábbi kóddal tudsz belépni:';
        const invite = await this.driverService.getInvite(dto.driverId);
        inviteCode = invite?.inviteCode;
        break;
      case DriverApprovalStatus.REJECTED:
        message = `Sajnáljuk, a regisztrációd elutasítva. ${rejectionReason ? `Indok: ${rejectionReason}` : ''}`;
        break;
      default:
        message = 'Ismeretlen státusz';
    }

    return {
      status,
      rejectionReason,
      inviteCode,
      message,
    };
  }

  // =========================================================================
  // ACTIVATION ENDPOINTS
  // =========================================================================

  @Post('activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate driver account using invite code and PIN' })
  @ApiBody({ type: ActivateDto })
  @ApiResponse({
    status: 200,
    description: 'Driver activated successfully',
    type: ActivateResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid invite code or PIN' })
  @ApiResponse({ status: 401, description: 'Invalid PIN' })
  async activate(
    @Body() dto: ActivateDto,
    @Req() req: Request,
  ): Promise<ActivateResponseDto & { sessionId: string }> {
    const driver = await this.driverService.activateByInviteCode(
      dto.inviteCode.toUpperCase(),
      dto.pin,
    );

    // Generate session ID (in production, use JWT)
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    driverSessions.set(sessionId, {
      driverId: driver.id,
      networkId: driver.partnerCompany.networkId,
      partnerCompanyId: driver.partnerCompany.id,
    });

    return {
      sessionId,
      driverId: driver.id,
      networkId: driver.partnerCompany.networkId,
      partnerCompanyId: driver.partnerCompany.id,
      firstName: driver.firstName,
      lastName: driver.lastName,
      partnerCompanyName: driver.partnerCompany.name,
    };
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current driver profile' })
  @ApiResponse({ status: 200, description: 'Driver profile' })
  @ApiResponse({ status: 400, description: 'Session required' })
  async getMe(@Req() req: Request) {
    const session = this.getDriverSession(req);
    const driver = await this.driverService.findById(
      session.networkId,
      session.driverId,
    );

    return {
      id: driver.id,
      firstName: driver.firstName,
      lastName: driver.lastName,
      partnerCompanyId: session.partnerCompanyId,
    };
  }

  @Get('vehicles')
  @ApiOperation({ summary: 'Get driver vehicles' })
  @ApiResponse({ status: 200, description: 'List of vehicles split by type' })
  async getVehicles(@Req() req: Request) {
    const session = this.getDriverSession(req);

    const vehicles = await this.vehicleService.findByPartnerCompany(
      session.networkId,
      session.partnerCompanyId,
    );

    // Split vehicles by type for PWA
    // Tractor types: actual trucks that pull trailers
    const tractorTypes = ['TRACTOR', 'SEMI_TRUCK', 'TRUCK_1_5T', 'TRUCK_3_5T', 'TRUCK_7_5T', 'TRUCK_12T', 'TRUCK_12T_PLUS', 'TANK_SOLO', 'TANK_12T', 'TANK_TRUCK'];
    // Trailer types: things that are pulled
    const trailerTypes = ['TRAILER_ONLY', 'TANK_SEMI_TRAILER', 'GRAIN_CARRIER', 'CONTAINER_CARRIER'];

    const tractors = vehicles
      .filter((v) => tractorTypes.includes(v.type))
      .map((v) => ({
        id: v.id,
        type: v.type,
        plateNumber: v.plateNumber,
        plateState: v.plateState,
      }));

    const trailers = vehicles
      .filter((v) => trailerTypes.includes(v.type))
      .map((v) => ({
        id: v.id,
        type: v.type,
        plateNumber: v.plateNumber,
        plateState: v.plateState,
      }));

    return { tractors, trailers };
  }

  @Get('locations')
  @ApiOperation({ summary: 'Get all available locations for the driver network' })
  @ApiResponse({ status: 200, description: 'List of locations' })
  async getLocations(@Req() req: Request) {
    const session = this.getDriverSession(req);

    const locations = await this.locationService.findAll(session.networkId);

    return locations.map((loc) => ({
      id: loc.id,
      code: loc.code,
      name: loc.name,
      city: loc.city,
      state: loc.state,
      washMode: loc.washMode,
    }));
  }

  @Get('locations/:code')
  @ApiOperation({ summary: 'Get location details by code' })
  @ApiParam({ name: 'code', description: 'Location code' })
  @ApiResponse({ status: 200, description: 'Location details' })
  async getLocationByCode(
    @Param('code') code: string,
    @Req() req: Request,
  ) {
    const session = this.getDriverSession(req);

    const location = await this.locationService.findByCode(session.networkId, code);

    return {
      id: location.id,
      code: location.code,
      name: location.name,
      city: location.city,
      state: location.state,
      washMode: location.washMode,
    };
  }

  @Get('locations/:code/services')
  @ApiOperation({ summary: 'Get available services at a location by code' })
  @ApiParam({ name: 'code', description: 'Location code from QR' })
  @ApiResponse({ status: 200, description: 'Available services' })
  async getLocationServices(
    @Param('code') code: string,
    @Req() req: Request,
  ) {
    const session = this.getDriverSession(req);

    const location = await this.locationService.findByCode(
      session.networkId,
      code,
    );

    const services = await this.servicePackageService.findAvailableAtLocation(
      session.networkId,
      location.id,
    );

    return {
      location: {
        id: location.id,
        name: location.name,
        code: location.code,
        washMode: location.washMode,
      },
      services,
    };
  }

  @Post('wash-events')
  @ApiOperation({ summary: 'Create a new wash event (QR driver mode)' })
  @ApiBody({ type: CreateWashEventPwaDto })
  @ApiResponse({ status: 201, description: 'Wash event created' })
  async createWashEvent(
    @Body() dto: CreateWashEventPwaDto,
    @Req() req: Request,
  ) {
    const session = this.getDriverSession(req);
    const metadata = this.getRequestMetadata(req);

    // Validate that either vehicle ID or manual plate is provided for tractor
    if (!dto.tractorVehicleId && !dto.tractorPlateManual) {
      throw new BadRequestException(
        'Either tractor vehicle ID or manual plate is required',
      );
    }

    // Validate that at least one service is provided (new or old way)
    const hasServices = dto.services && dto.services.length > 0;
    const hasLegacyService = !!dto.servicePackageId;
    if (!hasServices && !hasLegacyService) {
      throw new BadRequestException(
        'At least one service is required',
      );
    }

    const washEvent = await this.washEventService.createQrDriver(
      session.networkId,
      {
        entryMode: WashEntryMode.QR_DRIVER,
        locationId: dto.locationId,
        driverId: session.driverId,
        servicePackageId: dto.servicePackageId,
        services: dto.services,
        tractorVehicleId: dto.tractorVehicleId,
        tractorPlateManual: dto.tractorPlateManual,
        trailerVehicleId: dto.trailerVehicleId,
        trailerPlateManual: dto.trailerPlateManual,
      },
      {
        actorType: 'DRIVER',
        actorId: session.driverId,
        ...metadata,
      },
    );

    return washEvent;
  }

  @Get('wash-events/:id')
  @ApiOperation({ summary: 'Get wash event by ID' })
  @ApiParam({ name: 'id', description: 'Wash event ID' })
  @ApiResponse({ status: 200, description: 'Wash event details' })
  async getWashEvent(@Param('id') id: string, @Req() req: Request) {
    const session = this.getDriverSession(req);
    return this.washEventService.findById(session.networkId, id);
  }

  @Post('wash-events/:id/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start a wash event' })
  @ApiParam({ name: 'id', description: 'Wash event ID' })
  @ApiResponse({ status: 200, description: 'Wash event started' })
  async startWashEvent(@Param('id') id: string, @Req() req: Request) {
    const session = this.getDriverSession(req);
    const metadata = this.getRequestMetadata(req);

    // First authorize (auto-authorize for driver-created events)
    let washEvent = await this.washEventService.findById(session.networkId, id);

    if (washEvent.status === 'CREATED') {
      washEvent = await this.washEventService.authorize(
        session.networkId,
        id,
        {
          actorType: 'SYSTEM',
          ...metadata,
        },
      );
    }

    // Then start
    return this.washEventService.start(session.networkId, id, {
      actorType: 'DRIVER',
      actorId: session.driverId,
      ...metadata,
    });
  }

  @Post('wash-events/:id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete a wash event' })
  @ApiParam({ name: 'id', description: 'Wash event ID' })
  @ApiResponse({ status: 200, description: 'Wash event completed' })
  async completeWashEvent(@Param('id') id: string, @Req() req: Request) {
    const session = this.getDriverSession(req);
    const metadata = this.getRequestMetadata(req);

    return this.washEventService.complete(session.networkId, id, {
      actorType: 'DRIVER',
      actorId: session.driverId,
      ...metadata,
    });
  }

  @Get('wash-events')
  @ApiOperation({ summary: 'Get driver wash history' })
  @ApiResponse({ status: 200, description: 'List of wash events' })
  async getWashEvents(@Req() req: Request) {
    const session = this.getDriverSession(req);

    return this.washEventService.findByDriver(
      session.networkId,
      session.driverId,
      { limit: 50 },
    );
  }
}
