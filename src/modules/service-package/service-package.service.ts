import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ServicePackage, LocationServiceAvailability } from '@prisma/client';

@Injectable()
export class ServicePackageService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(networkId: string, id: string): Promise<ServicePackage> {
    const servicePackage = await this.prisma.servicePackage.findFirst({
      where: {
        id,
        networkId,
        deletedAt: null,
      },
    });

    if (!servicePackage) {
      throw new NotFoundException(`Service package not found`);
    }

    return servicePackage;
  }

  async findByCode(networkId: string, code: string): Promise<ServicePackage> {
    const servicePackage = await this.prisma.servicePackage.findFirst({
      where: {
        code,
        networkId,
        deletedAt: null,
      },
    });

    if (!servicePackage) {
      throw new NotFoundException(`Service package with code ${code} not found`);
    }

    return servicePackage;
  }

  async findAll(networkId: string): Promise<ServicePackage[]> {
    return this.prisma.servicePackage.findMany({
      where: {
        networkId,
        deletedAt: null,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findActive(networkId: string): Promise<ServicePackage[]> {
    return this.prisma.servicePackage.findMany({
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

  async findAvailableAtLocation(
    networkId: string,
    locationId: string,
  ): Promise<ServicePackage[]> {
    const availability = await this.prisma.locationServiceAvailability.findMany({
      where: {
        networkId,
        locationId,
        isActive: true,
      },
      include: {
        servicePackage: true,
      },
    });

    return availability
      .map((a) => a.servicePackage)
      .filter((sp) => sp.isActive && !sp.deletedAt);
  }

  async create(
    networkId: string,
    data: {
      name: string;
      code: string;
      description?: string;
    },
  ): Promise<ServicePackage> {
    return this.prisma.servicePackage.create({
      data: {
        networkId,
        name: data.name,
        code: data.code,
        description: data.description,
      },
    });
  }

  async update(
    networkId: string,
    id: string,
    data: {
      name?: string;
      description?: string;
      isActive?: boolean;
    },
  ): Promise<ServicePackage> {
    await this.findById(networkId, id);

    return this.prisma.servicePackage.update({
      where: { id },
      data,
    });
  }

  async softDelete(networkId: string, id: string): Promise<ServicePackage> {
    await this.findById(networkId, id);

    return this.prisma.servicePackage.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });
  }

  // Location Service Availability Management
  async setLocationAvailability(
    networkId: string,
    locationId: string,
    servicePackageId: string,
    isActive: boolean,
  ): Promise<LocationServiceAvailability> {
    const existing = await this.prisma.locationServiceAvailability.findFirst({
      where: {
        networkId,
        locationId,
        servicePackageId,
      },
    });

    if (existing) {
      return this.prisma.locationServiceAvailability.update({
        where: { id: existing.id },
        data: { isActive },
      });
    }

    return this.prisma.locationServiceAvailability.create({
      data: {
        networkId,
        locationId,
        servicePackageId,
        isActive,
      },
    });
  }

  async getLocationAvailability(
    networkId: string,
    locationId: string,
  ): Promise<LocationServiceAvailability[]> {
    return this.prisma.locationServiceAvailability.findMany({
      where: {
        networkId,
        locationId,
      },
      include: {
        servicePackage: true,
      },
    });
  }

  async isServiceAvailableAtLocation(
    networkId: string,
    locationId: string,
    servicePackageId: string,
  ): Promise<boolean> {
    const availability = await this.prisma.locationServiceAvailability.findFirst({
      where: {
        networkId,
        locationId,
        servicePackageId,
        isActive: true,
      },
    });

    return !!availability;
  }
}
