import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Network } from '@prisma/client';

@Injectable()
export class NetworkService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Network> {
    const network = await this.prisma.network.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!network) {
      throw new NotFoundException(`Network with ID ${id} not found`);
    }

    return network;
  }

  async findBySlug(slug: string): Promise<Network> {
    const network = await this.prisma.network.findFirst({
      where: {
        slug,
        deletedAt: null,
      },
    });

    if (!network) {
      throw new NotFoundException(`Network with slug ${slug} not found`);
    }

    return network;
  }

  async findAll(): Promise<Network[]> {
    return this.prisma.network.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async create(data: { name: string; slug: string }): Promise<Network> {
    return this.prisma.network.create({
      data: {
        name: data.name,
        slug: data.slug,
      },
    });
  }

  async update(id: string, data: { name?: string; isActive?: boolean }): Promise<Network> {
    await this.findById(id); // Ensure exists

    return this.prisma.network.update({
      where: { id },
      data,
    });
  }

  async softDelete(id: string): Promise<Network> {
    await this.findById(id); // Ensure exists

    return this.prisma.network.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });
  }

  async validateNetworkAccess(networkId: string): Promise<boolean> {
    const network = await this.prisma.network.findFirst({
      where: {
        id: networkId,
        isActive: true,
        deletedAt: null,
      },
    });

    return !!network;
  }
}
