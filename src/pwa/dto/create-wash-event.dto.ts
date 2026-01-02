import { IsString, IsOptional, IsUUID, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWashEventPwaDto {
  @ApiProperty({
    description: 'Location ID (from QR code)',
    example: 'uuid-location-id',
  })
  @IsUUID()
  locationId: string;

  @ApiProperty({
    description: 'Service package ID',
    example: 'uuid-service-package-id',
  })
  @IsUUID()
  servicePackageId: string;

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
