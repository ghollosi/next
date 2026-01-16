import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Location, OperationType, WashMode, LocationVisibility } from '@prisma/client';

@Injectable()
export class LocationService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(networkId: string, id: string): Promise<Location & { openingHoursStructured?: Record<string, { openTime: string; closeTime: string; isClosed: boolean }> }> {
    const location = await this.prisma.location.findFirst({
      where: {
        id,
        networkId,
        deletedAt: null,
      },
      include: {
        openingHoursStructured: true,
      },
    });

    if (!location) {
      throw new NotFoundException(`Location not found`);
    }

    // Nyitvatartási órák mapelése
    const openingHoursMap = location.openingHoursStructured?.reduce((acc, oh) => {
      acc[oh.dayOfWeek] = {
        openTime: oh.openTime,
        closeTime: oh.closeTime,
        isClosed: oh.isClosed,
      };
      return acc;
    }, {} as Record<string, { openTime: string; closeTime: string; isClosed: boolean }>) || {};

    return {
      ...location,
      openingHoursStructured: openingHoursMap,
    } as any;
  }

  async findByCode(networkId: string, code: string): Promise<Location> {
    const location = await this.prisma.location.findFirst({
      where: {
        code,
        networkId,
        deletedAt: null,
      },
    });

    if (!location) {
      throw new NotFoundException(`Location with code ${code} not found`);
    }

    return location;
  }

  async findAll(networkId: string): Promise<(Location & { openingHoursStructured?: Record<string, { openTime: string; closeTime: string; isClosed: boolean }> })[]> {
    const locations = await this.prisma.location.findMany({
      where: {
        networkId,
        deletedAt: null,
      },
      include: {
        openingHoursStructured: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return locations.map((loc) => {
      const openingHoursMap = loc.openingHoursStructured?.reduce((acc, oh) => {
        acc[oh.dayOfWeek] = {
          openTime: oh.openTime,
          closeTime: oh.closeTime,
          isClosed: oh.isClosed,
        };
        return acc;
      }, {} as Record<string, { openTime: string; closeTime: string; isClosed: boolean }>) || {};

      return {
        ...loc,
        openingHoursStructured: openingHoursMap,
      } as any;
    });
  }

  async findActive(networkId: string): Promise<Location[]> {
    return this.prisma.location.findMany({
      where: {
        networkId,
        isActive: true,
        deletedAt: null,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async create(
    networkId: string,
    data: {
      name: string;
      code: string;
      address?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      country?: string;
      timezone?: string;
      operationType?: OperationType;
      washMode?: WashMode;
      latitude?: number;
      longitude?: number;
      openingHours?: string;
    },
  ): Promise<Location> {
    return this.prisma.location.create({
      data: {
        networkId,
        name: data.name,
        code: data.code,
        address: data.address,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode,
        country: data.country || 'HU',
        timezone: data.timezone || 'Europe/Budapest',
        operationType: data.operationType || 'OWN',
        washMode: data.washMode || 'MANUAL',
        latitude: data.latitude,
        longitude: data.longitude,
        openingHours: data.openingHours,
      },
    });
  }

  async update(
    networkId: string,
    id: string,
    data: {
      name?: string;
      code?: string;
      address?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      country?: string;
      timezone?: string;
      operationType?: OperationType;
      washMode?: WashMode;
      latitude?: number;
      longitude?: number;
      openingHours?: string;
      isActive?: boolean;
      visibility?: LocationVisibility;
      dedicatedPartnerIds?: string[];
    },
  ): Promise<Location> {
    await this.findById(networkId, id); // Ensure exists and belongs to network

    // Ha visibility DEDICATED-ra változik, ellenőrizzük, hogy van-e partner megadva
    if (data.visibility === LocationVisibility.DEDICATED &&
        (!data.dedicatedPartnerIds || data.dedicatedPartnerIds.length === 0)) {
      // Ha nincs dedicatedPartnerIds megadva, ne töröljük a meglévőt
      // (ez csak update lehet egy másik mezőre)
    }

    // Ha visibility nem DEDICATED, ürítsük a dedicatedPartnerIds-t
    const updateData: any = { ...data };
    if (data.visibility && data.visibility !== LocationVisibility.DEDICATED) {
      updateData.dedicatedPartnerIds = [];
    }

    return this.prisma.location.update({
      where: { id },
      data: updateData,
    });
  }

  async softDelete(networkId: string, id: string): Promise<Location> {
    await this.findById(networkId, id); // Ensure exists and belongs to network

    return this.prisma.location.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });
  }

  async getAvailableServices(networkId: string, locationId: string) {
    await this.findById(networkId, locationId); // Ensure location exists

    return this.prisma.locationServiceAvailability.findMany({
      where: {
        networkId,
        locationId,
        isActive: true,
      },
      include: {
        servicePackage: true,
      },
    });
  }

  /**
   * Látható helyszínek lekérése a sofőr típusa alapján
   *
   * Privát ügyfél (isPrivateCustomer = true, partnerCompanyId = null):
   *   - ÖSSZES Network ÖSSZES PUBLIC helyszíne
   *
   * Flottás sofőr (partnerCompanyId != null):
   *   - Saját Network PUBLIC helyszínei
   *   - Saját Network NETWORK_ONLY helyszínei
   *   - Saját Network DEDICATED helyszínei, ha a partner a dedikált listában van
   */
  async getVisibleLocations(
    driver: {
      networkId: string;
      partnerCompanyId: string | null;
      isPrivateCustomer: boolean;
    },
  ): Promise<Location[]> {
    if (driver.isPrivateCustomer || !driver.partnerCompanyId) {
      // Privát ügyfél: ÖSSZES Network ÖSSZES PUBLIC helyszíne
      return this.prisma.location.findMany({
        where: {
          visibility: LocationVisibility.PUBLIC,
          isActive: true,
          deletedAt: null,
        },
        include: {
          network: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
        orderBy: [
          { network: { name: 'asc' } },
          { name: 'asc' },
        ],
      });
    }

    // Flottás sofőr: saját network helyszínei (visibility szabályok alapján)
    return this.prisma.location.findMany({
      where: {
        networkId: driver.networkId,
        isActive: true,
        deletedAt: null,
        OR: [
          // PUBLIC helyszínek - mindenki látja
          { visibility: LocationVisibility.PUBLIC },
          // NETWORK_ONLY helyszínek - network tagok látják
          { visibility: LocationVisibility.NETWORK_ONLY },
          // DEDICATED helyszínek - csak ha a partner a dedikált listában van
          {
            visibility: LocationVisibility.DEDICATED,
            dedicatedPartnerIds: {
              has: driver.partnerCompanyId,
            },
          },
        ],
      },
      include: {
        network: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  /**
   * Helyszín láthatóságának frissítése (Network Admin számára)
   */
  async updateVisibility(
    networkId: string,
    locationId: string,
    visibility: LocationVisibility,
    dedicatedPartnerIds?: string[],
  ): Promise<Location> {
    // Ellenőrizzük, hogy a helyszín létezik és a network-höz tartozik
    await this.findById(networkId, locationId);

    return this.prisma.location.update({
      where: { id: locationId },
      data: {
        visibility,
        dedicatedPartnerIds: visibility === LocationVisibility.DEDICATED
          ? dedicatedPartnerIds || []
          : [],
      },
    });
  }

  /**
   * Helyszín ellenőrzése, hogy az adott sofőr láthatja-e
   */
  async canDriverAccessLocation(
    locationId: string,
    driver: {
      networkId: string;
      partnerCompanyId: string | null;
      isPrivateCustomer: boolean;
    },
  ): Promise<boolean> {
    const location = await this.prisma.location.findUnique({
      where: { id: locationId },
    });

    if (!location || !location.isActive || location.deletedAt) {
      return false;
    }

    // Privát ügyfél: csak PUBLIC helyszíneket érhet el
    if (driver.isPrivateCustomer || !driver.partnerCompanyId) {
      return location.visibility === LocationVisibility.PUBLIC;
    }

    // Flottás sofőr: csak a saját network helyszíneit érheti el
    if (location.networkId !== driver.networkId) {
      return false;
    }

    // Visibility ellenőrzés
    switch (location.visibility) {
      case LocationVisibility.PUBLIC:
      case LocationVisibility.NETWORK_ONLY:
        return true;
      case LocationVisibility.DEDICATED:
        return location.dedicatedPartnerIds.includes(driver.partnerCompanyId);
      default:
        return false;
    }
  }
}
