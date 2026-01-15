import { IsString, IsOptional, IsUUID, ValidateIf, IsArray, ValidateNested, IsNumber, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class WashServiceItemDto {
  @ApiProperty({ description: 'Service package ID' })
  @IsUUID()
  servicePackageId: string;

  @ApiPropertyOptional({ description: 'Vehicle type for pricing' })
  @IsOptional()
  @IsString()
  vehicleType?: string;

  @ApiPropertyOptional({ description: 'Vehicle role (TRACTOR or TRAILER)' })
  @IsOptional()
  @IsIn(['TRACTOR', 'TRAILER'])
  vehicleRole?: 'TRACTOR' | 'TRAILER';

  @ApiPropertyOptional({ description: 'Plate number for this service' })
  @IsOptional()
  @IsString()
  plateNumber?: string;

  @ApiPropertyOptional({ description: 'Quantity', default: 1 })
  @IsOptional()
  @IsNumber()
  quantity?: number;
}

export class CreateWashEventPwaDto {
  @ApiProperty({
    description: 'Location ID (from QR code)',
    example: 'uuid-location-id',
  })
  @IsUUID()
  locationId: string;

  @ApiPropertyOptional({
    description: 'DEPRECATED - Single service package ID. Use "services" array instead.',
    example: 'uuid-service-package-id',
  })
  @IsOptional()
  @IsUUID()
  servicePackageId?: string;

  @ApiPropertyOptional({
    description: 'Multiple services for this wash event',
    type: [WashServiceItemDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WashServiceItemDto)
  services?: WashServiceItemDto[];

  @ApiPropertyOptional({
    description: 'Tractor vehicle ID (if selecting from registered vehicles)',
    example: 'uuid-vehicle-id',
  })
  @IsOptional()
  @IsUUID()
  tractorVehicleId?: string;

  @ApiPropertyOptional({
    description: 'Tractor plate number (manual entry if no vehicle ID)',
    example: 'ABC1234',
  })
  @ValidateIf((o) => !o.tractorVehicleId)
  @IsString()
  tractorPlateManual?: string;

  @ApiPropertyOptional({
    description: 'Trailer vehicle ID (if selecting from registered vehicles)',
    example: 'uuid-vehicle-id',
  })
  @IsOptional()
  @IsUUID()
  trailerVehicleId?: string;

  @ApiPropertyOptional({
    description: 'Trailer plate number (manual entry)',
    example: 'TRL5678',
  })
  @IsOptional()
  @IsString()
  trailerPlateManual?: string;
}
