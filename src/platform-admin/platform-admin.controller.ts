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
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { LoginThrottle, SensitiveThrottle } from '../common/throttler/login-throttle.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { PlatformAdminService } from './platform-admin.service';
import {
  PlatformLoginDto,
  PlatformLoginResponseDto,
  CreatePlatformAdminDto,
  UpdatePlatformSettingsDto,
  PlatformSettingsResponseDto,
  CreateNetworkDto,
  UpdateNetworkDto,
  NetworkListItemDto,
  NetworkDetailDto,
  PlatformDashboardDto,
  NetworkAdminDto,
  CreateNetworkAdminDto,
  UpdateNetworkAdminDto,
  UpdatePlatformAdminDto,
  PlatformAdminListItemDto,
  RequestPasswordResetDto,
  ResetPasswordDto,
  GenerateEmergencyTokenResponseDto,
  EmergencyLoginDto,
} from './dto/platform-admin.dto';
import { PlatformRole } from '@prisma/client';
import { CompanyDataService } from '../company-data/company-data.service';

@ApiTags('Platform Admin')
@Controller('platform-admin')
export class PlatformAdminController {
  constructor(
    private readonly platformAdminService: PlatformAdminService,
    private readonly companyDataService: CompanyDataService,
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

  private async validateOwner(authHeader: string | undefined): Promise<{
    adminId: string;
    role: PlatformRole;
  }> {
    const result = await this.validateAuth(authHeader);

    if (result.role !== PlatformRole.PLATFORM_OWNER) {
      throw new UnauthorizedException('Csak Platform Owner jogosultság szükséges');
    }

    return result;
  }

  // =========================================================================
  // AUTH ENDPOINTS
  // =========================================================================

  @Post('login')
  @LoginThrottle() // SECURITY: Brute force protection - 5 attempts per minute
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Platform admin login' })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: PlatformLoginResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body() dto: PlatformLoginDto,
    @Req() req: Request,
  ): Promise<PlatformLoginResponseDto> {
    const ipAddress = req.ip || req.socket?.remoteAddress;
    const userAgent = req.get('user-agent');
    return this.platformAdminService.login(dto, ipAddress, userAgent);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiResponse({
    status: 200,
    description: 'Tokens refreshed successfully',
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refreshTokens(
    @Body() body: { refreshToken: string },
    @Req() req: Request,
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const ipAddress = req.ip || req.socket?.remoteAddress;
    const userAgent = req.get('user-agent');
    return this.platformAdminService.refreshTokens(body.refreshToken, ipAddress, userAgent);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and revoke refresh token' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout(@Body() body: { refreshToken: string }): Promise<{ success: boolean }> {
    await this.platformAdminService.logout(body.refreshToken);
    return { success: true };
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout from all devices (revoke all refresh tokens)' })
  @ApiResponse({ status: 200, description: 'All sessions terminated' })
  async logoutAll(
    @Headers('authorization') auth?: string,
  ): Promise<{ success: boolean; revokedCount: number }> {
    const { adminId } = await this.validateAuth(auth);
    const revokedCount = await this.platformAdminService.logoutAll(adminId);
    return { success: true, revokedCount };
  }

  @Post('admins')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create new platform admin (Owner only)' })
  @ApiResponse({ status: 201, description: 'Admin created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async createAdmin(
    @Body() dto: CreatePlatformAdminDto,
    @Headers('authorization') auth?: string,
  ): Promise<{ id: string; email: string }> {
    const { adminId } = await this.validateOwner(auth);
    return this.platformAdminService.createAdmin(dto, adminId);
  }

  @Get('admins')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all platform admins (Owner only)' })
  @ApiResponse({
    status: 200,
    description: 'List of platform admins',
    type: [PlatformAdminListItemDto],
  })
  async listAdmins(
    @Headers('authorization') auth?: string,
  ): Promise<PlatformAdminListItemDto[]> {
    await this.validateOwner(auth);
    return this.platformAdminService.listAdmins();
  }

  @Get('admins/:adminId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get platform admin details (Owner only)' })
  @ApiResponse({
    status: 200,
    description: 'Platform admin details',
    type: PlatformAdminListItemDto,
  })
  async getAdmin(
    @Param('adminId') adminId: string,
    @Headers('authorization') auth?: string,
  ): Promise<PlatformAdminListItemDto> {
    await this.validateOwner(auth);
    return this.platformAdminService.getAdmin(adminId);
  }

  @Put('admins/:adminId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update platform admin (Owner only)' })
  @ApiResponse({
    status: 200,
    description: 'Platform admin updated',
    type: PlatformAdminListItemDto,
  })
  async updateAdmin(
    @Param('adminId') adminId: string,
    @Body() dto: UpdatePlatformAdminDto,
    @Headers('authorization') auth?: string,
  ): Promise<PlatformAdminListItemDto> {
    const { adminId: currentAdminId } = await this.validateOwner(auth);
    return this.platformAdminService.updateAdmin(adminId, dto, currentAdminId);
  }

  @Delete('admins/:adminId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete platform admin (Owner only)' })
  @ApiResponse({ status: 204, description: 'Platform admin deleted' })
  async deleteAdmin(
    @Param('adminId') adminId: string,
    @Headers('authorization') auth?: string,
  ): Promise<void> {
    const { adminId: currentAdminId } = await this.validateOwner(auth);
    return this.platformAdminService.deleteAdmin(adminId, currentAdminId);
  }

  // =========================================================================
  // PASSWORD RESET
  // =========================================================================

  @Post('request-password-reset')
  @SensitiveThrottle() // SECURITY: Password reset limit - 10 attempts per minute
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset (public)' })
  @ApiResponse({ status: 200, description: 'Reset email sent if account exists' })
  async requestPasswordReset(
    @Body() dto: RequestPasswordResetDto,
  ): Promise<{ message: string }> {
    return this.platformAdminService.requestPasswordReset(dto);
  }

  @Post('reset-password')
  @SensitiveThrottle() // SECURITY: Password reset limit - 10 attempts per minute
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with token (public)' })
  @ApiResponse({ status: 200, description: 'Password reset successful' })
  @ApiResponse({ status: 401, description: 'Invalid or expired token' })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    return this.platformAdminService.resetPassword(dto);
  }

  // =========================================================================
  // EMERGENCY ACCESS
  // =========================================================================

  @Post('generate-emergency-token')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate emergency access token (Owner only)' })
  @ApiResponse({
    status: 200,
    description: 'Emergency token generated',
    type: GenerateEmergencyTokenResponseDto,
  })
  async generateEmergencyToken(
    @Headers('authorization') auth?: string,
  ): Promise<GenerateEmergencyTokenResponseDto> {
    const { adminId } = await this.validateOwner(auth);
    return this.platformAdminService.generateEmergencyToken(adminId);
  }

  @Post('emergency-login')
  @LoginThrottle() // SECURITY: Brute force protection - 5 attempts per minute
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with emergency token (public)' })
  @ApiResponse({
    status: 200,
    description: 'Emergency login successful',
    type: PlatformLoginResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired emergency token' })
  async emergencyLogin(
    @Body() dto: EmergencyLoginDto,
  ): Promise<PlatformLoginResponseDto> {
    return this.platformAdminService.emergencyLogin(dto);
  }

  // =========================================================================
  // DASHBOARD
  // =========================================================================

  @Get('dashboard')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get platform dashboard data' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard data',
    type: PlatformDashboardDto,
  })
  async getDashboard(
    @Headers('authorization') auth?: string,
  ): Promise<PlatformDashboardDto> {
    await this.validateAuth(auth);
    return this.platformAdminService.getDashboard();
  }

  // =========================================================================
  // REPORTS
  // =========================================================================

  @Get('reports')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get platform reports data' })
  @ApiQuery({ name: 'period', required: false, enum: ['month', 'quarter', 'year'] })
  @ApiResponse({
    status: 200,
    description: 'Reports data',
  })
  async getReports(
    @Headers('authorization') auth?: string,
    @Query('period') period?: 'month' | 'quarter' | 'year',
  ) {
    await this.validateAuth(auth);
    return this.platformAdminService.getReports(period || 'month');
  }

  // =========================================================================
  // SETTINGS
  // =========================================================================

  @Get('settings')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get platform settings' })
  @ApiResponse({
    status: 200,
    description: 'Platform settings',
    type: PlatformSettingsResponseDto,
  })
  async getSettings(
    @Headers('authorization') auth?: string,
  ): Promise<PlatformSettingsResponseDto> {
    await this.validateAuth(auth);
    return this.platformAdminService.getSettings();
  }

  @Put('settings')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update platform settings (Owner only)' })
  @ApiResponse({
    status: 200,
    description: 'Settings updated',
    type: PlatformSettingsResponseDto,
  })
  async updateSettings(
    @Body() dto: UpdatePlatformSettingsDto,
    @Headers('authorization') auth?: string,
  ): Promise<PlatformSettingsResponseDto> {
    await this.validateOwner(auth);
    return this.platformAdminService.updateSettings(dto);
  }

  // =========================================================================
  // NETWORK MANAGEMENT
  // =========================================================================

  @Get('networks')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all networks' })
  @ApiResponse({
    status: 200,
    description: 'List of networks',
    type: [NetworkListItemDto],
  })
  async listNetworks(
    @Headers('authorization') auth?: string,
  ): Promise<NetworkListItemDto[]> {
    await this.validateAuth(auth);
    return this.platformAdminService.listNetworks();
  }

  @Get('audit-logs')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get platform-level audit logs (no network)' })
  @ApiResponse({
    status: 200,
    description: 'List of platform audit logs',
  })
  async getPlatformAuditLogs(
    @Query('action') action?: string,
    @Query('actorType') actorType?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Headers('authorization') auth?: string,
  ): Promise<{ data: any[]; total: number }> {
    await this.validateOwner(auth);
    return this.platformAdminService.getPlatformAuditLogs({
      action: action as any,
      actorType: actorType as any,
      limit: limit ? parseInt(limit, 10) : 100,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }

  @Get('networks/:networkId/audit-logs')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get audit logs for a network' })
  @ApiResponse({
    status: 200,
    description: 'List of audit logs',
  })
  async getNetworkAuditLogs(
    @Param('networkId') networkId: string,
    @Query('action') action?: string,
    @Query('actorType') actorType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Headers('authorization') auth?: string,
  ): Promise<{ data: any[]; total: number }> {
    await this.validateAuth(auth);
    return this.platformAdminService.getNetworkAuditLogs(networkId, {
      action: action as any,
      actorType: actorType as any,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate + 'T23:59:59') : undefined,
      limit: limit ? parseInt(limit, 10) : 100,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }

  @Get('networks/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get network details' })
  @ApiResponse({
    status: 200,
    description: 'Network details',
    type: NetworkDetailDto,
  })
  async getNetwork(
    @Param('id') id: string,
    @Headers('authorization') auth?: string,
  ): Promise<NetworkDetailDto> {
    await this.validateAuth(auth);
    return this.platformAdminService.getNetwork(id);
  }

  @Get('networks/:id/locations')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List network locations' })
  @ApiResponse({
    status: 200,
    description: 'Network locations list',
  })
  async listNetworkLocations(
    @Param('id') id: string,
    @Headers('authorization') auth?: string,
  ): Promise<any[]> {
    await this.validateAuth(auth);
    return this.platformAdminService.listNetworkLocations(id);
  }

  @Post('networks')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create new network' })
  @ApiResponse({
    status: 201,
    description: 'Network created',
    type: NetworkDetailDto,
  })
  async createNetwork(
    @Body() dto: CreateNetworkDto,
    @Headers('authorization') auth?: string,
  ): Promise<NetworkDetailDto> {
    await this.validateAuth(auth);
    return this.platformAdminService.createNetwork(dto);
  }

  @Put('networks/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update network' })
  @ApiResponse({
    status: 200,
    description: 'Network updated',
    type: NetworkDetailDto,
  })
  async updateNetwork(
    @Param('id') id: string,
    @Body() dto: UpdateNetworkDto,
    @Headers('authorization') auth?: string,
  ): Promise<NetworkDetailDto> {
    const { adminId } = await this.validateAuth(auth);
    return this.platformAdminService.updateNetwork(id, dto, adminId);
  }

  @Delete('networks/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete network (soft delete, Owner only)' })
  @ApiResponse({ status: 204, description: 'Network deleted' })
  async deleteNetwork(
    @Param('id') id: string,
    @Headers('authorization') auth?: string,
  ): Promise<void> {
    const { adminId } = await this.validateOwner(auth);
    return this.platformAdminService.deleteNetwork(id, adminId);
  }

  // =========================================================================
  // NETWORK ADMIN MANAGEMENT
  // =========================================================================

  @Get('networks/:networkId/admins')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List network admins' })
  @ApiResponse({
    status: 200,
    description: 'List of network admins',
    type: [NetworkAdminDto],
  })
  async listNetworkAdmins(
    @Param('networkId') networkId: string,
    @Headers('authorization') auth?: string,
  ): Promise<NetworkAdminDto[]> {
    await this.validateAuth(auth);
    return this.platformAdminService.listNetworkAdmins(networkId);
  }

  @Get('networks/:networkId/admins/:adminId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get network admin details' })
  @ApiResponse({
    status: 200,
    description: 'Network admin details',
    type: NetworkAdminDto,
  })
  async getNetworkAdmin(
    @Param('networkId') networkId: string,
    @Param('adminId') adminId: string,
    @Headers('authorization') auth?: string,
  ): Promise<NetworkAdminDto> {
    await this.validateAuth(auth);
    return this.platformAdminService.getNetworkAdmin(networkId, adminId);
  }

  @Post('networks/:networkId/admins')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create network admin' })
  @ApiResponse({
    status: 201,
    description: 'Network admin created',
    type: NetworkAdminDto,
  })
  async createNetworkAdmin(
    @Param('networkId') networkId: string,
    @Body() dto: CreateNetworkAdminDto,
    @Headers('authorization') auth?: string,
  ): Promise<NetworkAdminDto> {
    await this.validateAuth(auth);
    return this.platformAdminService.createNetworkAdmin(networkId, dto);
  }

  @Put('networks/:networkId/admins/:adminId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update network admin' })
  @ApiResponse({
    status: 200,
    description: 'Network admin updated',
    type: NetworkAdminDto,
  })
  async updateNetworkAdmin(
    @Param('networkId') networkId: string,
    @Param('adminId') adminId: string,
    @Body() dto: UpdateNetworkAdminDto,
    @Headers('authorization') auth?: string,
  ): Promise<NetworkAdminDto> {
    await this.validateAuth(auth);
    return this.platformAdminService.updateNetworkAdmin(networkId, adminId, dto);
  }

  @Delete('networks/:networkId/admins/:adminId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete network admin' })
  @ApiResponse({ status: 204, description: 'Network admin deleted' })
  async deleteNetworkAdmin(
    @Param('networkId') networkId: string,
    @Param('adminId') adminId: string,
    @Headers('authorization') auth?: string,
  ): Promise<void> {
    await this.validateAuth(auth);
    return this.platformAdminService.deleteNetworkAdmin(networkId, adminId);
  }

  // =========================================================================
  // TEST EMAIL (Development only)
  // =========================================================================

  @Post('test-email')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send test email (Owner only)' })
  @ApiResponse({ status: 200, description: 'Test email sent' })
  async sendTestEmail(
    @Body() dto: { to: string },
    @Headers('authorization') auth?: string,
  ): Promise<{ success: boolean; message: string }> {
    await this.validateOwner(auth);
    return this.platformAdminService.sendTestEmail(dto.to);
  }

  @Post('test-email-all')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send test emails from all senders (info, support, noreply @vemiax.com)' })
  @ApiResponse({ status: 200, description: 'Test emails sent from multiple senders' })
  async sendTestEmailsFromAll(
    @Body() dto: { to: string },
    @Headers('authorization') auth?: string,
  ): Promise<{ results: Array<{ from: string; success: boolean; message: string }> }> {
    await this.validateOwner(auth);
    return this.platformAdminService.sendTestEmailsFromAll(dto.to);
  }

  // =========================================================================
  // PLATFORM COMPANY DATA SETTINGS (Central service for Networks)
  // =========================================================================

  @Get('company-data/providers')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get available company data providers' })
  @ApiResponse({ status: 200, description: 'List of available providers' })
  async getCompanyDataProvidersForPlatform(
    @Headers('authorization') auth?: string,
  ): Promise<any> {
    await this.validateAuth(auth);
    return this.companyDataService.getSupportedProviders();
  }

  @Get('company-data/settings')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get platform company data settings' })
  @ApiResponse({ status: 200, description: 'Platform company data settings' })
  async getPlatformCompanyDataSettings(
    @Headers('authorization') auth?: string,
  ): Promise<any> {
    await this.validateAuth(auth);
    return this.platformAdminService.getPlatformCompanyDataSettings();
  }

  @Put('company-data/settings')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update platform company data settings (Owner only)' })
  @ApiResponse({ status: 200, description: 'Settings updated' })
  async updatePlatformCompanyDataSettings(
    @Body() dto: {
      companyDataProvider: string;
      optenApiKey?: string;
      optenApiSecret?: string;
      bisnodeApiKey?: string;
      bisnodeApiSecret?: string;
      companyDataMonthlyFee?: number | null;
    },
    @Headers('authorization') auth?: string,
  ): Promise<any> {
    await this.validateOwner(auth);
    return this.platformAdminService.updatePlatformCompanyDataSettings(dto);
  }

  // =========================================================================
  // NETWORK COMPANY DATA SETTINGS
  // =========================================================================

  @Get('networks/:networkId/company-data/providers')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get available company data providers' })
  @ApiResponse({ status: 200, description: 'List of available providers' })
  async getCompanyDataProviders(
    @Param('networkId') networkId: string,
    @Headers('authorization') auth?: string,
  ): Promise<any> {
    await this.validateAuth(auth);
    return this.companyDataService.getSupportedProviders();
  }

  @Get('networks/:networkId/company-data/settings')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get network company data settings' })
  @ApiResponse({ status: 200, description: 'Network company data settings' })
  async getNetworkCompanyDataSettings(
    @Param('networkId') networkId: string,
    @Headers('authorization') auth?: string,
  ): Promise<any> {
    await this.validateAuth(auth);
    return this.platformAdminService.getNetworkCompanyDataSettings(networkId);
  }

  @Put('networks/:networkId/company-data/settings')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update network company data settings (allowCustom flag)' })
  @ApiResponse({ status: 200, description: 'Settings updated' })
  async updateNetworkCompanyDataSettings(
    @Param('networkId') networkId: string,
    @Body() dto: {
      allowCustomCompanyDataProvider?: boolean;
      companyDataProvider?: string;
      optenApiKey?: string;
      optenApiSecret?: string;
      bisnodeApiKey?: string;
      bisnodeApiSecret?: string;
    },
    @Headers('authorization') auth?: string,
  ): Promise<any> {
    await this.validateAuth(auth);
    return this.platformAdminService.updateNetworkCompanyDataSettings(networkId, dto);
  }

  @Get('networks/:networkId/company-data/connection-test')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Test company data provider connection for network' })
  @ApiResponse({ status: 200, description: 'Connection test result' })
  async testNetworkCompanyDataConnection(
    @Param('networkId') networkId: string,
    @Headers('authorization') auth?: string,
  ): Promise<any> {
    await this.validateAuth(auth);
    return this.companyDataService.validateProviderConnection(networkId);
  }

  @Get('networks/:networkId/company-data/search')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Search companies via network provider' })
  @ApiResponse({ status: 200, description: 'Search results' })
  async searchCompaniesForNetwork(
    @Param('networkId') networkId: string,
    @Query('taxNumber') taxNumber?: string,
    @Query('name') name?: string,
    @Query('query') query?: string,
    @Query('limit') limit?: string,
    @Headers('authorization') auth?: string,
  ): Promise<any> {
    await this.validateAuth(auth);
    return this.companyDataService.searchCompanies(networkId, {
      taxNumber,
      name,
      query,
      limit: limit ? parseInt(limit, 10) : 10,
    });
  }

  // =========================================================================
  // ANALYTICS (Umami proxy)
  // =========================================================================

  @Get('analytics/stats')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get landing page analytics stats' })
  @ApiQuery({ name: 'startAt', required: true, description: 'Start timestamp in ms' })
  @ApiQuery({ name: 'endAt', required: true, description: 'End timestamp in ms' })
  @ApiResponse({ status: 200, description: 'Analytics stats' })
  async getAnalyticsStats(
    @Query('startAt') startAt: string,
    @Query('endAt') endAt: string,
    @Headers('authorization') auth?: string,
  ): Promise<any> {
    await this.validateOwner(auth);
    return this.platformAdminService.getAnalyticsStats(startAt, endAt);
  }

  @Get('analytics/pageviews')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get landing page pageviews over time' })
  @ApiQuery({ name: 'startAt', required: true })
  @ApiQuery({ name: 'endAt', required: true })
  @ApiQuery({ name: 'unit', required: false, enum: ['hour', 'day', 'week', 'month'] })
  @ApiResponse({ status: 200, description: 'Pageviews data' })
  async getAnalyticsPageviews(
    @Query('startAt') startAt: string,
    @Query('endAt') endAt: string,
    @Query('unit') unit?: string,
    @Headers('authorization') auth?: string,
  ): Promise<any> {
    await this.validateOwner(auth);
    return this.platformAdminService.getAnalyticsPageviews(startAt, endAt, unit || 'day');
  }

  @Get('analytics/metrics')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get analytics metrics (countries, browsers, devices, etc)' })
  @ApiQuery({ name: 'startAt', required: true })
  @ApiQuery({ name: 'endAt', required: true })
  @ApiQuery({ name: 'type', required: true, enum: ['url', 'referrer', 'browser', 'os', 'device', 'country', 'language'] })
  @ApiResponse({ status: 200, description: 'Metrics data' })
  async getAnalyticsMetrics(
    @Query('startAt') startAt: string,
    @Query('endAt') endAt: string,
    @Query('type') type: string,
    @Headers('authorization') auth?: string,
  ): Promise<any> {
    await this.validateOwner(auth);
    return this.platformAdminService.getAnalyticsMetrics(startAt, endAt, type);
  }

  @Get('analytics/active')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current active visitors' })
  @ApiResponse({ status: 200, description: 'Active visitors count' })
  async getAnalyticsActive(
    @Headers('authorization') auth?: string,
  ): Promise<any> {
    await this.validateOwner(auth);
    return this.platformAdminService.getAnalyticsActive();
  }
}
