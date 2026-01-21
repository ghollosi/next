import { IsInt, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Base pagination DTO with sensible limits to prevent DoS attacks
 * Max limit is 500 to prevent excessive database load
 */
export class PaginationDto {
  @ApiPropertyOptional({
    description: 'Number of items to return (max 500)',
    default: 50,
    minimum: 1,
    maximum: 500
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number = 50;

  @ApiPropertyOptional({
    description: 'Number of items to skip',
    default: 0,
    minimum: 0
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}

/**
 * Utility function to apply safe pagination defaults
 * Use this in service methods that accept pagination params
 */
export function safePagination(options?: { limit?: number; offset?: number }) {
  const MAX_LIMIT = 500;
  const DEFAULT_LIMIT = 50;

  return {
    take: Math.min(options?.limit ?? DEFAULT_LIMIT, MAX_LIMIT),
    skip: options?.offset ?? 0,
  };
}
