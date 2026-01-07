import {
  Controller,
  Post,
  Get,
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
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
  ApiHeader,
  ApiQuery,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { DriverService } from '../modules/driver/driver.service';
import { WashEventService } from '../modules/wash-event/wash-event.service';
import { VehicleService } from '../modules/vehicle/vehicle.service';
import { ServicePackageService } from '../modules/service-package/service-package.service';
import { LocationService } from '../modules/location/location.service';
import { PartnerCompanyService } from '../modules/partner-company/partner-company.service';
import { NotificationService } from '../modules/notification/notification.service';
import { NetworkService } from '../modules/network/network.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { WashEntryMode, DriverApprovalStatus, VerificationType } from '@prisma/client';
import { ActivateDto, ActivateByPhoneDto, ActivateResponseDto } from './dto/activate.dto';
import { CreateWashEventPwaDto } from './dto/create-wash-event.dto';
import {
  SelfRegisterDto,
  SelfRegisterResponseDto,
  CheckApprovalDto,
  CheckApprovalResponseDto,
} from './dto/register.dto';
import { CreateVehicleDto } from './dto/vehicle.dto';
import {
  VerifyTokenDto,
  ResendVerificationDto,
  ChangePartnerDto,
  VerificationResponseDto,
  VerificationTypeDto,
} from './dto/verification.dto';
import { ConfigService } from '@nestjs/config';

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
    private readonly notificationService: NotificationService,
    private readonly networkService: NetworkService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
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

    // Verify at least email or phone is provided
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('Email vagy telefonszám megadása kötelező');
    }

    // Verify partner company exists
    const partnerCompany = await this.partnerCompanyService.findById(nid, dto.partnerCompanyId);

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
          category: vehicle.category || 'SOLO',
          plateNumber: vehicle.plateNumber,
          plateState: vehicle.plateState,
        });
      }
    }

    // Send verification email/SMS
    let verificationRequired: 'EMAIL' | 'PHONE' | 'BOTH' = 'EMAIL';
    const verificationMessages: string[] = [];

    if (dto.email) {
      const emailResult = await this.notificationService.sendEmailVerification(
        nid,
        driver.id,
        dto.email,
        driver.firstName,
      );
      if (emailResult.success) {
        verificationMessages.push('Megerősítő linket küldtünk az email címedre.');
      }
    }

    if (dto.phone) {
      const smsResult = await this.notificationService.sendPhoneVerification(
        nid,
        driver.id,
        dto.phone,
        driver.firstName,
      );
      if (smsResult.success) {
        verificationMessages.push('Megerősítő kódot küldtünk SMS-ben.');
      }
      verificationRequired = dto.email ? 'BOTH' : 'PHONE';
    }

    // Notify partner company and admin about new registration
    await this.notificationService.notifyNewRegistration(
      {
        id: driver.id,
        firstName: driver.firstName,
        lastName: driver.lastName,
        phone: driver.phone,
        email: driver.email,
      },
      {
        name: partnerCompany.name,
        email: partnerCompany.email,
        contactName: partnerCompany.contactName,
      },
    );

    const baseMessage = 'Regisztráció sikeres! ';
    const verificationMessage = verificationMessages.length > 0
      ? verificationMessages.join(' ') + ' '
      : '';
    const approvalMessage = 'A fiókod jóváhagyásra vár. Értesítést kapsz, ha aktiválásra került.';

    return {
      driverId: driver.id,
      firstName: driver.firstName,
      lastName: driver.lastName,
      approvalStatus: driver.approvalStatus,
      verificationRequired,
      message: baseMessage + verificationMessage + approvalMessage,
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

  @Post('login-phone')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with phone number and PIN' })
  @ApiBody({ type: ActivateByPhoneDto })
  @ApiResponse({
    status: 200,
    description: 'Driver logged in successfully',
    type: ActivateResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid phone or PIN' })
  @ApiResponse({ status: 404, description: 'Driver not found' })
  async loginByPhone(
    @Body() dto: ActivateByPhoneDto,
    @Req() req: Request,
  ): Promise<ActivateResponseDto & { sessionId: string }> {
    const driver = await this.driverService.activateByPhone(
      dto.phone,
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
  @ApiOperation({ summary: 'Get driver vehicles grouped by category' })
  @ApiResponse({ status: 200, description: 'List of vehicles split by category (solo, tractors, trailers)' })
  async getVehicles(@Req() req: Request) {
    const session = this.getDriverSession(req);

    // Get vehicles created by this driver
    const vehicles = await this.vehicleService.findByDriver(
      session.networkId,
      session.driverId,
    );

    // Group vehicles by category
    const solos = vehicles
      .filter((v) => v.category === 'SOLO')
      .map((v) => ({
        id: v.id,
        category: v.category,
        plateNumber: v.plateNumber,
        nickname: v.nickname,
      }));

    const tractors = vehicles
      .filter((v) => v.category === 'TRACTOR')
      .map((v) => ({
        id: v.id,
        category: v.category,
        plateNumber: v.plateNumber,
        nickname: v.nickname,
      }));

    const trailers = vehicles
      .filter((v) => v.category === 'TRAILER')
      .map((v) => ({
        id: v.id,
        category: v.category,
        plateNumber: v.plateNumber,
        nickname: v.nickname,
      }));

    return { solos, tractors, trailers };
  }

  @Post('vehicles')
  @ApiOperation({ summary: 'Add a new vehicle for the driver' })
  @ApiBody({ type: CreateVehicleDto })
  @ApiResponse({ status: 201, description: 'Vehicle created successfully' })
  @ApiResponse({ status: 409, description: 'Plate number already exists' })
  async createVehicle(
    @Body() dto: CreateVehicleDto,
    @Req() req: Request,
  ) {
    const session = this.getDriverSession(req);

    try {
      const vehicle = await this.vehicleService.createOrUpdateByDriver(
        session.networkId,
        session.driverId,
        session.partnerCompanyId,
        {
          category: dto.category,
          plateNumber: dto.plateNumber,
          nickname: dto.nickname,
        },
      );

      return {
        id: vehicle.id,
        category: vehicle.category,
        plateNumber: vehicle.plateNumber,
        nickname: vehicle.nickname,
      };
    } catch (error) {
      if (error.message?.includes('már máshoz tartozik')) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }

  @Delete('vehicles/:id')
  @ApiOperation({ summary: 'Delete a vehicle' })
  @ApiParam({ name: 'id', description: 'Vehicle ID' })
  @ApiResponse({ status: 200, description: 'Vehicle deleted successfully' })
  @HttpCode(HttpStatus.OK)
  async deleteVehicle(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const session = this.getDriverSession(req);

    // Verify the vehicle belongs to this driver
    const vehicle = await this.vehicleService.findById(session.networkId, id);

    if (!vehicle || vehicle.driverId !== session.driverId) {
      throw new BadRequestException('Jarmu nem talalhato vagy nem a tied');
    }

    await this.vehicleService.softDelete(session.networkId, id);

    return { success: true, message: 'Jarmu torolve' };
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

  // =========================================================================
  // VERIFICATION ENDPOINTS
  // =========================================================================

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email or phone with token/code' })
  @ApiBody({ type: VerifyTokenDto })
  @ApiResponse({
    status: 200,
    description: 'Verification result',
    type: VerificationResponseDto,
  })
  async verify(
    @Body() dto: VerifyTokenDto,
  ): Promise<VerificationResponseDto> {
    const type = dto.type === VerificationTypeDto.EMAIL
      ? VerificationType.EMAIL
      : VerificationType.PHONE;

    const result = await this.notificationService.verifyToken(dto.token, type);

    if (!result.valid) {
      throw new BadRequestException(result.message || 'Érvénytelen kód');
    }

    return {
      success: true,
      message: type === VerificationType.EMAIL
        ? 'Email sikeresen megerősítve!'
        : 'Telefonszám sikeresen megerősítve!',
    };
  }

  @Get('verify-email')
  @ApiOperation({ summary: 'Verify email via link click (redirects to frontend)' })
  @ApiQuery({ name: 'token', description: 'Email verification token' })
  @ApiResponse({ status: 302, description: 'Redirects to login page' })
  async verifyEmailLink(
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3001';

    const result = await this.notificationService.verifyToken(token, VerificationType.EMAIL);

    if (result.valid) {
      return res.redirect(`${frontendUrl}/login?verified=true`);
    } else {
      return res.redirect(`${frontendUrl}/login?verified=false&error=${encodeURIComponent(result.message || 'Érvénytelen link')}`);
    }
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend verification email or SMS' })
  @ApiHeader({
    name: 'x-network-id',
    required: false,
    description: 'Network ID (uses default if not provided)',
  })
  @ApiBody({ type: ResendVerificationDto })
  @ApiResponse({
    status: 200,
    description: 'Verification resent',
    type: VerificationResponseDto,
  })
  async resendVerification(
    @Body() dto: ResendVerificationDto,
    @Headers('x-network-id') networkId?: string,
  ): Promise<VerificationResponseDto> {
    const nid = networkId || DEFAULT_NETWORK_ID;

    // Verify PIN first
    const isValid = await this.driverService.validateDriverPin(nid, dto.driverId, dto.pin);
    if (!isValid) {
      throw new UnauthorizedException('Hibás PIN kód');
    }

    // Get driver info
    const driver = await this.driverService.findById(nid, dto.driverId);

    if (dto.type === VerificationTypeDto.EMAIL) {
      if (!driver.email) {
        throw new BadRequestException('Nincs email cím megadva');
      }

      const result = await this.notificationService.sendEmailVerification(
        nid,
        driver.id,
        driver.email,
        driver.firstName,
      );

      return {
        success: result.success,
        message: result.success
          ? 'Megerősítő link újraküldve az email címedre!'
          : 'Hiba történt az email küldése közben',
      };
    } else {
      if (!driver.phone) {
        throw new BadRequestException('Nincs telefonszám megadva');
      }

      const result = await this.notificationService.sendPhoneVerification(
        nid,
        driver.id,
        driver.phone,
        driver.firstName,
      );

      return {
        success: result.success,
        message: result.success
          ? 'Megerősítő kód újraküldve SMS-ben!'
          : 'Hiba történt az SMS küldése közben',
      };
    }
  }

  @Post('change-partner')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change partner company for logged in driver' })
  @ApiHeader({
    name: 'x-driver-session',
    required: true,
    description: 'Driver session ID',
  })
  @ApiBody({ type: ChangePartnerDto })
  @ApiResponse({
    status: 200,
    description: 'Partner company changed',
    type: VerificationResponseDto,
  })
  async changePartner(
    @Body() dto: ChangePartnerDto,
    @Req() req: Request,
  ): Promise<VerificationResponseDto> {
    const session = this.getDriverSession(req);

    // Verify new partner company exists
    const newPartnerCompany = await this.partnerCompanyService.findById(
      session.networkId,
      dto.newPartnerCompanyId,
    );

    // Get current driver with partner company
    const driver = await this.prisma.driver.findUnique({
      where: { id: session.driverId },
      include: { partnerCompany: true },
    });

    if (!driver) {
      throw new NotFoundException('Sofőr nem található');
    }

    const oldPartnerCompany = driver.partnerCompany;

    // Log the partner change history
    await this.prisma.driverPartnerHistory.create({
      data: {
        networkId: session.networkId,
        driverId: driver.id,
        fromCompanyId: oldPartnerCompany.id,
        toCompanyId: newPartnerCompany.id,
        reason: dto.reason,
      },
    });

    // Update driver's partner company
    await this.prisma.driver.update({
      where: { id: driver.id },
      data: { partnerCompanyId: newPartnerCompany.id },
    });

    // Update session
    driverSessions.set(req.get('x-driver-session')!, {
      ...session,
      partnerCompanyId: newPartnerCompany.id,
    });

    // Notify both companies
    await this.notificationService.notifyPartnerChange(
      { firstName: driver.firstName, lastName: driver.lastName },
      {
        name: oldPartnerCompany.name,
        email: oldPartnerCompany.email,
        contactName: oldPartnerCompany.contactName,
      },
      {
        name: newPartnerCompany.name,
        email: newPartnerCompany.email,
        contactName: newPartnerCompany.contactName,
      },
    );

    return {
      success: true,
      message: `Partner cég sikeresen módosítva: ${newPartnerCompany.name}`,
    };
  }

  // =========================================================================
  // QR CODE REGISTRATION ENDPOINTS
  // =========================================================================

  @Get('register-info/:networkSlug/:partnerCode')
  @ApiOperation({ summary: 'Get registration info from QR code parameters' })
  @ApiParam({ name: 'networkSlug', description: 'Network slug from QR code' })
  @ApiParam({ name: 'partnerCode', description: 'Partner company code from QR code' })
  @ApiResponse({
    status: 200,
    description: 'Registration context info',
  })
  @ApiResponse({ status: 404, description: 'Network or partner not found' })
  async getRegistrationInfo(
    @Param('networkSlug') networkSlug: string,
    @Param('partnerCode') partnerCode: string,
  ) {
    // Find network by slug
    const network = await this.networkService.findBySlug(networkSlug);

    if (!network.isActive) {
      throw new BadRequestException('Ez a hálózat jelenleg nem aktív');
    }

    // Find partner company by code within the network
    const partnerCompany = await this.partnerCompanyService.findByCode(
      network.id,
      partnerCode.toUpperCase(),
    );

    if (!partnerCompany.isActive) {
      throw new BadRequestException('Ez a partner cég jelenleg nem aktív');
    }

    return {
      networkId: network.id,
      networkName: network.name,
      networkSlug: network.slug,
      partnerCompanyId: partnerCompany.id,
      partnerCompanyCode: partnerCompany.code,
      partnerCompanyName: partnerCompany.name,
    };
  }

  @Post('register-qr')
  @ApiOperation({ summary: 'Self-register as a new driver from QR code' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['networkSlug', 'partnerCode', 'firstName', 'lastName', 'pin'],
      properties: {
        networkSlug: { type: 'string', description: 'Network slug from QR code' },
        partnerCode: { type: 'string', description: 'Partner company code from QR code' },
        firstName: { type: 'string', description: 'Driver first name' },
        lastName: { type: 'string', description: 'Driver last name' },
        phone: { type: 'string', description: 'Phone number (optional)' },
        email: { type: 'string', description: 'Email address (optional)' },
        pin: { type: 'string', description: '4-digit PIN code' },
        vehicles: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              category: { type: 'string', enum: ['SOLO', 'TRACTOR', 'TRAILER'] },
              plateNumber: { type: 'string' },
              plateState: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Driver registered, pending approval',
    type: SelfRegisterResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid registration data' })
  @ApiResponse({ status: 404, description: 'Network or partner not found' })
  async selfRegisterFromQr(
    @Body() dto: {
      networkSlug: string;
      partnerCode: string;
      firstName: string;
      lastName: string;
      phone?: string;
      email?: string;
      pin: string;
      vehicles?: Array<{
        category?: 'SOLO' | 'TRACTOR' | 'TRAILER';
        plateNumber: string;
        plateState?: string;
      }>;
    },
  ): Promise<SelfRegisterResponseDto> {
    // Find network by slug
    const network = await this.networkService.findBySlug(dto.networkSlug);

    if (!network.isActive) {
      throw new BadRequestException('Ez a hálózat jelenleg nem aktív');
    }

    // Find partner company by code within the network
    const partnerCompany = await this.partnerCompanyService.findByCode(
      network.id,
      dto.partnerCode.toUpperCase(),
    );

    if (!partnerCompany.isActive) {
      throw new BadRequestException('Ez a partner cég jelenleg nem aktív');
    }

    // Verify at least email or phone is provided
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('Email vagy telefonszám megadása kötelező');
    }

    // Validate PIN
    if (!/^\d{4}$/.test(dto.pin)) {
      throw new BadRequestException('A PIN kódnak pontosan 4 számjegyből kell állnia');
    }

    // Create driver with pending status
    const driver = await this.driverService.selfRegister(network.id, {
      partnerCompanyId: partnerCompany.id,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      email: dto.email,
      pin: dto.pin,
    });

    // Create vehicles if provided
    if (dto.vehicles && dto.vehicles.length > 0) {
      for (const vehicle of dto.vehicles) {
        await this.vehicleService.create(network.id, {
          partnerCompanyId: partnerCompany.id,
          driverId: driver.id,
          category: vehicle.category || 'SOLO',
          plateNumber: vehicle.plateNumber,
          plateState: vehicle.plateState,
        });
      }
    }

    // Send verification email/SMS
    let verificationRequired: 'EMAIL' | 'PHONE' | 'BOTH' = 'EMAIL';
    const verificationMessages: string[] = [];

    if (dto.email) {
      const emailResult = await this.notificationService.sendEmailVerification(
        network.id,
        driver.id,
        dto.email,
        driver.firstName,
      );
      if (emailResult.success) {
        verificationMessages.push('Megerősítő linket küldtünk az email címedre.');
      }
    }

    if (dto.phone) {
      const smsResult = await this.notificationService.sendPhoneVerification(
        network.id,
        driver.id,
        dto.phone,
        driver.firstName,
      );
      if (smsResult.success) {
        verificationMessages.push('Megerősítő kódot küldtünk SMS-ben.');
      }
      verificationRequired = dto.email ? 'BOTH' : 'PHONE';
    }

    // Notify partner company and admin about new registration
    await this.notificationService.notifyNewRegistration(
      {
        id: driver.id,
        firstName: driver.firstName,
        lastName: driver.lastName,
        phone: driver.phone,
        email: driver.email,
      },
      {
        name: partnerCompany.name,
        email: partnerCompany.email,
        contactName: partnerCompany.contactName,
      },
    );

    const baseMessage = 'Regisztráció sikeres! ';
    const verificationMessage = verificationMessages.length > 0
      ? verificationMessages.join(' ') + ' '
      : '';
    const approvalMessage = 'A fiókod jóváhagyásra vár. Értesítést kapsz, ha aktiválásra került.';

    return {
      driverId: driver.id,
      firstName: driver.firstName,
      lastName: driver.lastName,
      approvalStatus: driver.approvalStatus,
      verificationRequired,
      message: baseMessage + verificationMessage + approvalMessage,
    };
  }

  @Post('check-approval-qr')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check driver approval status (QR registration)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['networkSlug', 'driverId', 'pin'],
      properties: {
        networkSlug: { type: 'string', description: 'Network slug' },
        driverId: { type: 'string', description: 'Driver ID from registration' },
        pin: { type: 'string', description: '4-digit PIN code' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Approval status',
    type: CheckApprovalResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid PIN' })
  async checkApprovalFromQr(
    @Body() dto: { networkSlug: string; driverId: string; pin: string },
  ): Promise<CheckApprovalResponseDto> {
    // Find network by slug
    const network = await this.networkService.findBySlug(dto.networkSlug);

    // Verify PIN first
    const isValid = await this.driverService.validateDriverPin(
      network.id,
      dto.driverId,
      dto.pin,
    );

    if (!isValid) {
      throw new UnauthorizedException('Hibás PIN kód');
    }

    const { status, rejectionReason } = await this.driverService.checkApprovalStatus(
      network.id,
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
}
