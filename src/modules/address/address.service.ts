import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PostalCode } from '@prisma/client';

export interface PostalCodeResult {
  postalCode: string;
  city: string;
  state?: string;
  countryCode: string;
  latitude?: number;
  longitude?: number;
}

export interface StreetSuggestion {
  street: string;
  fullAddress: string;
  city: string;
  postalCode: string;
  countryCode: string;
  latitude?: number;
  longitude?: number;
}

@Injectable()
export class AddressService {
  private readonly logger = new Logger(AddressService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Look up city by postal code
   * Returns all matching cities (some postal codes may have multiple)
   */
  async lookupPostalCode(
    postalCode: string,
    countryCode?: string,
  ): Promise<PostalCodeResult[]> {
    const where: any = {
      postalCode: postalCode.trim(),
    };

    if (countryCode) {
      where.countryCode = countryCode.toUpperCase();
    }

    const results = await this.prisma.postalCode.findMany({
      where,
      select: {
        postalCode: true,
        city: true,
        state: true,
        countryCode: true,
        latitude: true,
        longitude: true,
      },
      take: 10,
    });

    return results.map((r) => ({
      postalCode: r.postalCode,
      city: r.city,
      state: r.state || undefined,
      countryCode: r.countryCode,
      latitude: r.latitude || undefined,
      longitude: r.longitude || undefined,
    }));
  }

  /**
   * Search postal codes by partial match
   */
  async searchPostalCodes(
    query: string,
    countryCode?: string,
    limit = 10,
  ): Promise<PostalCodeResult[]> {
    const where: any = {
      postalCode: {
        startsWith: query.trim(),
      },
    };

    if (countryCode) {
      where.countryCode = countryCode.toUpperCase();
    }

    const results = await this.prisma.postalCode.findMany({
      where,
      select: {
        postalCode: true,
        city: true,
        state: true,
        countryCode: true,
        latitude: true,
        longitude: true,
      },
      take: limit,
      orderBy: {
        postalCode: 'asc',
      },
    });

    return results.map((r) => ({
      postalCode: r.postalCode,
      city: r.city,
      state: r.state || undefined,
      countryCode: r.countryCode,
      latitude: r.latitude || undefined,
      longitude: r.longitude || undefined,
    }));
  }

  /**
   * Search cities by name
   */
  async searchCities(
    query: string,
    countryCode?: string,
    limit = 10,
  ): Promise<PostalCodeResult[]> {
    const where: any = {
      city: {
        contains: query.trim(),
        mode: 'insensitive',
      },
    };

    if (countryCode) {
      where.countryCode = countryCode.toUpperCase();
    }

    const results = await this.prisma.postalCode.findMany({
      where,
      select: {
        postalCode: true,
        city: true,
        state: true,
        countryCode: true,
        latitude: true,
        longitude: true,
      },
      take: limit,
      orderBy: {
        city: 'asc',
      },
    });

    return results.map((r) => ({
      postalCode: r.postalCode,
      city: r.city,
      state: r.state || undefined,
      countryCode: r.countryCode,
      latitude: r.latitude || undefined,
      longitude: r.longitude || undefined,
    }));
  }

  /**
   * Get street suggestions using OpenStreetMap Nominatim API
   * This is a free API with rate limiting (1 request/second)
   */
  async suggestStreets(
    query: string,
    city: string,
    countryCode = 'HU',
    limit = 5,
  ): Promise<StreetSuggestion[]> {
    if (!query || query.length < 2) {
      return [];
    }

    try {
      // Build Nominatim search query
      const searchQuery = `${query}, ${city}`;
      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.searchParams.set('q', searchQuery);
      url.searchParams.set('format', 'json');
      url.searchParams.set('addressdetails', '1');
      url.searchParams.set('countrycodes', countryCode.toLowerCase());
      url.searchParams.set('limit', String(limit));
      url.searchParams.set('featuretype', 'street');

      const response = await fetch(url.toString(), {
        headers: {
          'User-Agent': 'VSys-AddressAutocomplete/1.0',
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        this.logger.warn(`Nominatim API error: ${response.status}`);
        return [];
      }

      const data = await response.json();

      return data.map((item: any) => ({
        street: item.address?.road || item.display_name.split(',')[0],
        fullAddress: item.display_name,
        city: item.address?.city || item.address?.town || item.address?.village || city,
        postalCode: item.address?.postcode || '',
        countryCode: item.address?.country_code?.toUpperCase() || countryCode,
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon),
      }));
    } catch (error) {
      this.logger.error(`Error fetching street suggestions: ${error}`);
      return [];
    }
  }

  /**
   * Validate and geocode a full address
   */
  async validateAddress(
    street: string,
    city: string,
    postalCode: string,
    countryCode = 'HU',
  ): Promise<{
    isValid: boolean;
    normalizedAddress?: string;
    latitude?: number;
    longitude?: number;
    confidence?: number;
  }> {
    try {
      const searchQuery = `${street}, ${postalCode} ${city}, ${countryCode}`;
      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.searchParams.set('q', searchQuery);
      url.searchParams.set('format', 'json');
      url.searchParams.set('addressdetails', '1');
      url.searchParams.set('limit', '1');

      const response = await fetch(url.toString(), {
        headers: {
          'User-Agent': 'VSys-AddressAutocomplete/1.0',
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        return { isValid: false };
      }

      const data = await response.json();

      if (data.length === 0) {
        return { isValid: false };
      }

      const result = data[0];
      const importance = parseFloat(result.importance || 0);

      return {
        isValid: importance > 0.3,
        normalizedAddress: result.display_name,
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
        confidence: importance,
      };
    } catch (error) {
      this.logger.error(`Error validating address: ${error}`);
      return { isValid: false };
    }
  }

  /**
   * Get available countries from the postal code database
   */
  async getAvailableCountries(): Promise<{ code: string; name: string }[]> {
    const countries = await this.prisma.postalCode.findMany({
      select: {
        countryCode: true,
      },
      distinct: ['countryCode'],
      orderBy: {
        countryCode: 'asc',
      },
    });

    const countryNames: Record<string, string> = {
      HU: 'Magyarorszag',
      AT: 'Ausztria',
      SK: 'Szlovakia',
      RO: 'Romania',
      SI: 'Szlovenia',
      HR: 'Horvatorszag',
      DE: 'Nemetorszag',
      CZ: 'Csehorszag',
      PL: 'Lengyelorszag',
      IT: 'Olaszorszag',
      FR: 'Franciaorszag',
      NL: 'Hollandia',
      BE: 'Belgium',
      ES: 'Spanyolorszag',
      PT: 'Portugalia',
      BG: 'Bulgaria',
      GR: 'Gorogorszag',
      SE: 'Svedorszag',
      DK: 'Dania',
      FI: 'Finnorszag',
      IE: 'Irorszag',
      LU: 'Luxemburg',
      EE: 'Esztorszag',
      LV: 'Lettorszag',
      LT: 'Litvania',
      MT: 'Malta',
      CY: 'Ciprus',
      UA: 'Ukrajna',
      RS: 'Szerbia',
      CH: 'Svajc',
      GB: 'Egyesult Kiralysag',
    };

    return countries.map((c) => ({
      code: c.countryCode,
      name: countryNames[c.countryCode] || c.countryCode,
    }));
  }
}
