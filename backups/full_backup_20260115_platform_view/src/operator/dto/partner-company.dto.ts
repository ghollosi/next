import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsInt,
  Min,
  Max,
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

export enum PaymentMethodDto {
  CASH = 'CASH',
  CARD = 'CARD',
  DKV = 'DKV',
  UTA = 'UTA',
  MOL = 'MOL',
  SHELL = 'SHELL',
  TRAVIS = 'TRAVIS',
  OTHER = 'OTHER',
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

  @ApiPropertyOptional({ description: 'Fizetési határidő napokban', default: 8 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(90)
  paymentDueDays?: number;

  // SAJÁT hálózat kedvezmények (5 szint)
  @ApiPropertyOptional({ description: 'Saját 1. küszöb (mosás/hó)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  ownDiscountThreshold1?: number;

  @ApiPropertyOptional({ description: 'Saját 1. kedvezmény %' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  ownDiscountPercent1?: number;

  @ApiPropertyOptional({ description: 'Saját 2. küszöb (mosás/hó)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  ownDiscountThreshold2?: number;

  @ApiPropertyOptional({ description: 'Saját 2. kedvezmény %' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  ownDiscountPercent2?: number;

  @ApiPropertyOptional({ description: 'Saját 3. küszöb (mosás/hó)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  ownDiscountThreshold3?: number;

  @ApiPropertyOptional({ description: 'Saját 3. kedvezmény %' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  ownDiscountPercent3?: number;

  @ApiPropertyOptional({ description: 'Saját 4. küszöb (mosás/hó)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  ownDiscountThreshold4?: number;

  @ApiPropertyOptional({ description: 'Saját 4. kedvezmény %' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  ownDiscountPercent4?: number;

  @ApiPropertyOptional({ description: 'Saját 5. küszöb (mosás/hó)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  ownDiscountThreshold5?: number;

  @ApiPropertyOptional({ description: 'Saját 5. kedvezmény %' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  ownDiscountPercent5?: number;

  // ALVÁLLALKOZÓI hálózat kedvezmények (5 szint)
  @ApiPropertyOptional({ description: 'Alvállalkozó 1. küszöb (mosás/hó)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  subDiscountThreshold1?: number;

  @ApiPropertyOptional({ description: 'Alvállalkozó 1. kedvezmény %' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  subDiscountPercent1?: number;

  @ApiPropertyOptional({ description: 'Alvállalkozó 2. küszöb (mosás/hó)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  subDiscountThreshold2?: number;

  @ApiPropertyOptional({ description: 'Alvállalkozó 2. kedvezmény %' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  subDiscountPercent2?: number;

  @ApiPropertyOptional({ description: 'Alvállalkozó 3. küszöb (mosás/hó)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  subDiscountThreshold3?: number;

  @ApiPropertyOptional({ description: 'Alvállalkozó 3. kedvezmény %' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  subDiscountPercent3?: number;

  @ApiPropertyOptional({ description: 'Alvállalkozó 4. küszöb (mosás/hó)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  subDiscountThreshold4?: number;

  @ApiPropertyOptional({ description: 'Alvállalkozó 4. kedvezmény %' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  subDiscountPercent4?: number;

  @ApiPropertyOptional({ description: 'Alvállalkozó 5. küszöb (mosás/hó)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  subDiscountThreshold5?: number;

  @ApiPropertyOptional({ description: 'Alvállalkozó 5. kedvezmény %' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  subDiscountPercent5?: number;
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

  @ApiPropertyOptional({ description: 'Partner portal PIN kód (min. 4 karakter)' })
  @IsOptional()
  @IsString()
  @MinLength(4)
  pin?: string;

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

  @ApiPropertyOptional({ description: 'Fizetési határidő napokban' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(90)
  paymentDueDays?: number;

  // SAJÁT hálózat kedvezmények (5 szint)
  @ApiPropertyOptional({ description: 'Saját 1. küszöb (mosás/hó)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  ownDiscountThreshold1?: number | null;

  @ApiPropertyOptional({ description: 'Saját 1. kedvezmény %' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  ownDiscountPercent1?: number | null;

  @ApiPropertyOptional({ description: 'Saját 2. küszöb (mosás/hó)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  ownDiscountThreshold2?: number | null;

  @ApiPropertyOptional({ description: 'Saját 2. kedvezmény %' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  ownDiscountPercent2?: number | null;

  @ApiPropertyOptional({ description: 'Saját 3. küszöb (mosás/hó)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  ownDiscountThreshold3?: number | null;

  @ApiPropertyOptional({ description: 'Saját 3. kedvezmény %' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  ownDiscountPercent3?: number | null;

  @ApiPropertyOptional({ description: 'Saját 4. küszöb (mosás/hó)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  ownDiscountThreshold4?: number | null;

  @ApiPropertyOptional({ description: 'Saját 4. kedvezmény %' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  ownDiscountPercent4?: number | null;

  @ApiPropertyOptional({ description: 'Saját 5. küszöb (mosás/hó)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  ownDiscountThreshold5?: number | null;

  @ApiPropertyOptional({ description: 'Saját 5. kedvezmény %' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  ownDiscountPercent5?: number | null;

  // ALVÁLLALKOZÓI hálózat kedvezmények (5 szint)
  @ApiPropertyOptional({ description: 'Alvállalkozó 1. küszöb (mosás/hó)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  subDiscountThreshold1?: number | null;

  @ApiPropertyOptional({ description: 'Alvállalkozó 1. kedvezmény %' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  subDiscountPercent1?: number | null;

  @ApiPropertyOptional({ description: 'Alvállalkozó 2. küszöb (mosás/hó)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  subDiscountThreshold2?: number | null;

  @ApiPropertyOptional({ description: 'Alvállalkozó 2. kedvezmény %' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  subDiscountPercent2?: number | null;

  @ApiPropertyOptional({ description: 'Alvállalkozó 3. küszöb (mosás/hó)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  subDiscountThreshold3?: number | null;

  @ApiPropertyOptional({ description: 'Alvállalkozó 3. kedvezmény %' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  subDiscountPercent3?: number | null;

  @ApiPropertyOptional({ description: 'Alvállalkozó 4. küszöb (mosás/hó)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  subDiscountThreshold4?: number | null;

  @ApiPropertyOptional({ description: 'Alvállalkozó 4. kedvezmény %' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  subDiscountPercent4?: number | null;

  @ApiPropertyOptional({ description: 'Alvállalkozó 5. küszöb (mosás/hó)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  subDiscountThreshold5?: number | null;

  @ApiPropertyOptional({ description: 'Alvállalkozó 5. kedvezmény %' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  subDiscountPercent5?: number | null;
}
