import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Location, OperationType, WashMode } from '@prisma/client';

@Injectable()
export class LocationService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(networkId: string, id: string): Promise<Location> {
    const location = await this.prisma.location.findFirst({
      where: {
        id,
        networkId,
        deletedAt: null,
      },
    });

    if (!location) {
      throw new NotFoundException(`Location not found`);
    }

    return location;
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

  async findAll(networkId: string): Promise<Location[]> {
    return this.prisma.location.findMany({
      where: {
        networkId,
        deletedAt: null,
      },
      orderBy: {
        name: 'asc',
      },
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
    },
  ): Promise<Location> {
    await this.findById(networkId, id); // Ensure exists and belongs to network

    return this.prisma.location.update({
      where: { id },
      data,
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
}
