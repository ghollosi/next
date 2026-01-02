import { IsString, IsUUID, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWashEventOperatorDto {
  @ApiProperty({
    description: 'Location ID',
    example: 'uuid-location-id',
  })
  @IsUUID()
  locationId: string;

  @ApiProperty({
    description: 'Partner company ID',
    example: 'uuid-partner-company-id',
  })
  @IsUUID()
  partnerCompanyId: string;

  @ApiProperty({
    description: 'Driver name (manual entry)',
    example: 'John Doe',
  })
  @IsString()
  driverNameManual: string;

  @ApiProperty({
    description: 'Service package ID',
    example: 'uuid-service-package-id',
  })
  @IsUUID()
  servicePackageId: string;

  @ApiProperty({
    description: 'Tractor plate number',
    example: 'ABC1234',
  })
  @IsString()
  tractorPlateManual: string;

  @ApiPropertyOptional({
    description: 'Trailer plate number',
    example: 'TRL5678',
  })
  @IsOptional()
  @IsString()
  trailerPlateManual?: string;
}
