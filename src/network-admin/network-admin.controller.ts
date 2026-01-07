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
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { NetworkAdminService } from './network-admin.service';
import { StripeService } from '../stripe/stripe.service';
import {
  NetworkAdminLoginDto,
  NetworkAdminLoginResponseDto,
  NetworkDashboardDto,
  LocationListItemDto,
  CreateLocationDto,
  UpdateLocationDto,
  PartnerCompanyListItemDto,
  CreatePartnerCompanyDto,
  DriverListItemDto,
  WashEventListItemDto,
  NetworkRegisterDto,
  NetworkRegisterResponseDto,
  VerifyEmailDto,
  ResendVerificationDto,
  TrialStatusDto,
} from './dto/network-admin.dto';
import {
  CreateCheckoutSessionDto,
  CreateBillingPortalDto,
  SubscriptionDetailsDto,
  CheckoutSessionResponseDto,
  BillingPortalResponseDto,
} from '../stripe/dto/stripe.dto';

@ApiTags('Network Admin')
@Controller('network-admin')
export class NetworkAdminController {
  constructor(
    private readonly networkAdminService: NetworkAdminService,
    private readonly stripeService: StripeService,
  ) {}

  private async validateAuth(authHeader: string | undefined): Promise<{
    adminId: string;
    role: string;
    networkId: string;
  }> {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Nincs bejelentkezve');
    }

    const token = authHeader.substring(7);
    const result = await this.networkAdminService.validateToken(token);

    if (!result) {
      throw new UnauthorizedException('Érvénytelen vagy lejárt token');
    }

    return result;
  }

  // =========================================================================
  // AUTH
  // =========================================================================

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Network admin login' })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: NetworkAdminLoginResponseDto,
  })
  async login(@Body() dto: NetworkAdminLoginDto): Promise<NetworkAdminLoginResponseDto> {
    return this.networkAdminService.login(dto);
  }

  // =========================================================================
  // REGISTRATION
  // =========================================================================

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register new network (open registration)' })
  @ApiResponse({
    status: 201,
    description: 'Network registered successfully',
    type: NetworkRegisterResponseDto,
  })
  @ApiResponse({ status: 409, description: 'Slug or email already exists' })
  async register(@Body() dto: NetworkRegisterDto): Promise<NetworkRegisterResponseDto> {
    return this.networkAdminService.register(dto);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email address' })
  @ApiResponse({
    status: 200,
    description: 'Email verified successfully',
  })
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<{ success: boolean; message: string }> {
    return this.networkAdminService.verifyEmail(dto.token);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend verification email' })
  @ApiResponse({
    status: 200,
    description: 'Verification email sent',
  })
  async resendVerification(@Body() dto: ResendVerificationDto): Promise<{ success: boolean; message: string }> {
    return this.networkAdminService.resendVerificationEmail(dto.email, dto.slug);
  }

  // =========================================================================
  // TRIAL STATUS
  // =========================================================================

  @Get('trial-status')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get trial/subscription status' })
  @ApiResponse({
    status: 200,
    description: 'Trial status',
    type: TrialStatusDto,
  })
  async getTrialStatus(
    @Headers('authorization') auth?: string,
  ): Promise<TrialStatusDto> {
    const { networkId } = await this.validateAuth(auth);
    return this.networkAdminService.getTrialStatus(networkId);
  }

  // =========================================================================
  // DASHBOARD
  // =========================================================================

  @Get('dashboard')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get network dashboard' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard data',
    type: NetworkDashboardDto,
  })
  async getDashboard(
    @Headers('authorization') auth?: string,
  ): Promise<NetworkDashboardDto> {
    const { networkId } = await this.validateAuth(auth);
    return this.networkAdminService.getDashboard(networkId);
  }

  // =========================================================================
  // LOCATIONS
  // =========================================================================

  @Get('locations')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List locations' })
  @ApiResponse({
    status: 200,
    description: 'List of locations',
    type: [LocationListItemDto],
  })
  async listLocations(
    @Headers('authorization') auth?: string,
  ): Promise<LocationListItemDto[]> {
    const { networkId } = await this.validateAuth(auth);
    return this.networkAdminService.listLocations(networkId);
  }

  @Post('locations')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create location' })
  @ApiResponse({
    status: 201,
    description: 'Location created',
    type: LocationListItemDto,
  })
  async createLocation(
    @Body() dto: CreateLocationDto,
    @Headers('authorization') auth?: string,
  ): Promise<LocationListItemDto> {
    const { networkId } = await this.validateAuth(auth);
    return this.networkAdminService.createLocation(networkId, dto);
  }

  @Put('locations/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update location' })
  @ApiResponse({
    status: 200,
    description: 'Location updated',
    type: LocationListItemDto,
  })
  async updateLocation(
    @Param('id') id: string,
    @Body() dto: UpdateLocationDto,
    @Headers('authorization') auth?: string,
  ): Promise<LocationListItemDto> {
    const { networkId } = await this.validateAuth(auth);
    return this.networkAdminService.updateLocation(networkId, id, dto);
  }

  @Delete('locations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete location' })
  @ApiResponse({ status: 204, description: 'Location deleted' })
  async deleteLocation(
    @Param('id') id: string,
    @Headers('authorization') auth?: string,
  ): Promise<void> {
    const { networkId } = await this.validateAuth(auth);
    return this.networkAdminService.deleteLocation(networkId, id);
  }

  // =========================================================================
  // PARTNER COMPANIES
  // =========================================================================

  @Get('partner-companies')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List partner companies' })
  @ApiResponse({
    status: 200,
    description: 'List of partner companies',
    type: [PartnerCompanyListItemDto],
  })
  async listPartnerCompanies(
    @Headers('authorization') auth?: string,
  ): Promise<PartnerCompanyListItemDto[]> {
    const { networkId } = await this.validateAuth(auth);
    return this.networkAdminService.listPartnerCompanies(networkId);
  }

  @Post('partner-companies')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create partner company' })
  @ApiResponse({
    status: 201,
    description: 'Partner company created',
    type: PartnerCompanyListItemDto,
  })
  async createPartnerCompany(
    @Body() dto: CreatePartnerCompanyDto,
    @Headers('authorization') auth?: string,
  ): Promise<PartnerCompanyListItemDto> {
    const { networkId } = await this.validateAuth(auth);
    return this.networkAdminService.createPartnerCompany(networkId, dto);
  }

  // =========================================================================
  // DRIVERS
  // =========================================================================

  @Get('drivers')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List drivers' })
  @ApiResponse({
    status: 200,
    description: 'List of drivers',
    type: [DriverListItemDto],
  })
  async listDrivers(
    @Headers('authorization') auth?: string,
  ): Promise<DriverListItemDto[]> {
    const { networkId } = await this.validateAuth(auth);
    return this.networkAdminService.listDrivers(networkId);
  }

  // =========================================================================
  // WASH EVENTS
  // =========================================================================

  @Get('wash-events')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List wash events' })
  @ApiResponse({
    status: 200,
    description: 'List of wash events',
    type: [WashEventListItemDto],
  })
  async listWashEvents(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Headers('authorization') auth?: string,
  ): Promise<WashEventListItemDto[]> {
    const { networkId } = await this.validateAuth(auth);
    return this.networkAdminService.listWashEvents(networkId, {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  // =========================================================================
  // SERVICE PACKAGES
  // =========================================================================

  @Get('service-packages')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List service packages' })
  @ApiResponse({
    status: 200,
    description: 'List of service packages',
  })
  async listServicePackages(
    @Headers('authorization') auth?: string,
  ): Promise<any[]> {
    const { networkId } = await this.validateAuth(auth);
    return this.networkAdminService.listServicePackages(networkId);
  }

  @Post('service-packages')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create service package' })
  @ApiResponse({
    status: 201,
    description: 'Service package created',
  })
  async createServicePackage(
    @Body() dto: { name: string; code: string; description?: string },
    @Headers('authorization') auth?: string,
  ): Promise<any> {
    const { networkId } = await this.validateAuth(auth);
    return this.networkAdminService.createServicePackage(networkId, dto);
  }

  @Put('service-packages/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update service package' })
  @ApiResponse({
    status: 200,
    description: 'Service package updated',
  })
  async updateServicePackage(
    @Param('id') id: string,
    @Body() dto: { name?: string; code?: string; description?: string; isActive?: boolean },
    @Headers('authorization') auth?: string,
  ): Promise<any> {
    const { networkId } = await this.validateAuth(auth);
    return this.networkAdminService.updateServicePackage(networkId, id, dto);
  }

  @Delete('service-packages/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete service package' })
  @ApiResponse({ status: 204, description: 'Service package deleted' })
  async deleteServicePackage(
    @Param('id') id: string,
    @Headers('authorization') auth?: string,
  ): Promise<void> {
    const { networkId } = await this.validateAuth(auth);
    return this.networkAdminService.deleteServicePackage(networkId, id);
  }

  // =========================================================================
  // PRICES
  // =========================================================================

  @Get('prices')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List prices' })
  @ApiResponse({
    status: 200,
    description: 'List of prices',
  })
  async listPrices(
    @Headers('authorization') auth?: string,
  ): Promise<any[]> {
    const { networkId } = await this.validateAuth(auth);
    return this.networkAdminService.listPrices(networkId);
  }

  @Post('prices')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create price' })
  @ApiResponse({
    status: 201,
    description: 'Price created',
  })
  async createPrice(
    @Body() dto: { servicePackageId: string; vehicleType: string; price: number },
    @Headers('authorization') auth?: string,
  ): Promise<any> {
    const { networkId } = await this.validateAuth(auth);
    return this.networkAdminService.createPrice(networkId, dto);
  }

  @Put('prices/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update price' })
  @ApiResponse({
    status: 200,
    description: 'Price updated',
  })
  async updatePrice(
    @Param('id') id: string,
    @Body() dto: { servicePackageId?: string; vehicleType?: string; price?: number },
    @Headers('authorization') auth?: string,
  ): Promise<any> {
    const { networkId } = await this.validateAuth(auth);
    return this.networkAdminService.updatePrice(networkId, id, dto);
  }

  @Delete('prices/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete price' })
  @ApiResponse({ status: 204, description: 'Price deleted' })
  async deletePrice(
    @Param('id') id: string,
    @Headers('authorization') auth?: string,
  ): Promise<void> {
    const { networkId } = await this.validateAuth(auth);
    return this.networkAdminService.deletePrice(networkId, id);
  }

  // =========================================================================
  // SETTINGS
  // =========================================================================

  @Get('settings')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get network settings' })
  @ApiResponse({
    status: 200,
    description: 'Network settings',
  })
  async getSettings(
    @Headers('authorization') auth?: string,
  ): Promise<any> {
    const { networkId } = await this.validateAuth(auth);
    return this.networkAdminService.getSettings(networkId);
  }

  @Put('settings')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update network settings' })
  @ApiResponse({
    status: 200,
    description: 'Network settings updated',
  })
  async updateSettings(
    @Body() dto: any,
    @Headers('authorization') auth?: string,
  ): Promise<any> {
    const { networkId } = await this.validateAuth(auth);
    return this.networkAdminService.updateSettings(networkId, dto);
  }

  // =========================================================================
  // VAT RATES
  // =========================================================================

  @Get('vat-rates')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List VAT rates' })
  @ApiResponse({
    status: 200,
    description: 'List of VAT rates',
  })
  async listVatRates(
    @Headers('authorization') auth?: string,
  ): Promise<any[]> {
    const { networkId } = await this.validateAuth(auth);
    return this.networkAdminService.listVatRates(networkId);
  }

  @Post('vat-rates')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create VAT rate' })
  @ApiResponse({
    status: 201,
    description: 'VAT rate created',
  })
  async createVatRate(
    @Body() dto: { name: string; rate: number; code?: string; isDefault?: boolean },
    @Headers('authorization') auth?: string,
  ): Promise<any> {
    const { networkId } = await this.validateAuth(auth);
    return this.networkAdminService.createVatRate(networkId, dto);
  }

  @Put('vat-rates/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update VAT rate' })
  @ApiResponse({
    status: 200,
    description: 'VAT rate updated',
  })
  async updateVatRate(
    @Param('id') id: string,
    @Body() dto: { name?: string; rate?: number; code?: string; isDefault?: boolean; isActive?: boolean },
    @Headers('authorization') auth?: string,
  ): Promise<any> {
    const { networkId } = await this.validateAuth(auth);
    return this.networkAdminService.updateVatRate(networkId, id, dto);
  }

  @Delete('vat-rates/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete VAT rate' })
  @ApiResponse({ status: 204, description: 'VAT rate deleted' })
  async deleteVatRate(
    @Param('id') id: string,
    @Headers('authorization') auth?: string,
  ): Promise<void> {
    const { networkId } = await this.validateAuth(auth);
    return this.networkAdminService.deleteVatRate(networkId, id);
  }

  // =========================================================================
  // CURRENCIES
  // =========================================================================

  @Get('currencies')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List currencies' })
  @ApiResponse({
    status: 200,
    description: 'List of currencies',
  })
  async listCurrencies(
    @Headers('authorization') auth?: string,
  ): Promise<any[]> {
    const { networkId } = await this.validateAuth(auth);
    return this.networkAdminService.listCurrencies(networkId);
  }

  @Post('currencies')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add currency' })
  @ApiResponse({
    status: 201,
    description: 'Currency added',
  })
  async addCurrency(
    @Body() dto: { currencyCode: string; currencyName?: string; currencySymbol?: string; isDefault?: boolean },
    @Headers('authorization') auth?: string,
  ): Promise<any> {
    const { networkId } = await this.validateAuth(auth);
    return this.networkAdminService.addCurrency(networkId, dto);
  }

  @Put('currencies/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update currency' })
  @ApiResponse({
    status: 200,
    description: 'Currency updated',
  })
  async updateCurrency(
    @Param('id') id: string,
    @Body() dto: { currencyName?: string; currencySymbol?: string; isDefault?: boolean; isActive?: boolean },
    @Headers('authorization') auth?: string,
  ): Promise<any> {
    const { networkId } = await this.validateAuth(auth);
    return this.networkAdminService.updateCurrency(networkId, id, dto);
  }

  @Delete('currencies/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove currency' })
  @ApiResponse({ status: 204, description: 'Currency removed' })
  async removeCurrency(
    @Param('id') id: string,
    @Headers('authorization') auth?: string,
  ): Promise<void> {
    const { networkId } = await this.validateAuth(auth);
    return this.networkAdminService.removeCurrency(networkId, id);
  }

  // =========================================================================
  // STRIPE SUBSCRIPTION
  // =========================================================================

  @Get('subscription')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current subscription details' })
  @ApiResponse({
    status: 200,
    description: 'Subscription details',
    type: SubscriptionDetailsDto,
  })
  async getSubscription(
    @Headers('authorization') auth?: string,
  ): Promise<SubscriptionDetailsDto | null> {
    const { networkId } = await this.validateAuth(auth);
    return this.stripeService.getSubscription(networkId);
  }

  @Post('create-checkout-session')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create Stripe checkout session for subscription' })
  @ApiResponse({
    status: 200,
    description: 'Checkout session created',
    type: CheckoutSessionResponseDto,
  })
  async createCheckoutSession(
    @Body() dto: CreateCheckoutSessionDto,
    @Headers('authorization') auth?: string,
  ): Promise<CheckoutSessionResponseDto> {
    const { networkId } = await this.validateAuth(auth);
    return this.stripeService.createCheckoutSession(
      networkId,
      dto.successUrl,
      dto.cancelUrl,
    );
  }

  @Post('billing-portal')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create Stripe billing portal session' })
  @ApiResponse({
    status: 200,
    description: 'Billing portal session created',
    type: BillingPortalResponseDto,
  })
  async createBillingPortal(
    @Body() dto: CreateBillingPortalDto,
    @Headers('authorization') auth?: string,
  ): Promise<BillingPortalResponseDto> {
    const { networkId } = await this.validateAuth(auth);
    return this.stripeService.createBillingPortalSession(networkId, dto.returnUrl);
  }

  @Post('cancel-subscription')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel subscription at period end' })
  @ApiResponse({
    status: 200,
    description: 'Subscription cancellation scheduled',
  })
  async cancelSubscription(
    @Headers('authorization') auth?: string,
  ): Promise<{ message: string }> {
    const { networkId } = await this.validateAuth(auth);
    await this.stripeService.cancelSubscription(networkId, true);
    return { message: 'Az előfizetés a jelenlegi időszak végén megszűnik' };
  }

  @Post('reactivate-subscription')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reactivate cancelled subscription' })
  @ApiResponse({
    status: 200,
    description: 'Subscription reactivated',
  })
  async reactivateSubscription(
    @Headers('authorization') auth?: string,
  ): Promise<{ message: string }> {
    const { networkId } = await this.validateAuth(auth);
    await this.stripeService.reactivateSubscription(networkId);
    return { message: 'Az előfizetés újra aktív' };
  }

  // =========================================================================
  // LOCATION OPERATORS
  // =========================================================================

  @Get('locations/:locationId/operators')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List location operators' })
  @ApiResponse({
    status: 200,
    description: 'List of operators for location',
  })
  async listLocationOperators(
    @Param('locationId') locationId: string,
    @Headers('authorization') auth?: string,
  ): Promise<any[]> {
    const { networkId } = await this.validateAuth(auth);
    return this.networkAdminService.listLocationOperators(networkId, locationId);
  }

  @Post('locations/:locationId/operators')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create location operator' })
  @ApiResponse({
    status: 201,
    description: 'Operator created',
  })
  async createLocationOperator(
    @Param('locationId') locationId: string,
    @Body() dto: { name: string; pin: string },
    @Headers('authorization') auth?: string,
  ): Promise<any> {
    const { networkId } = await this.validateAuth(auth);
    return this.networkAdminService.createLocationOperator(networkId, locationId, dto);
  }

  @Put('operators/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update operator' })
  @ApiResponse({
    status: 200,
    description: 'Operator updated',
  })
  async updateOperator(
    @Param('id') id: string,
    @Body() dto: { name?: string; pin?: string; isActive?: boolean },
    @Headers('authorization') auth?: string,
  ): Promise<any> {
    const { networkId } = await this.validateAuth(auth);
    return this.networkAdminService.updateOperator(networkId, id, dto);
  }

  @Delete('operators/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete operator' })
  @ApiResponse({ status: 204, description: 'Operator deleted' })
  async deleteOperator(
    @Param('id') id: string,
    @Headers('authorization') auth?: string,
  ): Promise<void> {
    const { networkId } = await this.validateAuth(auth);
    return this.networkAdminService.deleteOperator(networkId, id);
  }

  // =========================================================================
  // WASH DELETE REQUESTS
  // =========================================================================

  @Get('delete-requests')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List pending delete requests' })
  @ApiResponse({
    status: 200,
    description: 'List of pending delete requests',
  })
  async listDeleteRequests(
    @Query('status') status?: string,
    @Headers('authorization') auth?: string,
  ): Promise<any[]> {
    const { networkId } = await this.validateAuth(auth);
    return this.networkAdminService.listDeleteRequests(networkId, status || 'PENDING');
  }

  @Post('delete-requests/:id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Approve delete request' })
  @ApiResponse({
    status: 200,
    description: 'Delete request approved',
  })
  async approveDeleteRequest(
    @Param('id') id: string,
    @Body() dto: { note?: string },
    @Headers('authorization') auth?: string,
  ): Promise<any> {
    const { networkId, adminId } = await this.validateAuth(auth);
    return this.networkAdminService.approveDeleteRequest(networkId, id, adminId, dto.note);
  }

  @Post('delete-requests/:id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reject delete request' })
  @ApiResponse({
    status: 200,
    description: 'Delete request rejected',
  })
  async rejectDeleteRequest(
    @Param('id') id: string,
    @Body() dto: { note?: string },
    @Headers('authorization') auth?: string,
  ): Promise<any> {
    const { networkId, adminId } = await this.validateAuth(auth);
    return this.networkAdminService.rejectDeleteRequest(networkId, id, adminId, dto.note);
  }
}
