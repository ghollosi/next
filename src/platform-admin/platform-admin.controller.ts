import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Headers,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
  ApiBearerAuth,
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

@ApiTags('Platform Admin')
@Controller('platform-admin')
export class PlatformAdminController {
  constructor(private readonly platformAdminService: PlatformAdminService) {}

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
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Platform admin login' })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: PlatformLoginResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: PlatformLoginDto): Promise<PlatformLoginResponseDto> {
    return this.platformAdminService.login(dto);
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
    await this.validateOwner(auth);
    return this.platformAdminService.createAdmin(dto);
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
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset (public)' })
  @ApiResponse({ status: 200, description: 'Reset email sent if account exists' })
  async requestPasswordReset(
    @Body() dto: RequestPasswordResetDto,
  ): Promise<{ message: string }> {
    return this.platformAdminService.requestPasswordReset(dto);
  }

  @Post('reset-password')
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
    await this.validateAuth(auth);
    return this.platformAdminService.updateNetwork(id, dto);
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
    await this.validateOwner(auth);
    return this.platformAdminService.deleteNetwork(id);
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
}
