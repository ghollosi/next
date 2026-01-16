import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsDateString,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethodDto } from './partner-company.dto';
import { VehicleTypeDto } from './pricing.dto';

export enum InvoiceStatusDto {
  DRAFT = 'DRAFT',
  ISSUED = 'ISSUED',
  SENT = 'SENT',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
  OVERDUE = 'OVERDUE',
}

export class CreateInvoiceItemDto {
  @ApiProperty({ description: 'Tétel leírása' })
  @IsString()
  description: string;

  @ApiPropertyOptional({ description: 'Mennyiség', default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  quantity?: number;

  @ApiProperty({ description: 'Egységár (nettó)' })
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiPropertyOptional({ description: 'ÁFA %', default: 27 })
  @IsOptional()
  @IsNumber()
  vatRate?: number;

  @ApiPropertyOptional({ description: 'Mosás esemény ID' })
  @IsOptional()
  @IsString()
  washEventId?: string;

  @ApiPropertyOptional({ description: 'Szolgáltatás csomag ID' })
  @IsOptional()
  @IsString()
  servicePackageId?: string;

  @ApiPropertyOptional({ description: 'Jármű típus', enum: VehicleTypeDto })
  @IsOptional()
  @IsEnum(VehicleTypeDto)
  vehicleType?: VehicleTypeDto;
}

export class CreateInvoiceDto {
  @ApiProperty({ description: 'Partner cég ID' })
  @IsString()
  partnerCompanyId: string;

  @ApiPropertyOptional({ description: 'Időszak kezdete (gyűjtőszámlánál)' })
  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @ApiPropertyOptional({ description: 'Időszak vége (gyűjtőszámlánál)' })
  @IsOptional()
  @IsDateString()
  periodEnd?: string;

  @ApiPropertyOptional({ description: 'Fizetési mód', enum: PaymentMethodDto })
  @IsOptional()
  @IsEnum(PaymentMethodDto)
  paymentMethod?: PaymentMethodDto;

  @ApiPropertyOptional({ description: 'Kedvezmény %' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountPercent?: number;

  @ApiProperty({ description: 'Számla tételek', type: [CreateInvoiceItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  items: CreateInvoiceItemDto[];
}

export class PrepareInvoiceDto {
  @ApiProperty({ description: 'Partner cég ID' })
  @IsString()
  partnerCompanyId: string;

  @ApiProperty({ description: 'Időszak kezdete' })
  @IsDateString()
  periodStart: string;

  @ApiProperty({ description: 'Időszak vége' })
  @IsDateString()
  periodEnd: string;
}

export class IssueInvoiceDto {
  @ApiPropertyOptional({ description: 'Számlázási szolgáltató', default: 'szamlazz' })
  @IsOptional()
  @IsString()
  provider?: string;
}

export class MarkPaidDto {
  @ApiProperty({ description: 'Fizetési mód', enum: PaymentMethodDto })
  @IsEnum(PaymentMethodDto)
  paymentMethod: PaymentMethodDto;

  @ApiPropertyOptional({ description: 'Fizetés dátuma' })
  @IsOptional()
  @IsDateString()
  paidDate?: string;
}

export class QueryInvoicesDto {
  @ApiPropertyOptional({ description: 'Partner cég ID' })
  @IsOptional()
  @IsString()
  partnerCompanyId?: string;

  @ApiPropertyOptional({ description: 'Státusz', enum: InvoiceStatusDto })
  @IsOptional()
  @IsEnum(InvoiceStatusDto)
  status?: InvoiceStatusDto;

  @ApiPropertyOptional({ description: 'Kiállítás dátumától' })
  @IsOptional()
  @IsDateString()
  issueDateFrom?: string;

  @ApiPropertyOptional({ description: 'Kiállítás dátumáig' })
  @IsOptional()
  @IsDateString()
  issueDateTo?: string;

  @ApiPropertyOptional({ description: 'Esedékesség dátumától' })
  @IsOptional()
  @IsDateString()
  dueDateFrom?: string;

  @ApiPropertyOptional({ description: 'Esedékesség dátumáig' })
  @IsOptional()
  @IsDateString()
  dueDateTo?: string;
}

export class InvoiceItemResponseDto {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  vatRate: number;
  washEventId?: string;
  servicePackageId?: string;
  vehicleType?: VehicleTypeDto;
}

export class InvoiceResponseDto {
  id: string;
  networkId: string;
  partnerCompanyId: string;
  invoiceNumber?: string;
  externalId?: string;
  periodStart?: string;
  periodEnd?: string;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  currency: string;
  discountPercent?: number;
  discountAmount?: number;
  status: InvoiceStatusDto;
  issueDate?: string;
  dueDate?: string;
  paidDate?: string;
  paymentMethod?: PaymentMethodDto;
  billingName: string;
  billingAddress: string;
  billingCity: string;
  billingZipCode: string;
  billingCountry: string;
  taxNumber?: string;
  euVatNumber?: string;
  szamlazzPdfUrl?: string;
  items?: InvoiceItemResponseDto[];
  partnerCompany?: {
    id: string;
    code: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}
