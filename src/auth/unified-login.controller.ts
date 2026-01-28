import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { LoginThrottle } from '../common/throttler/login-throttle.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { UnifiedLoginService } from './unified-login.service';
import {
  UnifiedLoginDto,
  UnifiedLoginResponseDto,
  SelectRoleDto,
  SelectRoleResponseDto,
} from './dto/unified-login.dto';

@ApiTags('auth')
@Controller('auth')
export class UnifiedLoginController {
  constructor(private readonly unifiedLoginService: UnifiedLoginService) {}

  @Post('unified-login')
  @LoginThrottle() // SECURITY: Brute force protection - 5 attempts per minute
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Unified login for all user types',
    description: `
      Single login endpoint for all user types:
      - Platform Admin
      - Network Admin
      - Location Operator
      - Partner Admin
      - Driver

      If the email has multiple roles, returns a list of available roles for selection.
      If the email has only one role, returns tokens directly.
    `,
  })
  @ApiBody({ type: UnifiedLoginDto })
  @ApiResponse({
    status: 200,
    description: 'Login successful or role selection required',
    type: UnifiedLoginResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 429, description: 'Too many login attempts' })
  async unifiedLogin(
    @Body() dto: UnifiedLoginDto,
    @Req() req: Request,
  ): Promise<UnifiedLoginResponseDto> {
    const ipAddress = req.ip || req.socket?.remoteAddress;
    const userAgent = req.get('user-agent');

    return this.unifiedLoginService.login(dto, ipAddress, userAgent);
  }

  @Post('select-role')
  @LoginThrottle() // SECURITY: Brute force protection
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Select a role after unified login returned multiple options',
    description: `
      After unified-login returns multipleRoles: true, use this endpoint
      to select which role to use for this session.

      Requires the tempToken from the unified-login response.
    `,
  })
  @ApiBody({ type: SelectRoleDto })
  @ApiResponse({
    status: 200,
    description: 'Role selected, tokens returned',
    type: SelectRoleResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired temp token' })
  async selectRole(
    @Body() dto: SelectRoleDto,
    @Req() req: Request,
  ): Promise<SelectRoleResponseDto> {
    const ipAddress = req.ip || req.socket?.remoteAddress;
    const userAgent = req.get('user-agent');

    return this.unifiedLoginService.selectRole(dto, ipAddress, userAgent);
  }
}
