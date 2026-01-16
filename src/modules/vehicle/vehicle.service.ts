import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Vehicle, VehicleCategory } from '@prisma/client';

@Injectable()
export class VehicleService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(networkId: string, id: string): Promise<Vehicle> {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: {
        id,
        networkId,
        deletedAt: null,
      },
      include: {
        partnerCompany: true,
      },
    });

    if (!vehicle) {
      throw new NotFoundException(`Vehicle not found`);
    }

    return vehicle;
  }

  async findByPlate(
    networkId: string,
    plateNumber: string,
    plateState?: string,
  ): Promise<Vehicle | null> {
    return this.prisma.vehicle.findFirst({
      where: {
        networkId,
        plateNumber,
        plateState: plateState || undefined,
        deletedAt: null,
      },
    });
  }

  async findByPartnerCompany(
    networkId: string,
    partnerCompanyId: string,
  ): Promise<Vehicle[]> {
    return this.prisma.vehicle.findMany({
      where: {
        networkId,
        partnerCompanyId,
        deletedAt: null,
      },
      orderBy: {
        plateNumber: 'asc',
      },
    });
  }

  async findByPartnerCompanyAndCategory(
    networkId: string,
    partnerCompanyId: string,
    category: VehicleCategory,
  ): Promise<Vehicle[]> {
    return this.prisma.vehicle.findMany({
      where: {
        networkId,
        partnerCompanyId,
        category,
        isActive: true,
        deletedAt: null,
      },
      orderBy: {
        plateNumber: 'asc',
      },
    });
  }

  async findAll(networkId: string): Promise<Vehicle[]> {
    return this.prisma.vehicle.findMany({
      where: {
        networkId,
        deletedAt: null,
      },
      include: {
        partnerCompany: true,
      },
      orderBy: {
        plateNumber: 'asc',
      },
    });
  }

  async findByDriver(
    networkId: string,
    driverId: string,
  ): Promise<Vehicle[]> {
    return this.prisma.vehicle.findMany({
      where: {
        networkId,
        driverId,
        isActive: true,
        deletedAt: null,
      },
      orderBy: {
        category: 'asc', // SOLO first, then TRACTOR, then TRAILER
      },
    });
  }

  async findByDriverAndCategory(
    networkId: string,
    driverId: string,
    category: VehicleCategory,
  ): Promise<Vehicle[]> {
    return this.prisma.vehicle.findMany({
      where: {
        networkId,
        driverId,
        category,
        isActive: true,
        deletedAt: null,
      },
      orderBy: {
        plateNumber: 'asc',
      },
    });
  }

  async create(
    networkId: string,
    data: {
      partnerCompanyId: string | null;
      category: VehicleCategory | string;
      plateNumber: string;
      plateState?: string;
      nickname?: string;
      make?: string;
      modelName?: string;
      year?: number;
      driverId?: string;
    },
  ): Promise<Vehicle> {
    // Check if plate already exists in this network
    const existing = await this.prisma.vehicle.findFirst({
      where: {
        networkId,
        plateNumber: data.plateNumber.toUpperCase(),
        deletedAt: null,
      },
    });

    if (existing) {
      throw new ConflictException(`Rendszám már létezik: ${data.plateNumber}`);
    }

    return this.prisma.vehicle.create({
      data: {
        networkId,
        partnerCompanyId: data.partnerCompanyId,
        driverId: data.driverId,
        category: data.category as VehicleCategory,
        plateNumber: data.plateNumber.toUpperCase().replace(/[^A-Z0-9]/g, ''),
        plateState: data.plateState?.toUpperCase(),
        nickname: data.nickname,
        make: data.make,
        modelName: data.modelName,
        year: data.year,
      },
    });
  }

  // Sofőr által hozzáadott jármű mentése vagy frissítése
  async createOrUpdateByDriver(
    networkId: string,
    driverId: string,
    partnerCompanyId: string | null | undefined,  // Null/undefined for private customers
    data: {
      category: VehicleCategory | string;
      plateNumber: string;
      nickname?: string;
    },
  ): Promise<Vehicle> {
    const normalizedPlate = data.plateNumber.toUpperCase().replace(/[^A-Z0-9]/g, '');

    // Létezik-e már ez a rendszám?
    const existing = await this.prisma.vehicle.findFirst({
      where: {
        networkId,
        plateNumber: normalizedPlate,
        deletedAt: null,
      },
    });

    if (existing) {
      // Ha létezik és a sofőré, frissítsük
      if (existing.driverId === driverId) {
        return this.prisma.vehicle.update({
          where: { id: existing.id },
          data: {
            category: data.category as VehicleCategory,
            nickname: data.nickname,
          },
        });
      }
      // Ha másé, dobjunk hibát
      throw new ConflictException(`Ez a rendszám már máshoz tartozik: ${data.plateNumber}`);
    }

    // Új jármű létrehozása
    return this.prisma.vehicle.create({
      data: {
        networkId,
        partnerCompanyId: partnerCompanyId || null,  // Null for private customers
        driverId,
        category: data.category as VehicleCategory,
        plateNumber: normalizedPlate,
        nickname: data.nickname,
      },
    });
  }

  async update(
    networkId: string,
    id: string,
    data: {
      plateNumber?: string;
      plateState?: string;
      category?: VehicleCategory;
      nickname?: string;
      make?: string;
      modelName?: string;
      year?: number;
      isActive?: boolean;
    },
  ): Promise<Vehicle> {
    await this.findById(networkId, id);

    return this.prisma.vehicle.update({
      where: { id },
      data: {
        ...data,
        plateNumber: data.plateNumber?.toUpperCase().replace(/[^A-Z0-9]/g, ''),
        plateState: data.plateState?.toUpperCase(),
      },
    });
  }

  async softDelete(networkId: string, id: string): Promise<Vehicle> {
    await this.findById(networkId, id);

    return this.prisma.vehicle.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });
  }
}
