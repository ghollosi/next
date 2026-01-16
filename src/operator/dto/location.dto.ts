import { IsString, IsOptional, IsBoolean, IsNumber, IsEnum, IsArray, IsUUID } from 'class-validator';

export enum OperationType {
  OWN = 'OWN',
  SUBCONTRACTOR = 'SUBCONTRACTOR',
}

export enum WashMode {
  AUTOMATIC = 'AUTOMATIC',
  MANUAL = 'MANUAL',
}

export enum LocationVisibility {
  PUBLIC = 'PUBLIC',
  NETWORK_ONLY = 'NETWORK_ONLY',
  DEDICATED = 'DEDICATED',
}

export class CreateLocationDto {
  @IsString()
  name: string;

  @IsString()
  code: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  zipCode?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsEnum(OperationType)
  operationType?: OperationType;

  @IsOptional()
  @IsEnum(WashMode)
  washMode?: WashMode;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsString()
  openingHours?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEnum(LocationVisibility)
  visibility?: LocationVisibility;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  dedicatedPartnerIds?: string[];
}

export class UpdateLocationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  zipCode?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsEnum(OperationType)
  operationType?: OperationType;

  @IsOptional()
  @IsEnum(WashMode)
  washMode?: WashMode;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsString()
  openingHours?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEnum(LocationVisibility)
  visibility?: LocationVisibility;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  dedicatedPartnerIds?: string[];
}
