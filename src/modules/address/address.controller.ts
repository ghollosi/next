import { Controller, Get, Query, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { AddressService, PostalCodeResult, StreetSuggestion } from './address.service';

@ApiTags('address')
@Controller('api/address')
export class AddressController {
  private readonly logger = new Logger(AddressController.name);

  constructor(private readonly addressService: AddressService) {}

  @Get('postal-code/lookup')
  @ApiOperation({ summary: 'Look up city by postal code' })
  @ApiQuery({ name: 'code', required: true, description: 'Postal code to look up' })
  @ApiQuery({ name: 'country', required: false, description: 'Country code (ISO 3166-1 alpha-2)' })
  @ApiResponse({ status: 200, description: 'Returns matching cities for the postal code' })
  async lookupPostalCode(
    @Query('code') code: string,
    @Query('country') country?: string,
  ): Promise<PostalCodeResult[]> {
    return this.addressService.lookupPostalCode(code, country);
  }

  @Get('postal-code/search')
  @ApiOperation({ summary: 'Search postal codes by partial match' })
  @ApiQuery({ name: 'q', required: true, description: 'Partial postal code to search' })
  @ApiQuery({ name: 'country', required: false, description: 'Country code (ISO 3166-1 alpha-2)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Maximum results (default: 10)' })
  @ApiResponse({ status: 200, description: 'Returns matching postal codes' })
  async searchPostalCodes(
    @Query('q') query: string,
    @Query('country') country?: string,
    @Query('limit') limit?: string,
  ): Promise<PostalCodeResult[]> {
    return this.addressService.searchPostalCodes(
      query,
      country,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  @Get('city/search')
  @ApiOperation({ summary: 'Search cities by name' })
  @ApiQuery({ name: 'q', required: true, description: 'City name to search' })
  @ApiQuery({ name: 'country', required: false, description: 'Country code (ISO 3166-1 alpha-2)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Maximum results (default: 10)' })
  @ApiResponse({ status: 200, description: 'Returns matching cities' })
  async searchCities(
    @Query('q') query: string,
    @Query('country') country?: string,
    @Query('limit') limit?: string,
  ): Promise<PostalCodeResult[]> {
    return this.addressService.searchCities(
      query,
      country,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  @Get('street/suggest')
  @ApiOperation({ summary: 'Get street name suggestions (OpenStreetMap)' })
  @ApiQuery({ name: 'q', required: true, description: 'Street name to search' })
  @ApiQuery({ name: 'city', required: true, description: 'City to search in' })
  @ApiQuery({ name: 'country', required: false, description: 'Country code (default: HU)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Maximum results (default: 5)' })
  @ApiResponse({ status: 200, description: 'Returns street suggestions' })
  async suggestStreets(
    @Query('q') query: string,
    @Query('city') city: string,
    @Query('country') country?: string,
    @Query('limit') limit?: string,
  ): Promise<StreetSuggestion[]> {
    return this.addressService.suggestStreets(
      query,
      city,
      country || 'HU',
      limit ? parseInt(limit, 10) : 5,
    );
  }

  @Get('validate')
  @ApiOperation({ summary: 'Validate and geocode a full address' })
  @ApiQuery({ name: 'street', required: true, description: 'Street address' })
  @ApiQuery({ name: 'city', required: true, description: 'City' })
  @ApiQuery({ name: 'postalCode', required: true, description: 'Postal code' })
  @ApiQuery({ name: 'country', required: false, description: 'Country code (default: HU)' })
  @ApiResponse({ status: 200, description: 'Returns validation result with coordinates' })
  async validateAddress(
    @Query('street') street: string,
    @Query('city') city: string,
    @Query('postalCode') postalCode: string,
    @Query('country') country?: string,
  ): Promise<{
    isValid: boolean;
    normalizedAddress?: string;
    latitude?: number;
    longitude?: number;
    confidence?: number;
  }> {
    return this.addressService.validateAddress(street, city, postalCode, country || 'HU');
  }

  @Get('countries')
  @ApiOperation({ summary: 'Get list of available countries in the postal code database' })
  @ApiResponse({ status: 200, description: 'Returns list of countries with codes and names' })
  async getAvailableCountries(): Promise<{ code: string; name: string }[]> {
    return this.addressService.getAvailableCountries();
  }
}
