import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Param,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { LoginThrottle, SensitiveThrottle } from '../common/throttler/login-throttle.decorator';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { PartnerCompanyService } from '../modules/partner-company/partner-company.service';
import { WashEventService } from '../modules/wash-event/wash-event.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { SessionService, PartnerSessionData } from '../common/session/session.service';
import { AuditLogService } from '../modules/audit-log/audit-log.service';
import { EmailService } from '../modules/email/email.service';
import { SessionType, AuditAction } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  setSessionCookie,
  clearSessionCookie,
  getSessionId,
  SESSION_COOKIES,
} from '../common/session/cookie.helper';

// Default network ID
const DEFAULT_NETWORK_ID = 'cf808392-6283-4487-9fbd-e72951ca5bf8';

@ApiTags('partner-portal')
@Controller('partner-portal')
export class PartnerPortalController {
  private readonly logger = new Logger(PartnerPortalController.name);

  constructor(
    private readonly partnerCompanyService: PartnerCompanyService,
    private readonly washEventService: WashEventService,
    private readonly prisma: PrismaService,
    private readonly sessionService: SessionService,
    private readonly auditLogService: AuditLogService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  private async getPartnerSession(req: Request): Promise<PartnerSessionData> {
    // SECURITY: Check cookie first, then header for backwards compatibility
    const sessionId = getSessionId(req, SESSION_COOKIES.PARTNER, 'x-partner-session');
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
  @LoginThrottle() // SECURITY: Brute force protection - 5 attempts per minute
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
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ipAddress = req.ip || req.socket?.remoteAddress;
    const userAgent = req.get('user-agent');

    try {
      const partner = await this.partnerCompanyService.findByCode(
        DEFAULT_NETWORK_ID,
        body.code.toUpperCase(),
      );

      // Verify PIN using bcrypt hash stored in database
      if (!partner.pinHash) {
        // AUDIT: Log failed login - no PIN configured
        await this.auditLogService.log({
          networkId: partner.networkId,
          action: AuditAction.LOGIN_FAILED,
          actorType: 'PARTNER',
          metadata: { partnerCode: body.code.toUpperCase(), partnerId: partner.id, error: 'No PIN configured' },
          ipAddress,
          userAgent,
        });
        throw new UnauthorizedException('Nincs beállítva PIN kód. Kérd a Network Admin-t a PIN beállításához.');
      }

      const isValidPin = await bcrypt.compare(body.pin, partner.pinHash);
      if (!isValidPin) {
        // AUDIT: Log failed login - invalid PIN
        await this.auditLogService.log({
          networkId: partner.networkId,
          action: AuditAction.LOGIN_FAILED,
          actorType: 'PARTNER',
          metadata: { partnerCode: body.code.toUpperCase(), partnerId: partner.id, error: 'Invalid PIN' },
          ipAddress,
          userAgent,
        });
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

      // SECURITY: Set httpOnly cookie for session
      setSessionCookie(res, SESSION_COOKIES.PARTNER, sessionId);

      // AUDIT: Log successful login
      await this.auditLogService.log({
        networkId: partner.networkId,
        action: AuditAction.LOGIN_SUCCESS,
        actorType: 'PARTNER',
        actorId: partner.id,
        metadata: { partnerCode: body.code.toUpperCase(), partnerName: partner.name },
        ipAddress,
        userAgent,
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
      // AUDIT: Log failed login - partner not found
      await this.auditLogService.log({
        action: AuditAction.LOGIN_FAILED,
        actorType: 'PARTNER',
        metadata: { partnerCode: body.code.toUpperCase(), error: 'Partner not found' },
        ipAddress,
        userAgent,
      });
      throw new UnauthorizedException('Hibás partner kód vagy PIN');
    }
  }

  // ==================== PIN Reset ====================

  @Post('request-pin-reset')
  @SensitiveThrottle()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request PIN reset (sends email to partner)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Partner company code' },
        email: { type: 'string', description: 'Partner email for verification' },
      },
      required: ['code', 'email'],
    },
  })
  @ApiResponse({ status: 200, description: 'Reset email sent if account exists' })
  async requestPinReset(
    @Body() body: { code: string; email: string },
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.socket?.remoteAddress;
    const userAgent = req.get('user-agent');

    if (!body.code || !body.email) {
      throw new BadRequestException('Partner kód és email megadása kötelező');
    }

    // Find partner by code and verify email
    const partner = await this.prisma.partnerCompany.findFirst({
      where: {
        code: body.code.toUpperCase(),
        isActive: true,
        deletedAt: null,
      },
    });

    if (!partner) {
      // Biztonsági okokból ne áruljuk el, hogy nem létezik
      return { message: 'Ha a partner kód és email helyes, a PIN visszaállító linket elküldtük' };
    }

    // Verify email matches
    if (!partner.email || partner.email.toLowerCase() !== body.email.toLowerCase()) {
      // Biztonsági okokból ne áruljuk el
      return { message: 'Ha a partner kód és email helyes, a PIN visszaállító linket elküldtük' };
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 óra

    await this.prisma.partnerCompany.update({
      where: { id: partner.id },
      data: {
        pinResetToken: resetToken,
        pinResetExpires: resetExpires,
      },
    });

    // Send email
    const platformUrl = this.configService.get('PLATFORM_URL') || 'https://app.vemiax.com';
    const resetLink = `${platformUrl}/partner/reset-pin?token=${resetToken}`;

    this.logger.log(`PIN reset link for partner ${partner.code}: ${resetLink}`);

    // Send PIN reset email
    try {
      await this.emailService.sendPinResetEmail(
        partner.email,
        partner.name,
        resetLink,
        'partner',
      );
      this.logger.log(`PIN reset email sent to partner ${partner.code}`);
    } catch (emailError) {
      this.logger.error(`Failed to send PIN reset email to partner ${partner.code}: ${emailError.message}`);
      // Don't throw - still allow the process to continue
    }

    // AUDIT: Log PIN reset request
    await this.auditLogService.log({
      networkId: partner.networkId,
      action: AuditAction.UPDATE,
      actorType: 'PARTNER',
      metadata: {
        type: 'PIN_RESET_REQUESTED',
        partnerCode: partner.code,
        partnerId: partner.id,
        email: partner.email,
      },
      ipAddress,
      userAgent,
    });

    return { message: 'Ha a partner kód és email helyes, a PIN visszaállító linket elküldtük' };
  }

  @Post('reset-pin')
  @SensitiveThrottle()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset PIN with token' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        token: { type: 'string', description: 'Reset token from email' },
        newPin: { type: 'string', description: 'New 4-digit PIN' },
      },
      required: ['token', 'newPin'],
    },
  })
  @ApiResponse({ status: 200, description: 'PIN reset successful' })
  @ApiResponse({ status: 401, description: 'Invalid or expired token' })
  async resetPin(
    @Body() body: { token: string; newPin: string },
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.socket?.remoteAddress;
    const userAgent = req.get('user-agent');

    if (!body.token || !body.newPin) {
      throw new BadRequestException('Token és új PIN megadása kötelező');
    }

    if (body.newPin.length < 4 || body.newPin.length > 8) {
      throw new BadRequestException('A PIN kódnak 4-8 karakter hosszúnak kell lennie');
    }

    // Find partner by reset token
    const partner = await this.prisma.partnerCompany.findFirst({
      where: {
        pinResetToken: body.token,
        pinResetExpires: { gt: new Date() },
        isActive: true,
        deletedAt: null,
      },
    });

    if (!partner) {
      throw new UnauthorizedException('Érvénytelen vagy lejárt token');
    }

    // Hash new PIN and update
    const pinHash = await bcrypt.hash(body.newPin, 10);

    await this.prisma.partnerCompany.update({
      where: { id: partner.id },
      data: {
        pinHash,
        pinResetToken: null,
        pinResetExpires: null,
      },
    });

    // AUDIT: Log PIN reset success
    await this.auditLogService.log({
      networkId: partner.networkId,
      action: AuditAction.UPDATE,
      actorType: 'PARTNER',
      actorId: partner.id,
      metadata: {
        type: 'PIN_RESET_SUCCESS',
        partnerCode: partner.code,
      },
      ipAddress,
      userAgent,
    });

    return { message: 'PIN kód sikeresen megváltoztatva' };
  }

  // ==================== Driver PIN Reset Requests ====================

  @Get('pin-reset-requests')
  @ApiOperation({ summary: 'Get pending driver PIN reset requests for this partner' })
  @ApiResponse({ status: 200, description: 'List of pending PIN reset requests' })
  async getPinResetRequests(@Req() req: Request) {
    const session = await this.getPartnerSession(req);

    const requests = await this.prisma.driverPinResetRequest.findMany({
      where: {
        partnerCompanyId: session.partnerId,
        status: 'PENDING',
      },
      include: {
        driver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return requests.map((r) => ({
      id: r.id,
      driverId: r.driverId,
      driverName: `${r.driver.firstName} ${r.driver.lastName}`,
      driverPhone: r.driver.phone,
      createdAt: r.createdAt,
    }));
  }

  @Post('pin-reset-requests/:id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete a driver PIN reset request with new PIN' })
  @ApiParam({ name: 'id', description: 'Request ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        newPin: { type: 'string', description: 'New 4-digit PIN for the driver' },
      },
      required: ['newPin'],
    },
  })
  @ApiResponse({ status: 200, description: 'PIN reset completed' })
  async completePinResetRequest(
    @Param('id') id: string,
    @Body() body: { newPin: string },
    @Req() req: Request,
  ) {
    const session = await this.getPartnerSession(req);
    const ipAddress = req.ip || req.socket?.remoteAddress;
    const userAgent = req.get('user-agent');

    if (!body.newPin || body.newPin.length < 4) {
      throw new BadRequestException('A PIN kódnak legalább 4 karakter hosszúnak kell lennie');
    }

    // Find the request and verify it belongs to this partner
    const request = await this.prisma.driverPinResetRequest.findFirst({
      where: {
        id,
        partnerCompanyId: session.partnerId,
        status: 'PENDING',
      },
      include: {
        driver: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!request) {
      throw new BadRequestException('Kérés nem található vagy már feldolgozva');
    }

    // Update driver's PIN
    const pinHash = await bcrypt.hash(body.newPin, 10);
    await this.prisma.driver.update({
      where: { id: request.driverId },
      data: { pinHash },
    });

    // Mark request as completed
    await this.prisma.driverPinResetRequest.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        reviewedBy: `partner:${session.partnerId}`,
        reviewedAt: new Date(),
      },
    });

    // Audit log
    await this.auditLogService.log({
      networkId: session.networkId,
      action: AuditAction.UPDATE,
      actorType: 'PARTNER',
      actorId: session.partnerId,
      metadata: {
        type: 'DRIVER_PIN_RESET_COMPLETED',
        requestId: id,
        driverId: request.driverId,
        driverName: `${request.driver.firstName} ${request.driver.lastName}`,
      },
      ipAddress,
      userAgent,
    });

    return { message: 'Sofőr PIN kódja sikeresen visszaállítva' };
  }

  @Post('pin-reset-requests/:id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a driver PIN reset request' })
  @ApiParam({ name: 'id', description: 'Request ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Rejection reason' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Request rejected' })
  async rejectPinResetRequest(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Req() req: Request,
  ) {
    const session = await this.getPartnerSession(req);
    const ipAddress = req.ip || req.socket?.remoteAddress;
    const userAgent = req.get('user-agent');

    // Find and verify request
    const request = await this.prisma.driverPinResetRequest.findFirst({
      where: {
        id,
        partnerCompanyId: session.partnerId,
        status: 'PENDING',
      },
    });

    if (!request) {
      throw new BadRequestException('Kérés nem található vagy már feldolgozva');
    }

    // Mark request as rejected
    await this.prisma.driverPinResetRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewedBy: `partner:${session.partnerId}`,
        reviewedAt: new Date(),
        reviewNote: body.reason,
      },
    });

    // Audit log
    await this.auditLogService.log({
      networkId: session.networkId,
      action: AuditAction.UPDATE,
      actorType: 'PARTNER',
      actorId: session.partnerId,
      metadata: {
        type: 'DRIVER_PIN_RESET_REJECTED',
        requestId: id,
        driverId: request.driverId,
        reason: body.reason,
      },
      ipAddress,
      userAgent,
    });

    return { message: 'Kérés elutasítva' };
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
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // SECURITY: Check cookie first, then header
    const sessionId = getSessionId(req, SESSION_COOKIES.PARTNER, 'x-partner-session');
    if (sessionId) {
      await this.sessionService.deleteSession(sessionId);
    }
    // SECURITY: Clear httpOnly cookie
    clearSessionCookie(res, SESSION_COOKIES.PARTNER);
    return { message: 'Kijelentkezve' };
  }
}
