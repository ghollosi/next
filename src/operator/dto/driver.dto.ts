import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsUUID,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

export class CreateDriverDto {
  @ApiPropertyOptional({ description: 'Partner cég ID (opcionális - privát ügyfél esetén nincs)' })
  @IsOptional()
  @IsUUID()
  partnerCompanyId?: string;

  @ApiProperty({ description: 'Keresztnév' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  firstName: string;

  @ApiProperty({ description: 'Vezetéknév' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  lastName: string;

  @ApiPropertyOptional({ description: 'Telefonszám' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Email cím' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ description: 'PIN kód (minimum 4 karakter)' })
  @IsString()
  @MinLength(4, { message: 'PIN must be at least 4 characters' })
  pin: string;
}

export class UpdateDriverDto {
  @ApiPropertyOptional({ description: 'Keresztnév' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  firstName?: string;

  @ApiPropertyOptional({ description: 'Vezetéknév' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  lastName?: string;

  @ApiPropertyOptional({ description: 'Telefonszám' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Email cím' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ description: 'Aktív-e' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateDriverPinDto {
  @ApiProperty({ description: 'Új PIN kód (4 számjegy)' })
  @IsString()
  @Matches(/^\d{4}$/, { message: 'PIN must be exactly 4 digits' })
  pin: string;
}
