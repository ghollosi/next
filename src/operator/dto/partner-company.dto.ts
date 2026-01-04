import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  MinLength,
  MaxLength,
} from 'class-validator';

export enum BillingTypeDto {
  CONTRACT = 'CONTRACT',
  CASH = 'CASH',
}

export enum BillingCycleDto {
  MONTHLY = 'MONTHLY',
  WEEKLY = 'WEEKLY',
}

export class CreatePartnerCompanyDto {
  @ApiProperty({ description: 'Cég neve' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @ApiProperty({ description: 'Rövid azonosító kód' })
  @IsString()
  @MinLength(2)
  @MaxLength(20)
  code: string;

  @ApiPropertyOptional({ description: 'Kapcsolattartó neve' })
  @IsOptional()
  @IsString()
  contactName?: string;

  @ApiPropertyOptional({ description: 'Email cím' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ description: 'Telefonszám' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({
    description: 'Számlázás típusa',
    enum: BillingTypeDto,
    default: BillingTypeDto.CONTRACT,
  })
  @IsEnum(BillingTypeDto)
  billingType: BillingTypeDto = BillingTypeDto.CONTRACT;

  @ApiPropertyOptional({
    description: 'Számlázási ciklus (csak CONTRACT esetén)',
    enum: BillingCycleDto,
  })
  @IsOptional()
  @IsEnum(BillingCycleDto)
  billingCycle?: BillingCycleDto;

  @ApiPropertyOptional({ description: 'Számlázási név (ha eltér a cégnévtől)' })
  @IsOptional()
  @IsString()
  billingName?: string;

  @ApiPropertyOptional({ description: 'Számlázási cím' })
  @IsOptional()
  @IsString()
  billingAddress?: string;

  @ApiPropertyOptional({ description: 'Számlázási város' })
  @IsOptional()
  @IsString()
  billingCity?: string;

  @ApiPropertyOptional({ description: 'Számlázási irányítószám' })
  @IsOptional()
  @IsString()
  billingZipCode?: string;

  @ApiPropertyOptional({ description: 'Számlázási ország', default: 'HU' })
  @IsOptional()
  @IsString()
  billingCountry?: string;

  @ApiPropertyOptional({ description: 'Adószám' })
  @IsOptional()
  @IsString()
  taxNumber?: string;

  @ApiPropertyOptional({ description: 'EU közösségi adószám' })
  @IsOptional()
  @IsString()
  euVatNumber?: string;
}

export class UpdatePartnerCompanyDto {
  @ApiPropertyOptional({ description: 'Cég neve' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ description: 'Kapcsolattartó neve' })
  @IsOptional()
  @IsString()
  contactName?: string;

  @ApiPropertyOptional({ description: 'Email cím' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ description: 'Telefonszám' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ description: 'Aktív-e' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Számlázás típusa',
    enum: BillingTypeDto,
  })
  @IsOptional()
  @IsEnum(BillingTypeDto)
  billingType?: BillingTypeDto;

  @ApiPropertyOptional({
    description: 'Számlázási ciklus (csak CONTRACT esetén)',
    enum: BillingCycleDto,
  })
  @IsOptional()
  @IsEnum(BillingCycleDto)
  billingCycle?: BillingCycleDto | null;

  @ApiPropertyOptional({ description: 'Számlázási név (ha eltér a cégnévtől)' })
  @IsOptional()
  @IsString()
  billingName?: string;

  @ApiPropertyOptional({ description: 'Számlázási cím' })
  @IsOptional()
  @IsString()
  billingAddress?: string;

  @ApiPropertyOptional({ description: 'Számlázási város' })
  @IsOptional()
  @IsString()
  billingCity?: string;

  @ApiPropertyOptional({ description: 'Számlázási irányítószám' })
  @IsOptional()
  @IsString()
  billingZipCode?: string;

  @ApiPropertyOptional({ description: 'Számlázási ország' })
  @IsOptional()
  @IsString()
  billingCountry?: string;

  @ApiPropertyOptional({ description: 'Adószám' })
  @IsOptional()
  @IsString()
  taxNumber?: string;

  @ApiPropertyOptional({ description: 'EU közösségi adószám' })
  @IsOptional()
  @IsString()
  euVatNumber?: string;
}
