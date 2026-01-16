import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Res,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
  ApiParam,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { BillingService } from './billing.service';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  CreateServicePriceDto,
  UpdateServicePriceDto,
  CreatePartnerCustomPriceDto,
  UpdatePartnerCustomPriceDto,
  BulkUpdatePricesDto,
} from '../operator/dto/pricing.dto';
import {
  PrepareInvoiceDto,
  IssueInvoiceDto,
  MarkPaidDto,
  QueryInvoicesDto,
} from '../operator/dto/invoice.dto';

@ApiTags('billing')
@Controller('operator/billing')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly prisma: PrismaService,
  ) {}

  private validateNetworkId(networkId: string | undefined): string {
    if (!networkId) {
      throw new BadRequestException('X-Network-ID header is required');
    }
    return networkId;
  }

  // ==================== Service Prices ====================

  @Get('prices')
  @ApiOperation({ summary: 'Get all service prices' })
  @ApiHeader({ name: 'X-Network-ID', required: true })
  async getServicePrices(@Headers('x-network-id') networkId: string) {
    const netId = this.validateNetworkId(networkId);
    return this.prisma.servicePrice.findMany({
      where: { networkId: netId },
      include: {
        servicePackage: {
          select: { id: true, code: true, name: true },
        },
      },
      orderBy: [{ servicePackageId: 'asc' }, { vehicleType: 'asc' }],
    });
  }

  @Post('prices')
  @ApiOperation({ summary: 'Create a service price' })
  @ApiHeader({ name: 'X-Network-ID', required: true })
  async createServicePrice(
    @Headers('x-network-id') networkId: string,
    @Body() dto: CreateServicePriceDto,
  ) {
    const netId = this.validateNetworkId(networkId);
    return this.prisma.servicePrice.create({
      data: {
        networkId: netId,
        servicePackageId: dto.servicePackageId,
        vehicleType: dto.vehicleType,
        price: dto.price,
        currency: dto.currency || 'HUF',
      },
    });
  }

  @Put('prices/:id')
  @ApiOperation({ summary: 'Update a service price' })
  @ApiHeader({ name: 'X-Network-ID', required: true })
  @ApiParam({ name: 'id', description: 'Service price ID' })
  async updateServicePrice(
    @Headers('x-network-id') networkId: string,
    @Param('id') id: string,
    @Body() dto: UpdateServicePriceDto,
  ) {
    this.validateNetworkId(networkId);
    return this.prisma.servicePrice.update({
      where: { id },
      data: dto,
    });
  }

  @Delete('prices/:id')
  @ApiOperation({ summary: 'Delete a service price' })
  @ApiHeader({ name: 'X-Network-ID', required: true })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteServicePrice(
    @Headers('x-network-id') networkId: string,
    @Param('id') id: string,
  ) {
    this.validateNetworkId(networkId);
    await this.prisma.servicePrice.delete({ where: { id } });
  }

  // ==================== Excel Export/Import ====================

  @Get('prices/export')
  @ApiOperation({ summary: 'Export all prices to Excel' })
  @ApiHeader({ name: 'X-Network-ID', required: true })
  @ApiResponse({ status: 200, description: 'Excel file' })
  async exportPrices(
    @Headers('x-network-id') networkId: string,
    @Res() res: Response,
  ) {
    const netId = this.validateNetworkId(networkId);
    const buffer = await this.billingService.exportPricesToExcel(netId);

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="arlista_${new Date().toISOString().split('T')[0]}.xlsx"`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  }

  @Post('prices/import')
  @ApiOperation({ summary: 'Import prices from Excel file' })
  @ApiHeader({ name: 'X-Network-ID', required: true })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async importPrices(
    @Headers('x-network-id') networkId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const netId = this.validateNetworkId(networkId);

    if (!file) {
      throw new BadRequestException('Nincs feltöltött fájl');
    }

    return this.billingService.importPricesFromExcel(netId, file.buffer);
  }

  @Post('prices/bulk')
  @ApiOperation({ summary: 'Bulk update prices from JSON' })
  @ApiHeader({ name: 'X-Network-ID', required: true })
  async bulkUpdatePrices(
    @Headers('x-network-id') networkId: string,
    @Body() dto: BulkUpdatePricesDto,
  ) {
    const netId = this.validateNetworkId(networkId);
    return this.billingService.bulkUpdatePrices(
      netId,
      dto.prices,
      dto.currency || 'HUF',
    );
  }

  @Post('prices/import-vertical')
  @ApiOperation({
    summary: 'Import prices from vertical Excel format',
    description: 'Upload Excel with columns: A=Járműkategória, B=Mosástípus, C=Nettó ár',
  })
  @ApiHeader({ name: 'X-Network-ID', required: true })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Excel file with vertical price list format',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async importVerticalPrices(
    @Headers('x-network-id') networkId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const netId = this.validateNetworkId(networkId);

    if (!file) {
      throw new BadRequestException('Nincs feltöltött fájl');
    }

    return this.billingService.importPricesFromVerticalExcel(netId, file.buffer);
  }

  // ==================== Service Packages ====================

  @Get('service-packages')
  @ApiOperation({ summary: 'Get all service packages' })
  @ApiHeader({ name: 'X-Network-ID', required: true })
  async getServicePackages(@Headers('x-network-id') networkId: string) {
    const netId = this.validateNetworkId(networkId);
    return this.billingService.getServicePackages(netId);
  }

  // ==================== Partner Custom Prices ====================

  @Get('custom-prices')
  @ApiOperation({ summary: 'Get all partner custom prices' })
  @ApiHeader({ name: 'X-Network-ID', required: true })
  async getCustomPrices(
    @Headers('x-network-id') networkId: string,
    @Query('partnerCompanyId') partnerCompanyId?: string,
  ) {
    const netId = this.validateNetworkId(networkId);
    return this.prisma.partnerCustomPrice.findMany({
      where: {
        networkId: netId,
        ...(partnerCompanyId && { partnerCompanyId }),
      },
      include: {
        partnerCompany: {
          select: { id: true, code: true, name: true },
        },
        servicePackage: {
          select: { id: true, code: true, name: true },
        },
      },
      orderBy: [{ partnerCompanyId: 'asc' }, { servicePackageId: 'asc' }],
    });
  }

  @Post('custom-prices')
  @ApiOperation({ summary: 'Create a partner custom price' })
  @ApiHeader({ name: 'X-Network-ID', required: true })
  async createCustomPrice(
    @Headers('x-network-id') networkId: string,
    @Body() dto: CreatePartnerCustomPriceDto,
  ) {
    const netId = this.validateNetworkId(networkId);
    return this.prisma.partnerCustomPrice.create({
      data: {
        networkId: netId,
        partnerCompanyId: dto.partnerCompanyId,
        servicePackageId: dto.servicePackageId,
        vehicleType: dto.vehicleType,
        price: dto.price,
        currency: dto.currency || 'HUF',
      },
    });
  }

  @Put('custom-prices/:id')
  @ApiOperation({ summary: 'Update a partner custom price' })
  @ApiHeader({ name: 'X-Network-ID', required: true })
  async updateCustomPrice(
    @Headers('x-network-id') networkId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePartnerCustomPriceDto,
  ) {
    this.validateNetworkId(networkId);
    return this.prisma.partnerCustomPrice.update({
      where: { id },
      data: dto,
    });
  }

  @Delete('custom-prices/:id')
  @ApiOperation({ summary: 'Delete a partner custom price' })
  @ApiHeader({ name: 'X-Network-ID', required: true })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCustomPrice(
    @Headers('x-network-id') networkId: string,
    @Param('id') id: string,
  ) {
    this.validateNetworkId(networkId);
    await this.prisma.partnerCustomPrice.delete({ where: { id } });
  }

  // ==================== Price Lookup ====================

  @Get('price-lookup')
  @ApiOperation({ summary: 'Look up price for a service/vehicle combination' })
  @ApiHeader({ name: 'X-Network-ID', required: true })
  async lookupPrice(
    @Headers('x-network-id') networkId: string,
    @Query('servicePackageId') servicePackageId: string,
    @Query('vehicleType') vehicleType: string,
    @Query('partnerCompanyId') partnerCompanyId?: string,
  ) {
    const netId = this.validateNetworkId(networkId);

    if (!servicePackageId || !vehicleType) {
      throw new BadRequestException('servicePackageId and vehicleType are required');
    }

    return this.billingService.getPrice(
      netId,
      servicePackageId,
      vehicleType as any,
      partnerCompanyId,
    );
  }

  // ==================== Invoices ====================

  @Get('invoices')
  @ApiOperation({ summary: 'Query invoices' })
  @ApiHeader({ name: 'X-Network-ID', required: true })
  async queryInvoices(
    @Headers('x-network-id') networkId: string,
    @Query() query: QueryInvoicesDto,
  ) {
    const netId = this.validateNetworkId(networkId);
    return this.billingService.queryInvoices(netId, {
      partnerCompanyId: query.partnerCompanyId,
      status: query.status,
      issueDateFrom: query.issueDateFrom ? new Date(query.issueDateFrom) : undefined,
      issueDateTo: query.issueDateTo ? new Date(query.issueDateTo) : undefined,
      dueDateFrom: query.dueDateFrom ? new Date(query.dueDateFrom) : undefined,
      dueDateTo: query.dueDateTo ? new Date(query.dueDateTo) : undefined,
    });
  }

  @Get('invoices/:id')
  @ApiOperation({ summary: 'Get invoice by ID' })
  @ApiHeader({ name: 'X-Network-ID', required: true })
  async getInvoice(
    @Headers('x-network-id') networkId: string,
    @Param('id') id: string,
  ) {
    this.validateNetworkId(networkId);
    return this.billingService.getInvoice(id);
  }

  @Post('invoices/prepare')
  @ApiOperation({ summary: 'Prepare a draft invoice for a billing period' })
  @ApiHeader({ name: 'X-Network-ID', required: true })
  async prepareInvoice(
    @Headers('x-network-id') networkId: string,
    @Body() dto: PrepareInvoiceDto,
  ) {
    const netId = this.validateNetworkId(networkId);
    return this.billingService.prepareInvoice(
      netId,
      dto.partnerCompanyId,
      new Date(dto.periodStart),
      new Date(dto.periodEnd),
    );
  }

  @Post('invoices/:id/issue')
  @ApiOperation({ summary: 'Issue an invoice through external provider' })
  @ApiHeader({ name: 'X-Network-ID', required: true })
  async issueInvoice(
    @Headers('x-network-id') networkId: string,
    @Param('id') id: string,
    @Body() dto: IssueInvoiceDto,
  ) {
    this.validateNetworkId(networkId);
    return this.billingService.issueInvoice(id, dto.provider);
  }

  @Post('invoices/:id/mark-paid')
  @ApiOperation({ summary: 'Mark an invoice as paid' })
  @ApiHeader({ name: 'X-Network-ID', required: true })
  async markPaid(
    @Headers('x-network-id') networkId: string,
    @Param('id') id: string,
    @Body() dto: MarkPaidDto,
  ) {
    this.validateNetworkId(networkId);
    return this.billingService.markPaid(
      id,
      dto.paymentMethod,
      dto.paidDate ? new Date(dto.paidDate) : undefined,
    );
  }

  @Post('invoices/:id/cancel')
  @ApiOperation({ summary: 'Cancel (storno) an invoice' })
  @ApiHeader({ name: 'X-Network-ID', required: true })
  async cancelInvoice(
    @Headers('x-network-id') networkId: string,
    @Param('id') id: string,
  ) {
    this.validateNetworkId(networkId);
    return this.billingService.cancelInvoice(id);
  }

  // ==================== VAT Validation ====================

  @Get('validate-vat')
  @ApiOperation({ summary: 'Validate an EU VAT number using VIES' })
  async validateVat(@Query('vatNumber') vatNumber: string) {
    if (!vatNumber) {
      throw new BadRequestException('vatNumber query parameter is required');
    }
    return this.billingService.validateVatNumber(vatNumber);
  }

  // ==================== Reports / Utilities ====================

  @Get('discount-preview')
  @ApiOperation({ summary: 'Preview discount calculation for a partner' })
  @ApiHeader({ name: 'X-Network-ID', required: true })
  async previewDiscount(
    @Headers('x-network-id') networkId: string,
    @Query('partnerCompanyId') partnerCompanyId: string,
    @Query('periodStart') periodStart: string,
    @Query('periodEnd') periodEnd: string,
  ) {
    this.validateNetworkId(networkId);

    if (!partnerCompanyId || !periodStart || !periodEnd) {
      throw new BadRequestException('partnerCompanyId, periodStart, and periodEnd are required');
    }

    return this.billingService.calculateDiscount(
      partnerCompanyId,
      new Date(periodStart),
      new Date(periodEnd),
    );
  }

  @Post('process-overdue')
  @ApiOperation({ summary: 'Mark overdue invoices as OVERDUE status' })
  @ApiHeader({ name: 'X-Network-ID', required: true })
  async processOverdue(@Headers('x-network-id') networkId: string) {
    const netId = this.validateNetworkId(networkId);
    const count = await this.billingService.processOverdueInvoices(netId);
    return { processedCount: count };
  }
}
