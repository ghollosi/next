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
  Res,
  Req,
} from '@nestjs/common';
import { LoginThrottle, SensitiveThrottle } from '../common/throttler/login-throttle.decorator';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
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
  LocationOpeningHoursDto,
  LocationOpeningHoursResponseDto,
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
    private readonly configService: ConfigService,
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
  @LoginThrottle() // SECURITY: Brute force protection - 5 attempts per minute
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Network admin login' })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: NetworkAdminLoginResponseDto,
  })
  async login(
    @Body() dto: NetworkAdminLoginDto,
    @Req() req: Request,
  ): Promise<NetworkAdminLoginResponseDto> {
    const ipAddress = req.ip || req.socket?.remoteAddress;
    const userAgent = req.get('user-agent');
    return this.networkAdminService.login(dto, ipAddress, userAgent);
  }

  // =========================================================================
  // REGISTRATION
  // =========================================================================

  @Post('register')
  @SensitiveThrottle() // SECURITY: Registration limit - 10 attempts per minute
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
  @ApiOperation({ summary: 'Verify email address (POST)' })
  @ApiResponse({
    status: 200,
    description: 'Email verified successfully',
  })
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<{ success: boolean; message: string }> {
    return this.networkAdminService.verifyEmail(dto.token);
  }

  @Get('verify-email')
  @ApiOperation({ summary: 'Verify email address from link (GET)' })
  @ApiResponse({
    status: 302,
    description: 'Redirects to frontend with result',
  })
  async verifyEmailGet(
    @Query('token') token: string,
    @Res() res: Response,
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'https://app.vemiax.com';

    try {
      const result = await this.networkAdminService.verifyEmail(token);
      // Redirect to network admin login with success message
      res.redirect(`${frontendUrl}/network-admin?verified=true&message=${encodeURIComponent(result.message)}`);
    } catch (error) {
      // Redirect with error message
      const errorMessage = error.message || 'Email megerősítés sikertelen';
      res.redirect(`${frontendUrl}/network-admin?verified=false&error=${encodeURIComponent(errorMessage)}`);
    }
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
  // LOCATION OPENING HOURS
  // =========================================================================

  @Get('locations/:id/opening-hours')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get location opening hours' })
  @ApiResponse({
    status: 200,
    description: 'Location opening hours',
    type: LocationOpeningHoursResponseDto,
  })
  async getLocationOpeningHours(
    @Param('id') id: string,
    @Headers('authorization') auth?: string,
  ): Promise<LocationOpeningHoursResponseDto> {
    const { networkId } = await this.validateAuth(auth);
    return this.networkAdminService.getLocationOpeningHours(networkId, id);
  }

  @Put('locations/:id/opening-hours')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update location opening hours' })
  @ApiResponse({
    status: 200,
    description: 'Opening hours updated',
    type: LocationOpeningHoursResponseDto,
  })
  async updateLocationOpeningHours(
    @Param('id') id: string,
    @Body() dto: LocationOpeningHoursDto,
    @Headers('authorization') auth?: string,
  ): Promise<LocationOpeningHoursResponseDto> {
    const { networkId } = await this.validateAuth(auth);
    return this.networkAdminService.updateLocationOpeningHours(networkId, id, dto.hours);
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

  @Post('test-email')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Test email configuration' })
  @ApiResponse({
    status: 200,
    description: 'Email test result',
  })
  async testEmail(
    @Body() dto: { testEmail: string },
    @Headers('authorization') auth?: string,
  ): Promise<{ success: boolean; message: string; provider?: string }> {
    const { networkId } = await this.validateAuth(auth);
    return this.networkAdminService.testEmailConfig(networkId, dto.testEmail);
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

  // ==========================================================================
  // AUDIT LOGS
  // ==========================================================================

  @Get('audit-logs')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get audit logs' })
  @ApiResponse({
    status: 200,
    description: 'List of audit logs',
  })
  async getAuditLogs(
    @Query('action') action?: string,
    @Query('actorType') actorType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Headers('authorization') auth?: string,
  ): Promise<any> {
    const { networkId } = await this.validateAuth(auth);
    return this.networkAdminService.getAuditLogs(networkId, {
      action: action as any,
      actorType: actorType as any,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate + 'T23:59:59') : undefined,
      limit: limit ? parseInt(limit, 10) : 100,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }

  @Get('audit-logs/wash-event/:washEventId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get audit logs for a specific wash event' })
  @ApiResponse({
    status: 200,
    description: 'List of audit logs for wash event',
  })
  async getWashEventAuditLogs(
    @Param('washEventId') washEventId: string,
    @Headers('authorization') auth?: string,
  ): Promise<any> {
    const { networkId } = await this.validateAuth(auth);
    return this.networkAdminService.getWashEventAuditLogs(networkId, washEventId);
  }

  // =========================================================================
  // LOCATION SERVICES
  // =========================================================================

  @Get('locations/:locationId/services')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List services available at a location' })
  @ApiResponse({
    status: 200,
    description: 'List of services for location',
  })
  async listLocationServices(
    @Param('locationId') locationId: string,
    @Headers('authorization') auth?: string,
  ): Promise<any[]> {
    const { networkId } = await this.validateAuth(auth);
    return this.networkAdminService.listLocationServices(networkId, locationId);
  }

  @Post('locations/:locationId/services')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add service to location' })
  @ApiResponse({
    status: 201,
    description: 'Service added to location',
  })
  async addLocationService(
    @Param('locationId') locationId: string,
    @Body() dto: { servicePackageId: string },
    @Headers('authorization') auth?: string,
  ): Promise<any> {
    const { networkId } = await this.validateAuth(auth);
    return this.networkAdminService.addLocationService(networkId, locationId, dto.servicePackageId);
  }

  @Delete('locations/:locationId/services/:servicePackageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove service from location' })
  @ApiResponse({ status: 204, description: 'Service removed from location' })
  async removeLocationService(
    @Param('locationId') locationId: string,
    @Param('servicePackageId') servicePackageId: string,
    @Headers('authorization') auth?: string,
  ): Promise<void> {
    const { networkId } = await this.validateAuth(auth);
    return this.networkAdminService.removeLocationService(networkId, locationId, servicePackageId);
  }

  // =========================================================================
  // INVOICES
  // =========================================================================

  @Get('invoices')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List invoices with optional filters' })
  @ApiResponse({
    status: 200,
    description: 'List of invoices',
  })
  async listInvoices(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: string,
    @Query('partnerCompanyId') partnerCompanyId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Headers('authorization') auth?: string,
  ): Promise<any> {
    const { networkId } = await this.validateAuth(auth);
    return this.networkAdminService.listInvoices(networkId, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate + 'T23:59:59') : undefined,
      status: status as any,
      partnerCompanyId,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }

  @Get('invoices/summary')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get invoice summary statistics' })
  @ApiResponse({
    status: 200,
    description: 'Invoice summary',
  })
  async getInvoiceSummary(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Headers('authorization') auth?: string,
  ): Promise<any> {
    const { networkId } = await this.validateAuth(auth);
    return this.networkAdminService.getInvoiceSummary(networkId, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate + 'T23:59:59') : undefined,
    });
  }

  @Get('invoices/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get invoice details' })
  @ApiResponse({
    status: 200,
    description: 'Invoice details',
  })
  async getInvoice(
    @Param('id') id: string,
    @Headers('authorization') auth?: string,
  ): Promise<any> {
    const { networkId } = await this.validateAuth(auth);
    return this.networkAdminService.getInvoice(networkId, id);
  }

  @Post('invoices/prepare')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Prepare invoice for a partner company' })
  @ApiResponse({
    status: 201,
    description: 'Invoice prepared (DRAFT status)',
  })
  async prepareInvoice(
    @Body() dto: {
      partnerCompanyId: string;
      startDate: string;
      endDate: string;
      paymentMethod?: string;
      dueDays?: number;
    },
    @Headers('authorization') auth?: string,
  ): Promise<any> {
    const { networkId } = await this.validateAuth(auth);
    return this.networkAdminService.prepareInvoice(networkId, {
      ...dto,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate + 'T23:59:59'),
    });
  }

  @Post('invoices/:id/issue')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Issue prepared invoice (send to invoicing provider)' })
  @ApiResponse({
    status: 200,
    description: 'Invoice issued',
  })
  async issueInvoice(
    @Param('id') id: string,
    @Headers('authorization') auth?: string,
  ): Promise<any> {
    const { networkId, adminId } = await this.validateAuth(auth);
    return this.networkAdminService.issueInvoice(networkId, id, adminId);
  }

  @Post('invoices/:id/mark-paid')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark invoice as paid' })
  @ApiResponse({
    status: 200,
    description: 'Invoice marked as paid',
  })
  async markInvoicePaid(
    @Param('id') id: string,
    @Body() dto: { paidDate?: string; paymentMethod?: string },
    @Headers('authorization') auth?: string,
  ): Promise<any> {
    const { networkId, adminId } = await this.validateAuth(auth);
    return this.networkAdminService.markInvoicePaid(networkId, id, adminId, {
      paidDate: dto.paidDate ? new Date(dto.paidDate) : new Date(),
      paymentMethod: dto.paymentMethod,
    });
  }

  @Post('invoices/:id/cancel')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel/storno invoice' })
  @ApiResponse({
    status: 200,
    description: 'Invoice cancelled',
  })
  async cancelInvoice(
    @Param('id') id: string,
    @Body() dto: { reason?: string },
    @Headers('authorization') auth?: string,
  ): Promise<any> {
    const { networkId, adminId } = await this.validateAuth(auth);
    return this.networkAdminService.cancelInvoice(networkId, id, adminId, dto.reason);
  }

  @Delete('invoices/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete draft invoice' })
  @ApiResponse({ status: 204, description: 'Invoice deleted' })
  async deleteInvoice(
    @Param('id') id: string,
    @Headers('authorization') auth?: string,
  ): Promise<void> {
    const { networkId } = await this.validateAuth(auth);
    return this.networkAdminService.deleteInvoice(networkId, id);
  }

  @Get('invoices/unbilled-events')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get unbilled wash events for a partner' })
  @ApiResponse({
    status: 200,
    description: 'Unbilled wash events',
  })
  async getUnbilledEvents(
    @Query('partnerCompanyId') partnerCompanyId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Headers('authorization') auth?: string,
  ): Promise<any> {
    const { networkId } = await this.validateAuth(auth);
    return this.networkAdminService.getUnbilledEvents(networkId, partnerCompanyId, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate + 'T23:59:59') : undefined,
    });
  }

  // =========================================================================
  // REPORTS
  // =========================================================================

  @Get('reports/wash-statistics')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get wash statistics report' })
  @ApiResponse({
    status: 200,
    description: 'Wash statistics',
  })
  async getWashStatistics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('locationId') locationId?: string,
    @Query('partnerCompanyId') partnerCompanyId?: string,
    @Query('groupBy') groupBy?: string,
    @Headers('authorization') auth?: string,
  ): Promise<any> {
    const { networkId } = await this.validateAuth(auth);
    return this.networkAdminService.getWashStatistics(networkId, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate + 'T23:59:59') : undefined,
      locationId,
      partnerCompanyId,
      groupBy: groupBy as 'day' | 'week' | 'month' | 'location' | 'partner',
    });
  }

  @Get('reports/revenue')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get revenue report' })
  @ApiResponse({
    status: 200,
    description: 'Revenue report',
  })
  async getRevenueReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('locationId') locationId?: string,
    @Query('partnerCompanyId') partnerCompanyId?: string,
    @Query('groupBy') groupBy?: string,
    @Headers('authorization') auth?: string,
  ): Promise<any> {
    const { networkId } = await this.validateAuth(auth);
    return this.networkAdminService.getRevenueReport(networkId, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate + 'T23:59:59') : undefined,
      locationId,
      partnerCompanyId,
      groupBy: groupBy as 'day' | 'week' | 'month' | 'location' | 'partner' | 'service',
    });
  }

  @Get('reports/location-performance')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get location performance report' })
  @ApiResponse({
    status: 200,
    description: 'Location performance',
  })
  async getLocationPerformance(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Headers('authorization') auth?: string,
  ): Promise<any> {
    const { networkId } = await this.validateAuth(auth);
    return this.networkAdminService.getLocationPerformance(networkId, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate + 'T23:59:59') : undefined,
    });
  }

  @Get('reports/partner-summary')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get partner company summary report' })
  @ApiResponse({
    status: 200,
    description: 'Partner company summary',
  })
  async getPartnerSummary(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Headers('authorization') auth?: string,
  ): Promise<any> {
    const { networkId } = await this.validateAuth(auth);
    return this.networkAdminService.getPartnerSummary(networkId, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate + 'T23:59:59') : undefined,
    });
  }

  @Get('reports/service-breakdown')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get service package breakdown report' })
  @ApiResponse({
    status: 200,
    description: 'Service breakdown',
  })
  async getServiceBreakdown(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('locationId') locationId?: string,
    @Headers('authorization') auth?: string,
  ): Promise<any> {
    const { networkId } = await this.validateAuth(auth);
    return this.networkAdminService.getServiceBreakdown(networkId, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate + 'T23:59:59') : undefined,
      locationId,
    });
  }

  @Get('reports/export/csv')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Export wash events to CSV' })
  @ApiResponse({
    status: 200,
    description: 'CSV data',
  })
  async exportWashEventsCsv(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('locationId') locationId?: string,
    @Query('partnerCompanyId') partnerCompanyId?: string,
    @Query('status') status?: string,
    @Headers('authorization') auth?: string,
  ): Promise<any> {
    const { networkId } = await this.validateAuth(auth);
    return this.networkAdminService.exportWashEventsCsv(networkId, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate + 'T23:59:59') : undefined,
      locationId,
      partnerCompanyId,
      status,
    });
  }
}
