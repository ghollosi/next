import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';
import { PlatformBillingService } from './platform-billing.service';
import { PlatformAdminService } from '../platform-admin/platform-admin.service';
import { PlatformRole } from '@prisma/client';

/**
 * Platform Billing Controller
 *
 * Handles API endpoints for Platform → Network invoicing.
 * All endpoints require Platform Admin authentication.
 */
@Controller('platform-admin/billing')
export class PlatformBillingController {
  constructor(
    private readonly billingService: PlatformBillingService,
    private readonly platformAdminService: PlatformAdminService,
  ) {}

  private async validateAuth(authHeader: string | undefined): Promise<{
    adminId: string;
    role: PlatformRole;
  }> {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Nincs bejelentkezve');
    }

    const token = authHeader.substring(7);
    const result = await this.platformAdminService.validateToken(token);

    if (!result) {
      throw new UnauthorizedException('Érvénytelen vagy lejárt token');
    }

    return result;
  }

  /**
   * Get billing summary for dashboard
   */
  @Get('summary')
  async getBillingSummary(
    @Headers('authorization') auth?: string,
  ) {
    await this.validateAuth(auth);
    return this.billingService.getPlatformBillingSummary();
  }

  /**
   * Get all Platform Invoices with filters
   */
  @Get('invoices')
  async getInvoices(
    @Query('networkId') networkId?: string,
    @Query('status') status?: string,
    @Query('issueDateFrom') issueDateFrom?: string,
    @Query('issueDateTo') issueDateTo?: string,
    @Query('dueDateFrom') dueDateFrom?: string,
    @Query('dueDateTo') dueDateTo?: string,
    @Headers('authorization') auth?: string,
  ) {
    await this.validateAuth(auth);
    return this.billingService.queryPlatformInvoices({
      networkId,
      status: status as any,
      issueDateFrom: issueDateFrom ? new Date(issueDateFrom) : undefined,
      issueDateTo: issueDateTo ? new Date(issueDateTo) : undefined,
      dueDateFrom: dueDateFrom ? new Date(dueDateFrom) : undefined,
      dueDateTo: dueDateTo ? new Date(dueDateTo) : undefined,
    });
  }

  /**
   * Get a specific Platform Invoice
   */
  @Get('invoices/:id')
  async getInvoice(
    @Param('id') id: string,
    @Headers('authorization') auth?: string,
  ) {
    await this.validateAuth(auth);
    const invoice = await this.billingService.getPlatformInvoice(id);
    if (!invoice) {
      throw new HttpException('Invoice not found', HttpStatus.NOT_FOUND);
    }
    return invoice;
  }

  /**
   * Calculate usage preview for a network (without creating invoice)
   */
  @Get('networks/:networkId/usage-preview')
  async getUsagePreview(
    @Param('networkId') networkId: string,
    @Query('periodStart') periodStart: string,
    @Query('periodEnd') periodEnd: string,
    @Headers('authorization') auth?: string,
  ) {
    await this.validateAuth(auth);

    if (!periodStart || !periodEnd) {
      throw new HttpException(
        'periodStart and periodEnd are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.billingService.calculateNetworkUsage(
      networkId,
      new Date(periodStart),
      new Date(periodEnd),
    );
  }

  /**
   * Create a draft Platform Invoice for a network
   */
  @Post('invoices')
  @HttpCode(HttpStatus.CREATED)
  async createInvoice(
    @Body()
    body: {
      networkId: string;
      periodStart: string;
      periodEnd: string;
    },
    @Headers('authorization') auth?: string,
  ) {
    await this.validateAuth(auth);

    const { networkId, periodStart, periodEnd } = body;

    if (!networkId || !periodStart || !periodEnd) {
      throw new HttpException(
        'networkId, periodStart, and periodEnd are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.billingService.preparePlatformInvoice(
      networkId,
      new Date(periodStart),
      new Date(periodEnd),
    );
  }

  /**
   * Issue a Platform Invoice (send to billing provider)
   */
  @Post('invoices/:id/issue')
  @HttpCode(HttpStatus.OK)
  async issueInvoice(
    @Param('id') id: string,
    @Headers('authorization') auth?: string,
  ) {
    await this.validateAuth(auth);
    return this.billingService.issuePlatformInvoice(id);
  }

  /**
   * Mark a Platform Invoice as paid
   */
  @Put('invoices/:id/paid')
  async markPaid(
    @Param('id') id: string,
    @Body() body: { paidDate?: string },
    @Headers('authorization') auth?: string,
  ) {
    await this.validateAuth(auth);
    return this.billingService.markPlatformInvoicePaid(
      id,
      body.paidDate ? new Date(body.paidDate) : undefined,
    );
  }

  /**
   * Cancel a Platform Invoice
   */
  @Delete('invoices/:id')
  @HttpCode(HttpStatus.OK)
  async cancelInvoice(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Headers('authorization') auth?: string,
  ) {
    await this.validateAuth(auth);
    return this.billingService.cancelPlatformInvoice(id, body.reason);
  }

  /**
   * Generate monthly invoices for all active networks
   */
  @Post('generate-monthly')
  @HttpCode(HttpStatus.OK)
  async generateMonthlyInvoices(
    @Body() body: { year: number; month: number },
    @Headers('authorization') auth?: string,
  ) {
    await this.validateAuth(auth);

    const { year, month } = body;

    if (!year || !month || month < 1 || month > 12) {
      throw new HttpException(
        'Valid year and month (1-12) are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.billingService.generateMonthlyInvoices(year, month);
  }

  /**
   * Process overdue invoices (update status)
   */
  @Post('process-overdue')
  @HttpCode(HttpStatus.OK)
  async processOverdue(
    @Headers('authorization') auth?: string,
  ) {
    await this.validateAuth(auth);
    const count = await this.billingService.processOverduePlatformInvoices();
    return { processed: count };
  }
}
