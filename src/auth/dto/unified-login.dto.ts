import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class UnifiedLoginDto {
  @ApiProperty({ example: 'user@example.com', description: 'Email address' })
  @IsEmail({}, { message: 'Érvényes email címet adj meg' })
  email: string;

  @ApiProperty({ example: 'password123', description: 'Password' })
  @IsString()
  @MinLength(1, { message: 'Jelszó megadása kötelező' })
  password: string;
}

export type UserRole =
  | 'platform_admin'
  | 'network_admin'
  | 'operator'
  | 'partner'
  | 'driver';

export interface FoundUser {
  role: UserRole;
  id: string;
  email: string;
  name: string;
  // Role-specific data
  networkId?: string;
  networkName?: string;
  networkSlug?: string;
  locationId?: string;
  locationName?: string;
  partnerId?: string;
  partnerName?: string;
  // Platform admin specific
  platformRole?: string;
}

export class UnifiedLoginResponseDto {
  @ApiProperty({ description: 'Whether multiple roles were found for this email' })
  multipleRoles: boolean;

  @ApiProperty({ description: 'Available roles if multiple found', type: [Object], required: false })
  availableRoles?: FoundUser[];

  @ApiProperty({ description: 'Selected role (if only one or after selection)', required: false })
  selectedRole?: FoundUser;

  @ApiProperty({ description: 'JWT access token (only when single role or role selected)', required: false })
  accessToken?: string;

  @ApiProperty({ description: 'JWT refresh token (only when single role or role selected)', required: false })
  refreshToken?: string;

  @ApiProperty({ description: 'Token expiry in seconds', required: false })
  expiresIn?: number;

  @ApiProperty({ description: 'Redirect URL for the selected role', required: false })
  redirectUrl?: string;
}

export class SelectRoleDto {
  @ApiProperty({ description: 'The role to select from available options' })
  @IsString()
  role: UserRole;

  @ApiProperty({ description: 'The entity ID for the selected role' })
  @IsString()
  entityId: string;

  @ApiProperty({ description: 'Temporary token received from unified-login with multiple roles' })
  @IsString()
  tempToken: string;
}

export class SelectRoleResponseDto {
  @ApiProperty({ description: 'JWT access token' })
  accessToken: string;

  @ApiProperty({ description: 'JWT refresh token' })
  refreshToken: string;

  @ApiProperty({ description: 'Token expiry in seconds' })
  expiresIn: number;

  @ApiProperty({ description: 'Redirect URL for the selected role' })
  redirectUrl: string;

  @ApiProperty({ description: 'Selected role details' })
  selectedRole: FoundUser;
}
