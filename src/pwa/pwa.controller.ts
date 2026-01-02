import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Req,
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
} from '@nestjs/swagger';
import { Request } from 'express';
import { DriverService } from '../modules/driver/driver.service';
import { WashEventService } from '../modules/wash-event/wash-event.service';
import { VehicleService } from '../modules/vehicle/vehicle.service';
import { ServicePackageService } from '../modules/service-package/service-package.service';
import { LocationService } from '../modules/location/location.service';
import { WashEntryMode } from '@prisma/client';
import { ActivateDto, ActivateResponseDto } from './dto/activate.dto';
import { CreateWashEventPwaDto } from './dto/create-wash-event.dto';

// Simple in-memory session store for activated drivers
// In production, this would be JWT tokens or Redis sessions
const driverSessions = new Map<
  string,
  { driverId: string; networkId: string; partnerCompanyId: string }
>();

@ApiTags('pwa')
@Controller('pwa')
export class PwaController {
  constructor(
    private readonly driverService: DriverService,
    private readonly washEventService: WashEventService,
    private readonly vehicleService: VehicleService,
    private readonly servicePackageService: ServicePackageService,
    private readonly locationService: LocationService,
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
  @ApiOperation({ summary: 'Get driver vehicles (tractors and trailers)' })
  @ApiResponse({ status: 200, description: 'List of vehicles' })
  async getVehicles(@Req() req: Request) {
    const session = this.getDriverSession(req);

    const [tractors, trailers] = await Promise.all([
      this.vehicleService.findByPartnerCompanyAndType(
        session.networkId,
        session.partnerCompanyId,
        'TRACTOR',
      ),
      this.vehicleService.findByPartnerCompanyAndType(
        session.networkId,
        session.partnerCompanyId,
        'TRAILER',
      ),
    ]);

    return { tractors, trailers };
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

    const washEvent = await this.washEventService.createQrDriver(
      session.networkId,
      {
        entryMode: WashEntryMode.QR_DRIVER,
        locationId: dto.locationId,
        driverId: session.driverId,
        servicePackageId: dto.servicePackageId,
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
