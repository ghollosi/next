import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  Min,
} from 'class-validator';

export enum VehicleTypeDto {
  // Nyerges szerelvények
  SEMI_TRUCK = 'SEMI_TRUCK',           // Nyerges szerelvény

  // Gabonaszállító
  GRAIN_CARRIER = 'GRAIN_CARRIER',     // Gabonaszállító

  // Pótkocsik
  TRAILER_ONLY = 'TRAILER_ONLY',       // Csak pótkocsi

  // Konténerszállító
  CONTAINER_CARRIER = 'CONTAINER_CARRIER', // Konténer szállító

  // Traktor
  TRACTOR = 'TRACTOR',                 // Traktor

  // Tehergépjárművek súly szerint
  TRUCK_1_5T = 'TRUCK_1_5T',           // Tehergépjármű 1,5 t-ig
  TRUCK_3_5T = 'TRUCK_3_5T',           // Tehergépjármű 3,5t-ig
  TRUCK_7_5T = 'TRUCK_7_5T',           // Tehergépjármű 7,5t-ig
  TRUCK_12T = 'TRUCK_12T',             // Tehergépjármű 12t-ig
  TRUCK_12T_PLUS = 'TRUCK_12T_PLUS',   // Tehergépjármű 12t felett

  // Tartályautók
  TANK_SOLO = 'TANK_SOLO',             // Tartályautó (szóló)
  TANK_12T = 'TANK_12T',               // Tartályautó 12t-ig
  TANK_TRUCK = 'TANK_TRUCK',           // Tartályautó
  TANK_SEMI_TRAILER = 'TANK_SEMI_TRAILER', // Tartályfélpótkocsi

  // Tandem
  TANDEM_7_5T = 'TANDEM_7_5T',         // Tandem 7,5t-ig
  TANDEM_7_5T_PLUS = 'TANDEM_7_5T_PLUS', // Tandem 7,5t felett

  // Siló
  SILO = 'SILO',                       // Siló
  SILO_TANDEM = 'SILO_TANDEM',         // Siló (tandem)

  // Speciális
  TIPPER_MIXER = 'TIPPER_MIXER',       // Billencs, Mixer
  CAR_CARRIER = 'CAR_CARRIER',         // Autószállító

  // Buszok
  MINIBUS = 'MINIBUS',                 // Kisbusz (8-9 személyes)
  MIDIBUS = 'MIDIBUS',                 // Nagybusz (14-15 személyes)
  BUS = 'BUS',                         // Autóbusz

  // Személygépkocsik
  CAR = 'CAR',                         // Személygépkocsi
  SUV_MPV = 'SUV_MPV',                 // Egyterű, terepjáró

  // Munkagépek
  MACHINERY = 'MACHINERY',             // Munkagép
  FORKLIFT = 'FORKLIFT',               // Targonca

  // Egyéb
  MOTORCYCLE = 'MOTORCYCLE',           // Motorkerékpár

  // Speciális mosások
  BUILDING_PARTS = 'BUILDING_PARTS',   // Épület / Alkatrész mosás
  CHILD_SEAT = 'CHILD_SEAT',           // Gyerekülés
}

export class CreateServicePriceDto {
  @ApiProperty({ description: 'Szolgáltatás csomag ID' })
  @IsString()
  servicePackageId: string;

  @ApiProperty({ description: 'Jármű típus', enum: VehicleTypeDto })
  @IsEnum(VehicleTypeDto)
  vehicleType: VehicleTypeDto;

  @ApiProperty({ description: 'Ár (nettó)' })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional({ description: 'Pénznem', default: 'HUF' })
  @IsOptional()
  @IsString()
  currency?: string;
}

export class UpdateServicePriceDto {
  @ApiPropertyOptional({ description: 'Ár (nettó)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ description: 'Pénznem' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ description: 'Aktív-e' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreatePartnerCustomPriceDto {
  @ApiProperty({ description: 'Partner cég ID' })
  @IsString()
  partnerCompanyId: string;

  @ApiProperty({ description: 'Szolgáltatás csomag ID' })
  @IsString()
  servicePackageId: string;

  @ApiProperty({ description: 'Jármű típus', enum: VehicleTypeDto })
  @IsEnum(VehicleTypeDto)
  vehicleType: VehicleTypeDto;

  @ApiProperty({ description: 'Egyedi ár (nettó)' })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional({ description: 'Pénznem', default: 'HUF' })
  @IsOptional()
  @IsString()
  currency?: string;
}

export class UpdatePartnerCustomPriceDto {
  @ApiPropertyOptional({ description: 'Egyedi ár (nettó)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ description: 'Pénznem' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ description: 'Aktív-e' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ServicePriceResponseDto {
  id: string;
  networkId: string;
  servicePackageId: string;
  vehicleType: VehicleTypeDto;
  price: number;
  currency: string;
  isActive: boolean;
  servicePackage?: {
    id: string;
    code: string;
    name: string;
  };
}

export class PartnerCustomPriceResponseDto {
  id: string;
  networkId: string;
  partnerCompanyId: string;
  servicePackageId: string;
  vehicleType: VehicleTypeDto;
  price: number;
  currency: string;
  isActive: boolean;
  partnerCompany?: {
    id: string;
    code: string;
    name: string;
  };
  servicePackage?: {
    id: string;
    code: string;
    name: string;
  };
}

// Bulk price update DTO
export class BulkPriceItemDto {
  @ApiProperty({ description: 'Szolgáltatás csomag kód' })
  @IsString()
  serviceCode: string;

  @ApiProperty({ description: 'Jármű típus', enum: VehicleTypeDto })
  @IsEnum(VehicleTypeDto)
  vehicleType: VehicleTypeDto;

  @ApiProperty({ description: 'Ár (nettó)' })
  @IsNumber()
  @Min(0)
  price: number;
}

export class BulkUpdatePricesDto {
  @ApiProperty({ description: 'Árak listája', type: [BulkPriceItemDto] })
  prices: BulkPriceItemDto[];

  @ApiPropertyOptional({ description: 'Pénznem', default: 'HUF' })
  @IsOptional()
  @IsString()
  currency?: string;
}
