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
import { LoginThrottle, SensitiveThrottle } from '../common/throttler/login-throttle.decorator';
import { Logger } from '@nestjs/common';
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
import { SessionService, DriverSessionData } from '../common/session/session.service';
import { setSessionCookie, clearSessionCookie, getSessionId, SESSION_COOKIES } from '../common/session/cookie.helper';
import { AuditLogService } from '../modules/audit-log/audit-log.service';
import { BookingService } from '../modules/booking/booking.service';
import { CreateBookingDto, CancelBookingDto } from '../modules/booking/dto/booking.dto';
import { WashEntryMode, DriverApprovalStatus, VerificationType, SessionType, AuditAction } from '@prisma/client';
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

// Default network ID for self-registration
// In production, this would come from QR code or subdomain
const DEFAULT_NETWORK_ID = 'cf808392-6283-4487-9fbd-e72951ca5bf8';

@ApiTags('pwa')
@Controller('pwa')
export class PwaController {
  private readonly logger = new Logger(PwaController.name);

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
    private readonly sessionService: SessionService,
    private readonly auditLogService: AuditLogService,
    private readonly bookingService: BookingService,
  ) {}

  private getRequestMetadata(req: Request) {
    return {
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.get('user-agent'),
    };
  }

  private async getDriverSession(req: Request): Promise<DriverSessionData> {
    // SECURITY: Try cookie first (httpOnly), then fall back to header
    const sessionId = getSessionId(req, SESSION_COOKIES.DRIVER, 'x-driver-session');
    if (!sessionId) {
      throw new BadRequestException('Driver session required');
    }

    const session = await this.sessionService.getSession<DriverSessionData>(
      sessionId,
      SessionType.DRIVER,
    );
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

    // Notify driver, partner company and network admin about new registration
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
      nid, // networkId
    );

    const baseMessage = 'Regisztráció sikeres! ';
    const verificationMessage = verificationMessages.length > 0
      ? verificationMessages.join(' ') + ' '
      : '';
    // Driver is auto-approved, show the invite code
    const approvalMessage = 'A fiókod aktiválva lett. Használd a meghívó kódodat a bejelentkezéshez, vagy jelentkezz be telefonszámmal és PIN kóddal.';

    return {
      driverId: driver.id,
      firstName: driver.firstName,
      lastName: driver.lastName,
      approvalStatus: driver.approvalStatus,
      inviteCode: driver.invite?.inviteCode,
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
  @LoginThrottle() // SECURITY: Brute force protection - 5 attempts per minute
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
    @Res({ passthrough: true }) res: Response,
  ): Promise<ActivateResponseDto & { sessionId: string }> {
    const { ipAddress, userAgent } = this.getRequestMetadata(req);

    try {
      const driver = await this.driverService.activateByInviteCode(
        dto.inviteCode.toUpperCase(),
        dto.pin,
      );

      // Create session and store in database
      const sessionData: DriverSessionData = {
        driverId: driver.id,
        networkId: driver.partnerCompany.networkId,
        partnerCompanyId: driver.partnerCompany.id,
      };

      const sessionId = await this.sessionService.createSession(
        SessionType.DRIVER,
        sessionData,
        {
          networkId: driver.partnerCompany.networkId,
          userId: driver.id,
        },
      );

      // SECURITY: Set httpOnly cookie for session (XSS protection)
      setSessionCookie(res, SESSION_COOKIES.DRIVER, sessionId);

      // AUDIT: Log successful login
      await this.auditLogService.log({
        networkId: driver.partnerCompany.networkId,
        action: AuditAction.LOGIN_SUCCESS,
        actorType: 'DRIVER',
        actorId: driver.id,
        metadata: { method: 'invite_code', inviteCode: dto.inviteCode.toUpperCase() },
        ipAddress,
        userAgent,
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
    } catch (error) {
      // AUDIT: Log failed login attempt
      await this.auditLogService.log({
        action: AuditAction.LOGIN_FAILED,
        actorType: 'DRIVER',
        metadata: { method: 'invite_code', inviteCode: dto.inviteCode.toUpperCase(), error: error.message },
        ipAddress,
        userAgent,
      });
      throw error;
    }
  }

  @Post('login-phone')
  @LoginThrottle() // SECURITY: Brute force protection - 5 attempts per minute
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
    @Res({ passthrough: true }) res: Response,
  ): Promise<ActivateResponseDto & { sessionId: string }> {
    const { ipAddress, userAgent } = this.getRequestMetadata(req);
    // Mask phone number for audit log (show last 4 digits only)
    const maskedPhone = dto.phone.slice(-4).padStart(dto.phone.length, '*');

    try {
      const driver = await this.driverService.activateByPhone(
        dto.phone,
        dto.pin,
      );

      // Create session and store in database
      const sessionData: DriverSessionData = {
        driverId: driver.id,
        networkId: driver.partnerCompany.networkId,
        partnerCompanyId: driver.partnerCompany.id,
      };

      const sessionId = await this.sessionService.createSession(
        SessionType.DRIVER,
        sessionData,
        {
          networkId: driver.partnerCompany.networkId,
          userId: driver.id,
        },
      );

      // SECURITY: Set httpOnly cookie for session (XSS protection)
      setSessionCookie(res, SESSION_COOKIES.DRIVER, sessionId);

      // AUDIT: Log successful login
      await this.auditLogService.log({
        networkId: driver.partnerCompany.networkId,
        action: AuditAction.LOGIN_SUCCESS,
        actorType: 'DRIVER',
        actorId: driver.id,
        metadata: { method: 'phone', phone: maskedPhone },
        ipAddress,
        userAgent,
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
    } catch (error) {
      // AUDIT: Log failed login attempt
      await this.auditLogService.log({
        action: AuditAction.LOGIN_FAILED,
        actorType: 'DRIVER',
        metadata: { method: 'phone', phone: maskedPhone, error: error.message },
        ipAddress,
        userAgent,
      });
      throw error;
    }
  }

  // =========================================================================
  // PIN RESET REQUEST ENDPOINT
  // =========================================================================

  @Post('request-pin-reset')
  @SensitiveThrottle()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request PIN reset - creates a request for Partner/Platform Admin' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['phone'],
      properties: {
        phone: { type: 'string', description: 'Phone number associated with the driver account' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Request submitted (same response regardless of phone existence)' })
  async requestPinReset(
    @Body() body: { phone: string },
    @Req() req: Request,
  ) {
    const { ipAddress, userAgent } = this.getRequestMetadata(req);

    if (!body.phone) {
      throw new BadRequestException('Telefonszám megadása kötelező');
    }

    // Normalize phone number
    const phone = body.phone.replace(/\s+/g, '');

    // Find driver by phone (across all networks)
    const driver = await this.prisma.driver.findFirst({
      where: {
        phone,
        isActive: true,
        deletedAt: null,
      },
      include: {
        partnerCompany: {
          select: {
            id: true,
            name: true,
            networkId: true,
          },
        },
      },
    });

    // Always return success message for security (don't reveal if phone exists)
    const successMessage = 'Ha a telefonszám regisztrálva van, a PIN visszaállítási kérelmet továbbítottuk az adminisztrátornak.';

    if (!driver) {
      this.logger.warn(`PIN reset request for unknown phone: ${phone.slice(-4).padStart(phone.length, '*')}`);
      return { message: successMessage };
    }

    // Check if there's already a pending request
    const existingRequest = await this.prisma.driverPinResetRequest.findFirst({
      where: {
        driverId: driver.id,
        status: 'PENDING',
      },
    });

    if (existingRequest) {
      return { message: successMessage };
    }

    // Create PIN reset request
    // If driver has a partner company, send to Partner Admin
    // If not, send to Platform Admin (partnerCompanyId will be null)
    await this.prisma.driverPinResetRequest.create({
      data: {
        networkId: driver.partnerCompany.networkId,
        driverId: driver.id,
        partnerCompanyId: driver.partnerCompany.id,
        status: 'PENDING',
      },
    });

    // Audit log
    await this.auditLogService.log({
      networkId: driver.partnerCompany.networkId,
      action: AuditAction.UPDATE,
      actorType: 'DRIVER',
      actorId: driver.id,
      metadata: {
        type: 'PIN_RESET_REQUESTED',
        phone: phone.slice(-4).padStart(phone.length, '*'),
        driverName: `${driver.firstName} ${driver.lastName}`,
        partnerCompanyName: driver.partnerCompany.name,
      },
      ipAddress,
      userAgent,
    });

    this.logger.log(`PIN reset request created for driver ${driver.id} (${driver.firstName} ${driver.lastName})`);

    return { message: successMessage };
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current driver profile' })
  @ApiResponse({ status: 200, description: 'Driver profile' })
  @ApiResponse({ status: 400, description: 'Session required' })
  async getMe(@Req() req: Request) {
    const session = await this.getDriverSession(req);
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
    const session = await this.getDriverSession(req);

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
    const session = await this.getDriverSession(req);

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
    const session = await this.getDriverSession(req);

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
    const session = await this.getDriverSession(req);

    const locations = await this.locationService.findAll(session.networkId);

    return locations.map((loc) => ({
      id: loc.id,
      code: loc.code,
      name: loc.name,
      city: loc.city,
      state: loc.state,
      washMode: loc.washMode,
      locationType: loc.locationType || 'TRUCK_WASH',
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
    const session = await this.getDriverSession(req);

    const location = await this.locationService.findByCode(session.networkId, code);

    return {
      id: location.id,
      code: location.code,
      name: location.name,
      city: location.city,
      state: location.state,
      washMode: location.washMode,
      locationType: location.locationType || 'TRUCK_WASH',
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
    const session = await this.getDriverSession(req);

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
    const session = await this.getDriverSession(req);
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
    const session = await this.getDriverSession(req);
    return this.washEventService.findById(session.networkId, id);
  }

  @Post('wash-events/:id/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start a wash event' })
  @ApiParam({ name: 'id', description: 'Wash event ID' })
  @ApiResponse({ status: 200, description: 'Wash event started' })
  async startWashEvent(@Param('id') id: string, @Req() req: Request) {
    const session = await this.getDriverSession(req);
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
    const session = await this.getDriverSession(req);
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
    const session = await this.getDriverSession(req);

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

    try {
      const result = await this.notificationService.verifyToken(token, VerificationType.EMAIL);

      if (result.valid) {
        return res.redirect(`${frontendUrl}/login?verified=true`);
      } else {
        return res.redirect(`${frontendUrl}/login?verified=false&error=${encodeURIComponent(result.message || 'Érvénytelen link')}`);
      }
    } catch (error) {
      console.error(`Email verification error: ${error.message}`);
      return res.redirect(`${frontendUrl}/login?verified=false&error=${encodeURIComponent('Hiba történt a megerősítés során')}`);
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
    const session = await this.getDriverSession(req);

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

    // Update session in database
    const sessionId = req.get('x-driver-session')!;
    await this.sessionService.updateSession<DriverSessionData>(sessionId, {
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

    // Notify driver, partner company and network admin about new registration
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
      network.id, // networkId (from QR code location)
    );

    const baseMessage = 'Regisztráció sikeres! ';
    const verificationMessage = verificationMessages.length > 0
      ? verificationMessages.join(' ') + ' '
      : '';
    // Driver is auto-approved, show the invite code
    const approvalMessage = 'A fiókod aktiválva lett. Használd a meghívó kódodat a bejelentkezéshez, vagy jelentkezz be telefonszámmal és PIN kóddal.';

    return {
      driverId: driver.id,
      firstName: driver.firstName,
      lastName: driver.lastName,
      approvalStatus: driver.approvalStatus,
      inviteCode: driver.invite?.inviteCode,
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

  // =========================================================================
  // BOOKING ENDPOINTS (Driver)
  // =========================================================================

  @Get('bookings/locations')
  @ApiOperation({ summary: 'Get locations with booking enabled' })
  @ApiHeader({
    name: 'x-driver-session',
    required: true,
    description: 'Driver session ID',
  })
  @ApiResponse({
    status: 200,
    description: 'List of locations with booking enabled',
  })
  async getBookingLocations(
    @Req() req: Request,
  ) {
    const session = await this.getDriverSession(req);

    const locations = await this.prisma.location.findMany({
      where: {
        networkId: session.networkId,
        bookingEnabled: true,
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        code: true,
        city: true,
        address: true,
        slotIntervalMinutes: true,
        minBookingNoticeHours: true,
        maxBookingAdvanceDays: true,
      },
      orderBy: { name: 'asc' },
    });

    return locations;
  }

  @Get('bookings/slots')
  @ApiOperation({ summary: 'Get available booking slots for a date' })
  @ApiHeader({
    name: 'x-driver-session',
    required: true,
    description: 'Driver session ID',
  })
  @ApiQuery({ name: 'locationId', description: 'Location ID' })
  @ApiQuery({ name: 'date', description: 'Date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'servicePackageId', required: false })
  @ApiQuery({ name: 'vehicleType', required: false })
  @ApiResponse({
    status: 200,
    description: 'Available time slots',
  })
  async getAvailableSlots(
    @Query('locationId') locationId: string,
    @Query('date') date: string,
    @Query('servicePackageId') servicePackageId?: string,
    @Query('vehicleType') vehicleType?: string,
    @Req() req?: Request,
  ) {
    const session = await this.getDriverSession(req!);

    // Get available slots
    const slots = await this.bookingService.getAvailableSlots(session.networkId, {
      locationId,
      date,
      servicePackageId,
      vehicleType: vehicleType as any,
    });

    // Get available services for the vehicle type
    let services: any[] = [];
    if (vehicleType) {
      const servicePrices = await this.prisma.servicePrice.findMany({
        where: {
          networkId: session.networkId,
          vehicleType: vehicleType as any,
          isActive: true,
        },
        include: {
          servicePackage: { select: { id: true, name: true, code: true } },
        },
        orderBy: { price: 'asc' },
      });

      services = servicePrices.map((sp) => ({
        id: sp.servicePackage.id,  // servicePackageId - this is what backend expects
        name: sp.servicePackage.name,
        code: sp.servicePackage.code,
        durationMinutes: sp.durationMinutes,
        price: sp.price,
        currency: sp.currency,
      }));
    }

    return { slots, services };
  }

  @Get('bookings')
  @ApiOperation({ summary: 'Get driver bookings' })
  @ApiHeader({
    name: 'x-driver-session',
    required: true,
    description: 'Driver session ID',
  })
  @ApiQuery({ name: 'status', required: false })
  @ApiResponse({
    status: 200,
    description: 'List of driver bookings',
  })
  async getDriverBookings(
    @Query('status') status?: string,
    @Req() req?: Request,
  ) {
    const session = await this.getDriverSession(req!);

    const bookings = await this.prisma.booking.findMany({
      where: {
        networkId: session.networkId,
        driverId: session.driverId,
        ...(status ? { status: status as any } : {}),
      },
      include: {
        location: { select: { id: true, name: true, code: true, city: true } },
        servicePackage: { select: { id: true, name: true, code: true } },
      },
      orderBy: { scheduledStart: 'desc' },
      take: 50,
    });

    return bookings;
  }

  @Get('bookings/:id')
  @ApiOperation({ summary: 'Get booking details' })
  @ApiHeader({
    name: 'x-driver-session',
    required: true,
    description: 'Driver session ID',
  })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiResponse({
    status: 200,
    description: 'Booking details',
  })
  async getBookingDetails(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const session = await this.getDriverSession(req);

    const booking = await this.bookingService.getBooking(session.networkId, id);

    // Verify the booking belongs to this driver
    if (booking.driverId !== session.driverId) {
      throw new UnauthorizedException('Nincs jogosultságod ehhez a foglaláshoz');
    }

    return booking;
  }

  @Post('bookings')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new booking' })
  @ApiHeader({
    name: 'x-driver-session',
    required: true,
    description: 'Driver session ID',
  })
  @ApiBody({ type: CreateBookingDto })
  @ApiResponse({
    status: 201,
    description: 'Booking created',
  })
  async createBooking(
    @Body() dto: CreateBookingDto,
    @Req() req: Request,
  ) {
    const session = await this.getDriverSession(req);

    // Get driver details for customer info
    const driver = await this.prisma.driver.findUnique({
      where: { id: session.driverId },
      select: { firstName: true, lastName: true, phone: true, email: true },
    });

    const bookingDto: CreateBookingDto = {
      ...dto,
      driverId: session.driverId,
      customerName: dto.customerName || `${driver?.firstName} ${driver?.lastName}`,
      customerPhone: dto.customerPhone || driver?.phone || undefined,
      customerEmail: dto.customerEmail || driver?.email || undefined,
    };

    return this.bookingService.createBooking(
      session.networkId,
      bookingDto,
      { type: 'DRIVER', id: session.driverId },
    );
  }

  @Post('bookings/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a booking' })
  @ApiHeader({
    name: 'x-driver-session',
    required: true,
    description: 'Driver session ID',
  })
  @ApiParam({ name: 'id', description: 'Booking ID' })
  @ApiBody({ type: CancelBookingDto })
  @ApiResponse({
    status: 200,
    description: 'Booking cancelled',
  })
  async cancelBooking(
    @Param('id') id: string,
    @Body() dto: CancelBookingDto,
    @Req() req: Request,
  ) {
    const session = await this.getDriverSession(req);

    // Verify the booking belongs to this driver
    const booking = await this.bookingService.getBooking(session.networkId, id);
    if (booking.driverId !== session.driverId) {
      throw new UnauthorizedException('Nincs jogosultságod ehhez a foglaláshoz');
    }

    return this.bookingService.cancelBooking(
      session.networkId,
      id,
      dto,
      `driver:${session.driverId}`,
    );
  }

  // =========================================================================
  // PUBLIC BOOKING ENDPOINT (by booking code)
  // =========================================================================

  @Get('booking/:code')
  @ApiOperation({ summary: 'Get booking by code (public)' })
  @ApiParam({ name: 'code', description: 'Booking code' })
  @ApiResponse({
    status: 200,
    description: 'Booking details',
  })
  async getBookingByCode(
    @Param('code') code: string,
  ) {
    return this.bookingService.getBookingByCode(code);
  }
}
