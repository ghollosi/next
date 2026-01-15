import { IsString, IsEnum, IsOptional, Length, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum VerificationTypeDto {
  EMAIL = 'EMAIL',
  PHONE = 'PHONE',
}

export class VerifyTokenDto {
  @ApiProperty({
    description: 'Verification token or code',
    example: 'ev_abc123... or 123456',
  })
  @IsString()
  token: string;

  @ApiProperty({
    description: 'Type of verification',
    enum: VerificationTypeDto,
  })
  @IsEnum(VerificationTypeDto)
  type: VerificationTypeDto;
}

export class ResendVerificationDto {
  @ApiProperty({
    description: 'Driver ID',
    example: '00000000-0000-0000-0000-000000000001',
  })
  @IsUUID()
  driverId: string;

  @ApiProperty({
    description: 'Type of verification to resend',
    enum: VerificationTypeDto,
  })
  @IsEnum(VerificationTypeDto)
  type: VerificationTypeDto;

  @ApiProperty({
    description: '4-digit PIN for verification',
    example: '1234',
  })
  @IsString()
  @Length(4, 4)
  pin: string;
}

export class ChangePartnerDto {
  @ApiProperty({
    description: 'New partner company ID',
    example: '00000000-0000-0000-0000-000000000002',
  })
  @IsUUID()
  newPartnerCompanyId: string;

  @ApiProperty({
    description: 'Reason for change (optional)',
    example: 'Munkahelyváltás',
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class VerificationResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;
}
