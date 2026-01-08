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
import { PrismaService } from '../common/prisma/prisma.service';
import { SessionService, PartnerSessionData } from '../common/session/session.service';
import { SessionType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

// Default network ID
const DEFAULT_NETWORK_ID = 'cf808392-6283-4487-9fbd-e72951ca5bf8';

@ApiTags('partner-portal')
@Controller('partner-portal')
export class PartnerPortalController {
  constructor(
    private readonly partnerCompanyService: PartnerCompanyService,
    private readonly washEventService: WashEventService,
    private readonly prisma: PrismaService,
    private readonly sessionService: SessionService,
  ) {}

  private async getPartnerSession(req: Request): Promise<PartnerSessionData> {
    const sessionId = req.get('x-partner-session');
    if (!sessionId) {
      throw new BadRequestException('Partner session required');
    }

    const session = await this.sessionService.getSession<PartnerSessionData>(
      sessionId,
      SessionType.PARTNER,
    );
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

      // Verify PIN using bcrypt hash stored in database
      if (!partner.pinHash) {
        throw new UnauthorizedException('Nincs beállítva PIN kód. Kérd a Network Admin-t a PIN beállításához.');
      }

      const isValidPin = await bcrypt.compare(body.pin, partner.pinHash);
      if (!isValidPin) {
        throw new UnauthorizedException('Hibás PIN kód');
      }

      // Generate session and store in database
      const sessionData: PartnerSessionData = {
        partnerId: partner.id,
        networkId: partner.networkId,
        partnerName: partner.name,
      };

      const sessionId = await this.sessionService.createSession(
        SessionType.PARTNER,
        sessionData,
        {
          networkId: partner.networkId,
          userId: partner.id,
        },
      );

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
    const session = await this.getPartnerSession(req);
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
    const session = await this.getPartnerSession(req);

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
    const session = await this.getPartnerSession(req);

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
    const session = await this.getPartnerSession(req);

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

  @Get('invoices')
  @ApiOperation({ summary: 'Get partner invoices' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status' })
  @ApiResponse({ status: 200, description: 'List of invoices' })
  async getInvoices(
    @Req() req: Request,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: string,
  ) {
    const session = await this.getPartnerSession(req);

    const where: any = {
      partnerCompanyId: session.partnerId,
    };

    if (startDate) {
      where.issueDate = { ...where.issueDate, gte: new Date(startDate) };
    }
    if (endDate) {
      where.issueDate = { ...where.issueDate, lte: new Date(endDate + 'T23:59:59') };
    }
    if (status) {
      where.status = status;
    }

    const invoices = await this.prisma.invoice.findMany({
      where,
      include: {
        items: {
          select: {
            id: true,
            description: true,
            quantity: true,
            unitPrice: true,
            totalPrice: true,
            vatRate: true,
          },
        },
      },
      orderBy: { issueDate: 'desc' },
    });

    return {
      data: invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        status: inv.status,
        issueDate: inv.issueDate,
        dueDate: inv.dueDate,
        paidDate: inv.paidDate,
        subtotal: Number(inv.subtotal),
        vatAmount: Number(inv.vatAmount),
        total: Number(inv.total),
        currency: inv.currency,
        paymentMethod: inv.paymentMethod,
        externalInvoiceId: inv.externalId,
        pdfUrl: inv.szamlazzPdfUrl,
        items: inv.items.map((item) => ({
          id: item.id,
          description: item.description,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          totalPrice: Number(item.totalPrice),
          vatRate: item.vatRate,
        })),
      })),
      total: invoices.length,
    };
  }

  @Get('invoices/summary')
  @ApiOperation({ summary: 'Get invoice summary statistics' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiResponse({ status: 200, description: 'Invoice summary' })
  async getInvoiceSummary(
    @Req() req: Request,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const session = await this.getPartnerSession(req);

    const where: any = {
      partnerCompanyId: session.partnerId,
    };

    if (startDate) {
      where.issueDate = { ...where.issueDate, gte: new Date(startDate) };
    }
    if (endDate) {
      where.issueDate = { ...where.issueDate, lte: new Date(endDate + 'T23:59:59') };
    }

    const invoices = await this.prisma.invoice.findMany({
      where,
      select: {
        status: true,
        total: true,
        currency: true,
      },
    });

    const summary = {
      totalCount: invoices.length,
      totalAmount: 0,
      paidAmount: 0,
      unpaidAmount: 0,
      overdueAmount: 0,
      byStatus: {} as Record<string, { count: number; amount: number }>,
    };

    invoices.forEach((inv) => {
      const amount = Number(inv.total);
      summary.totalAmount += amount;

      if (!summary.byStatus[inv.status]) {
        summary.byStatus[inv.status] = { count: 0, amount: 0 };
      }
      summary.byStatus[inv.status].count += 1;
      summary.byStatus[inv.status].amount += amount;

      if (inv.status === 'PAID') {
        summary.paidAmount += amount;
      } else if (inv.status === 'OVERDUE') {
        summary.overdueAmount += amount;
        summary.unpaidAmount += amount;
      } else if (inv.status === 'ISSUED' || inv.status === 'SENT') {
        summary.unpaidAmount += amount;
      }
    });

    return summary;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout partner session' })
  @ApiResponse({ status: 200, description: 'Logged out' })
  async logout(@Req() req: Request) {
    const sessionId = req.get('x-partner-session');
    if (sessionId) {
      await this.sessionService.deleteSession(sessionId);
    }
    return { message: 'Kijelentkezve' };
  }
}
