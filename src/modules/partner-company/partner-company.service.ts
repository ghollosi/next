import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PartnerCompany, BillingType, BillingCycle } from '@prisma/client';

@Injectable()
export class PartnerCompanyService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(networkId: string, id: string): Promise<PartnerCompany> {
    const company = await this.prisma.partnerCompany.findFirst({
      where: {
        id,
        networkId,
        deletedAt: null,
      },
    });

    if (!company) {
      throw new NotFoundException(`Partner company not found`);
    }

    return company;
  }

  async findByCode(networkId: string, code: string): Promise<PartnerCompany> {
    const company = await this.prisma.partnerCompany.findFirst({
      where: {
        code,
        networkId,
        deletedAt: null,
      },
    });

    if (!company) {
      throw new NotFoundException(`Partner company with code ${code} not found`);
    }

    return company;
  }

  async findAll(networkId: string): Promise<PartnerCompany[]> {
    return this.prisma.partnerCompany.findMany({
      where: {
        networkId,
        deletedAt: null,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findActive(networkId: string): Promise<PartnerCompany[]> {
    return this.prisma.partnerCompany.findMany({
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
      contactName?: string;
      email?: string;
      phone?: string;
      billingType?: BillingType;
      billingCycle?: BillingCycle;
      billingName?: string;
      billingAddress?: string;
      billingCity?: string;
      billingZipCode?: string;
      billingCountry?: string;
      taxNumber?: string;
      euVatNumber?: string;
    },
  ): Promise<PartnerCompany> {
    return this.prisma.partnerCompany.create({
      data: {
        networkId,
        name: data.name,
        code: data.code,
        contactName: data.contactName,
        email: data.email,
        phone: data.phone,
        billingType: data.billingType,
        billingCycle: data.billingCycle,
        billingName: data.billingName,
        billingAddress: data.billingAddress,
        billingCity: data.billingCity,
        billingZipCode: data.billingZipCode,
        billingCountry: data.billingCountry,
        taxNumber: data.taxNumber,
        euVatNumber: data.euVatNumber,
      },
    });
  }

  async update(
    networkId: string,
    id: string,
    data: {
      name?: string;
      contactName?: string;
      email?: string;
      phone?: string;
      isActive?: boolean;
      billingType?: BillingType;
      billingCycle?: BillingCycle | null;
      billingName?: string;
      billingAddress?: string;
      billingCity?: string;
      billingZipCode?: string;
      billingCountry?: string;
      taxNumber?: string;
      euVatNumber?: string;
    },
  ): Promise<PartnerCompany> {
    await this.findById(networkId, id); // Ensure exists and belongs to network

    return this.prisma.partnerCompany.update({
      where: { id },
      data,
    });
  }

  async softDelete(networkId: string, id: string): Promise<PartnerCompany> {
    await this.findById(networkId, id); // Ensure exists and belongs to network

    return this.prisma.partnerCompany.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });
  }
}
