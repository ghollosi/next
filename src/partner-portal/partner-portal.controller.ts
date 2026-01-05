import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Req,
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
  ApiQuery,
} from '@nestjs/swagger';
import { Request } from 'express';
import { PartnerCompanyService } from '../modules/partner-company/partner-company.service';
import { WashEventService } from '../modules/wash-event/wash-event.service';
import { createHash } from 'crypto';

// Simple in-memory session store for partner portals
const partnerSessions = new Map<
  string,
  { partnerId: string; networkId: string; partnerName: string }
>();

// Default network ID
const DEFAULT_NETWORK_ID = 'cf808392-6283-4487-9fbd-e72951ca5bf8';

// Simple PIN storage for partners (in production, this would be in DB)
// For now, partners use their tax number last 4 digits as PIN
function hashPin(pin: string): string {
  return createHash('sha256').update(pin).digest('hex');
}

@ApiTags('partner-portal')
@Controller('partner-portal')
export class PartnerPortalController {
  constructor(
    private readonly partnerCompanyService: PartnerCompanyService,
    private readonly washEventService: WashEventService,
  ) {}

  private getPartnerSession(req: Request) {
    const sessionId = req.get('x-partner-session');
    if (!sessionId) {
      throw new BadRequestException('Partner session required');
    }

    const session = partnerSessions.get(sessionId);
    if (!session) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    return session;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Partner login with company code and PIN' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Partner company code' },
        pin: { type: 'string', description: '4-digit PIN' },
      },
      required: ['code', 'pin'],
    },
  })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body() body: { code: string; pin: string },
  ) {
    try {
      const partner = await this.partnerCompanyService.findByCode(
        DEFAULT_NETWORK_ID,
        body.code.toUpperCase(),
      );

      // For demo purposes, PIN is last 4 chars of tax number or "1234" if no tax number
      const expectedPin = partner.taxNumber
        ? partner.taxNumber.replace(/\D/g, '').slice(-4)
        : '1234';

      if (body.pin !== expectedPin) {
        throw new UnauthorizedException('Hibás PIN kód');
      }

      // Generate session
      const sessionId = `partner_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      partnerSessions.set(sessionId, {
        partnerId: partner.id,
        networkId: partner.networkId,
        partnerName: partner.name,
      });

      return {
        sessionId,
        partnerId: partner.id,
        partnerName: partner.name,
        partnerCode: partner.code,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Hibás partner kód vagy PIN');
    }
  }

  @Get('profile')
  @ApiOperation({ summary: 'Get partner profile' })
  @ApiResponse({ status: 200, description: 'Partner profile' })
  async getProfile(@Req() req: Request) {
    const session = this.getPartnerSession(req);
    const partner = await this.partnerCompanyService.findById(
      session.networkId,
      session.partnerId,
    );

    return {
      id: partner.id,
      name: partner.name,
      code: partner.code,
      contactName: partner.contactName,
      email: partner.email,
      phone: partner.phone,
      billingType: partner.billingType,
    };
  }

  @Get('wash-events')
  @ApiOperation({ summary: 'Get partner wash events with optional date filter' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status' })
  @ApiResponse({ status: 200, description: 'List of wash events' })
  async getWashEvents(
    @Req() req: Request,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: string,
  ) {
    const session = this.getPartnerSession(req);

    const result = await this.washEventService.findByPartnerCompany(
      session.networkId,
      session.partnerId,
      {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate + 'T23:59:59') : undefined,
        status: status as any,
        limit: 1000,
      },
    );

    return result;
  }

  @Get('wash-events/export')
  @ApiOperation({ summary: 'Export wash events to CSV' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date (YYYY-MM-DD)' })
  @ApiResponse({ status: 200, description: 'CSV data' })
  async exportWashEvents(
    @Req() req: Request,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const session = this.getPartnerSession(req);

    const result = await this.washEventService.findByPartnerCompany(
      session.networkId,
      session.partnerId,
      {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate + 'T23:59:59') : undefined,
        limit: 10000,
      },
    );

    // Generate CSV
    const headers = [
      'Azonosító',
      'Dátum',
      'Helyszín',
      'Szolgáltatás',
      'Vontató',
      'Pótkocsi',
      'Sofőr',
      'Státusz',
    ];

    const rows = result.data.map((event: any) => [
      event.id,
      new Date(event.createdAt).toLocaleString('hu-HU'),
      event.location?.name || event.locationId,
      event.servicePackage?.name || event.servicePackageId,
      event.tractorPlate || event.tractorVehicle?.plateNumber || '-',
      event.trailerPlate || event.trailerVehicle?.plateNumber || '-',
      event.driver ? `${event.driver.firstName} ${event.driver.lastName}` : '-',
      event.status,
    ]);

    const csv = [
      headers.join(';'),
      ...rows.map((row: string[]) => row.join(';')),
    ].join('\n');

    return {
      filename: `wash-events-${startDate || 'all'}-${endDate || 'all'}.csv`,
      contentType: 'text/csv; charset=utf-8',
      data: csv,
    };
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get partner wash statistics' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date (YYYY-MM-DD)' })
  @ApiResponse({ status: 200, description: 'Statistics' })
  async getStatistics(
    @Req() req: Request,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const session = this.getPartnerSession(req);

    const result = await this.washEventService.findByPartnerCompany(
      session.networkId,
      session.partnerId,
      {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate + 'T23:59:59') : undefined,
        limit: 10000,
      },
    );

    const events = result.data;

    // Calculate statistics
    const stats = {
      total: events.length,
      byStatus: {} as Record<string, number>,
      byLocation: {} as Record<string, number>,
      byService: {} as Record<string, number>,
    };

    events.forEach((event: any) => {
      // By status
      stats.byStatus[event.status] = (stats.byStatus[event.status] || 0) + 1;

      // By location
      const locationName = event.location?.name || 'Ismeretlen';
      stats.byLocation[locationName] = (stats.byLocation[locationName] || 0) + 1;

      // By service
      const serviceName = event.servicePackage?.name || 'Ismeretlen';
      stats.byService[serviceName] = (stats.byService[serviceName] || 0) + 1;
    });

    return stats;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout partner session' })
  @ApiResponse({ status: 200, description: 'Logged out' })
  async logout(@Req() req: Request) {
    const sessionId = req.get('x-partner-session');
    if (sessionId) {
      partnerSessions.delete(sessionId);
    }
    return { message: 'Kijelentkezve' };
  }
}
