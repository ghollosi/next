import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Vehicle, VehicleType } from '@prisma/client';

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

  async findByPartnerCompanyAndType(
    networkId: string,
    partnerCompanyId: string,
    type: VehicleType,
  ): Promise<Vehicle[]> {
    return this.prisma.vehicle.findMany({
      where: {
        networkId,
        partnerCompanyId,
        type,
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

  async create(
    networkId: string,
    data: {
      partnerCompanyId: string;
      type: VehicleType;
      plateNumber: string;
      plateState?: string;
      make?: string;
      model?: string;
      year?: number;
    },
  ): Promise<Vehicle> {
    return this.prisma.vehicle.create({
      data: {
        networkId,
        partnerCompanyId: data.partnerCompanyId,
        type: data.type,
        plateNumber: data.plateNumber.toUpperCase(),
        plateState: data.plateState?.toUpperCase(),
        make: data.make,
        model: data.model,
        year: data.year,
      },
    });
  }

  async update(
    networkId: string,
    id: string,
    data: {
      plateNumber?: string;
      plateState?: string;
      make?: string;
      model?: string;
      year?: number;
      isActive?: boolean;
    },
  ): Promise<Vehicle> {
    await this.findById(networkId, id);

    return this.prisma.vehicle.update({
      where: { id },
      data: {
        ...data,
        plateNumber: data.plateNumber?.toUpperCase(),
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
