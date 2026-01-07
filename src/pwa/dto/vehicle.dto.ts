import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsString, IsOptional, MinLength, MaxLength } from 'class-validator';
import { VehicleCategory } from '@prisma/client';

export class CreateVehicleDto {
  @ApiProperty({
    description: 'Vehicle category',
    enum: ['SOLO', 'TRACTOR', 'TRAILER'],
    example: 'TRACTOR'
  })
  @IsEnum(VehicleCategory)
  category: VehicleCategory;

  @ApiProperty({
    description: 'Plate number',
    example: 'ABC-123'
  })
  @IsString()
  @MinLength(2)
  @MaxLength(20)
  plateNumber: string;

  @ApiPropertyOptional({
    description: 'Nickname for the vehicle',
    example: 'Kék Scania'
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  nickname?: string;
}

export class UpdateVehicleDto {
  @ApiPropertyOptional({
    description: 'Vehicle category',
    enum: ['SOLO', 'TRACTOR', 'TRAILER']
  })
  @IsOptional()
  @IsEnum(VehicleCategory)
  category?: VehicleCategory;

  @ApiPropertyOptional({
    description: 'Nickname for the vehicle',
    example: 'Kék Scania'
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  nickname?: string;
}
