import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PartnerCompany, BillingType, BillingCycle } from '@prisma/client';
import * as bcrypt from 'bcrypt';

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
      paymentDueDays?: number;
      // SAJÁT hálózat kedvezmények
      ownDiscountThreshold1?: number;
      ownDiscountPercent1?: number;
      ownDiscountThreshold2?: number;
      ownDiscountPercent2?: number;
      ownDiscountThreshold3?: number;
      ownDiscountPercent3?: number;
      ownDiscountThreshold4?: number;
      ownDiscountPercent4?: number;
      ownDiscountThreshold5?: number;
      ownDiscountPercent5?: number;
      // ALVÁLLALKOZÓI hálózat kedvezmények
      subDiscountThreshold1?: number;
      subDiscountPercent1?: number;
      subDiscountThreshold2?: number;
      subDiscountPercent2?: number;
      subDiscountThreshold3?: number;
      subDiscountPercent3?: number;
      subDiscountThreshold4?: number;
      subDiscountPercent4?: number;
      subDiscountThreshold5?: number;
      subDiscountPercent5?: number;
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
        paymentDueDays: data.paymentDueDays,
        // SAJÁT hálózat kedvezmények
        ownDiscountThreshold1: data.ownDiscountThreshold1,
        ownDiscountPercent1: data.ownDiscountPercent1,
        ownDiscountThreshold2: data.ownDiscountThreshold2,
        ownDiscountPercent2: data.ownDiscountPercent2,
        ownDiscountThreshold3: data.ownDiscountThreshold3,
        ownDiscountPercent3: data.ownDiscountPercent3,
        ownDiscountThreshold4: data.ownDiscountThreshold4,
        ownDiscountPercent4: data.ownDiscountPercent4,
        ownDiscountThreshold5: data.ownDiscountThreshold5,
        ownDiscountPercent5: data.ownDiscountPercent5,
        // ALVÁLLALKOZÓI hálózat kedvezmények
        subDiscountThreshold1: data.subDiscountThreshold1,
        subDiscountPercent1: data.subDiscountPercent1,
        subDiscountThreshold2: data.subDiscountThreshold2,
        subDiscountPercent2: data.subDiscountPercent2,
        subDiscountThreshold3: data.subDiscountThreshold3,
        subDiscountPercent3: data.subDiscountPercent3,
        subDiscountThreshold4: data.subDiscountThreshold4,
        subDiscountPercent4: data.subDiscountPercent4,
        subDiscountThreshold5: data.subDiscountThreshold5,
        subDiscountPercent5: data.subDiscountPercent5,
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
      pin?: string; // Plain text PIN - will be hashed
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
      paymentDueDays?: number;
      // SAJÁT hálózat kedvezmények
      ownDiscountThreshold1?: number | null;
      ownDiscountPercent1?: number | null;
      ownDiscountThreshold2?: number | null;
      ownDiscountPercent2?: number | null;
      ownDiscountThreshold3?: number | null;
      ownDiscountPercent3?: number | null;
      ownDiscountThreshold4?: number | null;
      ownDiscountPercent4?: number | null;
      ownDiscountThreshold5?: number | null;
      ownDiscountPercent5?: number | null;
      // ALVÁLLALKOZÓI hálózat kedvezmények
      subDiscountThreshold1?: number | null;
      subDiscountPercent1?: number | null;
      subDiscountThreshold2?: number | null;
      subDiscountPercent2?: number | null;
      subDiscountThreshold3?: number | null;
      subDiscountPercent3?: number | null;
      subDiscountThreshold4?: number | null;
      subDiscountPercent4?: number | null;
      subDiscountThreshold5?: number | null;
      subDiscountPercent5?: number | null;
    },
  ): Promise<PartnerCompany> {
    await this.findById(networkId, id); // Ensure exists and belongs to network

    // Prepare update data, hashing PIN if provided
    const { pin, ...restData } = data;
    const updateData: any = { ...restData };

    if (pin) {
      updateData.pinHash = await bcrypt.hash(pin, 10);
    }

    return this.prisma.partnerCompany.update({
      where: { id },
      data: updateData,
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
