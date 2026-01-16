import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsUUID,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
  IsArray,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { VehicleCategory } from '@prisma/client';

export class VehicleRegistrationDto {
  @ApiProperty({ description: 'Vehicle category', enum: ['SOLO', 'TRACTOR', 'TRAILER'] })
  @IsEnum(VehicleCategory)
  category: VehicleCategory;

  @ApiProperty({ description: 'Plate number' })
  @IsString()
  @MinLength(2)
  @MaxLength(20)
  plateNumber: string;

  @ApiPropertyOptional({ description: 'Plate state/region' })
  @IsOptional()
  @IsString()
  plateState?: string;

  @ApiPropertyOptional({ description: 'Nickname for the vehicle' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  nickname?: string;
}

export class SelfRegisterDto {
  @ApiPropertyOptional({ description: 'Partner company ID (optional for private customers)' })
  @IsOptional()
  @IsUUID()
  partnerCompanyId?: string;

  @ApiProperty({ description: 'Driver first name' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  firstName: string;

  @ApiProperty({ description: 'Driver last name' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  lastName: string;

  @ApiPropertyOptional({ description: 'Phone number' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Email address' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ description: '4-digit PIN code' })
  @IsString()
  @Matches(/^\d{4}$/, { message: 'PIN must be exactly 4 digits' })
  pin: string;

  @ApiPropertyOptional({
    description: 'Vehicles to register',
    type: [VehicleRegistrationDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VehicleRegistrationDto)
  vehicles?: VehicleRegistrationDto[];

  // Privát ügyfél számlázási adatai (kötelező ha nincs partner)
  @ApiPropertyOptional({ description: 'Billing name (required for private customers)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  billingName?: string;

  @ApiPropertyOptional({ description: 'Billing address (required for private customers)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  billingAddress?: string;

  @ApiPropertyOptional({ description: 'Billing city (required for private customers)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  billingCity?: string;

  @ApiPropertyOptional({ description: 'Billing zip code (required for private customers)' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  billingZipCode?: string;

  @ApiPropertyOptional({ description: 'Billing country', default: 'HU' })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  billingCountry?: string;

  @ApiPropertyOptional({ description: 'Tax number (optional, for company billing)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  billingTaxNumber?: string;
}

export class SelfRegisterResponseDto {
  @ApiProperty({ description: 'Driver ID' })
  driverId: string;

  @ApiProperty({ description: 'First name' })
  firstName: string;

  @ApiProperty({ description: 'Last name' })
  lastName: string;

  @ApiProperty({ description: 'Approval status' })
  approvalStatus: string;

  @ApiPropertyOptional({ description: 'Invite code (if auto-approved)' })
  inviteCode?: string;

  @ApiPropertyOptional({
    description: 'What verification is required',
    enum: ['EMAIL', 'PHONE', 'BOTH'],
  })
  verificationRequired?: 'EMAIL' | 'PHONE' | 'BOTH';

  @ApiProperty({ description: 'Message for the user' })
  message: string;

  @ApiProperty({ description: 'Is this a private customer (no partner company)' })
  isPrivateCustomer: boolean;
}

export class CheckApprovalDto {
  @ApiProperty({ description: 'Driver ID' })
  @IsUUID()
  driverId: string;

  @ApiProperty({ description: '4-digit PIN code to verify identity' })
  @IsString()
  @Matches(/^\d{4}$/, { message: 'PIN must be exactly 4 digits' })
  pin: string;
}

export class CheckApprovalResponseDto {
  @ApiProperty({ description: 'Approval status' })
  status: 'PENDING' | 'APPROVED' | 'REJECTED';

  @ApiPropertyOptional({ description: 'Rejection reason if rejected' })
  rejectionReason?: string;

  @ApiPropertyOptional({ description: 'Invite code if approved' })
  inviteCode?: string;

  @ApiProperty({ description: 'Message for the user' })
  message: string;
}
