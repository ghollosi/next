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
import { VehicleType } from '@prisma/client';

export class VehicleRegistrationDto {
  @ApiProperty({ description: 'Vehicle type', enum: VehicleType })
  @IsEnum(VehicleType)
  type: VehicleType;

  @ApiProperty({ description: 'Plate number' })
  @IsString()
  @MinLength(2)
  @MaxLength(20)
  plateNumber: string;

  @ApiPropertyOptional({ description: 'Plate state/region' })
  @IsOptional()
  @IsString()
  plateState?: string;
}

export class SelfRegisterDto {
  @ApiProperty({ description: 'Partner company ID' })
  @IsUUID()
  partnerCompanyId: string;

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

  @ApiProperty({ description: 'Message for the user' })
  message: string;
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
