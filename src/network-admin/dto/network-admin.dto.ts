import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsOptional,
  MinLength,
  MaxLength,
  IsNumber,
  IsBoolean,
  IsArray,
  Matches,
} from 'class-validator';

// ============================================================================
// AUTH DTOs
// ============================================================================

export class NetworkAdminLoginDto {
  @ApiProperty({ description: 'Admin email' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Admin password' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ description: 'Network slug' })
  @IsString()
  slug: string;
}

export class NetworkAdminLoginResponseDto {
  @ApiProperty({ description: 'JWT access token' })
  accessToken: string;

  @ApiProperty({ description: 'Admin ID' })
  adminId: string;

  @ApiProperty({ description: 'Admin name' })
  name: string;

  @ApiProperty({ description: 'Admin email' })
  email: string;

  @ApiProperty({ description: 'Admin role' })
  role: string;

  @ApiProperty({ description: 'Network ID' })
  networkId: string;

  @ApiProperty({ description: 'Network name' })
  networkName: string;

  @ApiProperty({ description: 'Network slug' })
  networkSlug: string;

  @ApiPropertyOptional({ description: 'Subscription status' })
  subscriptionStatus?: string;

  @ApiPropertyOptional({ description: 'Trial ends at' })
  trialEndsAt?: Date;
}

// ============================================================================
// REGISTRATION DTOs
// ============================================================================

export class NetworkRegisterDto {
  @ApiProperty({ description: 'Network name (company/business name)' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  networkName: string;

  @ApiProperty({ description: 'Network slug (URL identifier, lowercase, no spaces)' })
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-z0-9-]+$/, { message: 'A slug csak kisbetűket, számokat és kötőjelet tartalmazhat' })
  slug: string;

  @ApiProperty({ description: 'Admin name' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  adminName: string;

  @ApiProperty({ description: 'Admin email' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Admin password' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ description: 'Admin phone number' })
  @IsString()
  @MinLength(6)
  phone: string;

  @ApiPropertyOptional({ description: 'Company tax number' })
  @IsOptional()
  @IsString()
  taxNumber?: string;

  @ApiPropertyOptional({ description: 'Company address' })
  @IsOptional()
  @IsString()
  companyAddress?: string;

  @ApiPropertyOptional({ description: 'Company city' })
  @IsOptional()
  @IsString()
  companyCity?: string;

  @ApiPropertyOptional({ description: 'Company zip code' })
  @IsOptional()
  @IsString()
  companyZipCode?: string;

  @ApiPropertyOptional({ description: 'Country code (default: HU)' })
  @IsOptional()
  @IsString()
  country?: string;
}

export class NetworkRegisterResponseDto {
  @ApiProperty({ description: 'Network ID' })
  networkId: string;

  @ApiProperty({ description: 'Network name' })
  networkName: string;

  @ApiProperty({ description: 'Network slug' })
  networkSlug: string;

  @ApiProperty({ description: 'Admin ID' })
  adminId: string;

  @ApiProperty({ description: 'Admin email' })
  email: string;

  @ApiProperty({ description: 'Trial ends at' })
  trialEndsAt: Date;

  @ApiProperty({ description: 'Message' })
  message: string;
}

export class VerifyEmailDto {
  @ApiProperty({ description: 'Verification token' })
  @IsString()
  token: string;
}

export class ResendVerificationDto {
  @ApiProperty({ description: 'Email address' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Network slug' })
  @IsString()
  slug: string;
}

export class TrialStatusDto {
  @ApiProperty({ description: 'Subscription status' })
  subscriptionStatus: string;

  @ApiProperty({ description: 'Trial ends at' })
  trialEndsAt?: Date;

  @ApiProperty({ description: 'Days remaining in trial' })
  daysRemaining?: number;

  @ApiProperty({ description: 'Minutes remaining (for last day)' })
  minutesRemaining?: number;

  @ApiProperty({ description: 'Is trial expired' })
  isExpired: boolean;

  @ApiProperty({ description: 'Is in grace period (5 days after expiry)' })
  isGracePeriod: boolean;

  @ApiProperty({ description: 'Grace period ends at' })
  gracePeriodEndsAt?: Date;

  @ApiProperty({ description: 'Is fully locked (after grace period)' })
  isFullyLocked: boolean;
}

// ============================================================================
// DASHBOARD DTOs
// ============================================================================

export class NetworkDashboardDto {
  @ApiProperty()
  networkName: string;

  @ApiProperty()
  subscriptionStatus: string;

  @ApiProperty()
  trialEndsAt?: Date;

  @ApiProperty()
  totalLocations: number;

  @ApiProperty()
  totalDrivers: number;

  @ApiProperty()
  totalPartnerCompanies: number;

  @ApiProperty()
  washEventsToday: number;

  @ApiProperty()
  washEventsThisMonth: number;

  @ApiProperty()
  revenueThisMonth: number;

  @ApiProperty()
  recentWashEvents: Array<{
    id: string;
    licensePlate: string;
    driverName: string;
    locationName: string;
    totalPrice: number;
    createdAt: Date;
  }>;
}

// ============================================================================
// LOCATION DTOs
// ============================================================================

export class LocationListItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  address: string;

  @ApiProperty()
  city: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  operatorCount: number;

  @ApiProperty()
  washEventCount: number;
}

export class CreateLocationDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty()
  @IsString()
  address: string;

  @ApiProperty()
  @IsString()
  city: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ description: 'Opening hours JSON string with days of week' })
  @IsOptional()
  @IsString()
  openingHours?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;
}

export class UpdateLocationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Opening hours JSON string with days of week' })
  @IsOptional()
  @IsString()
  openingHours?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  timezone?: string;
}

// ============================================================================
// PARTNER COMPANY DTOs
// ============================================================================

export class PartnerCompanyListItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  taxNumber: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  driverCount: number;

  @ApiProperty()
  vehicleCount: number;
}

export class CreatePartnerCompanyDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @ApiProperty()
  @IsString()
  taxNumber: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  billingAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactPhone?: string;
}

// ============================================================================
// DRIVER DTOs
// ============================================================================

export class DriverListItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  phone: string;

  @ApiProperty()
  email?: string;

  @ApiProperty()
  partnerCompanyName?: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  vehicleCount: number;

  @ApiProperty()
  washEventCount: number;
}

// ============================================================================
// WASH EVENT DTOs
// ============================================================================

export class WashEventListItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  licensePlate: string;

  @ApiProperty()
  vehicleType: string;

  @ApiProperty()
  driverName: string;

  @ApiProperty()
  locationName: string;

  @ApiProperty()
  services: string[];

  @ApiProperty()
  totalPrice: number;

  @ApiProperty()
  currency: string;

  @ApiProperty()
  createdAt: Date;
}
