import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { OptenProvider } from './opten.provider';
import {
  CompanyDataProvider,
  CompanySearchRequest,
  CompanySearchResponse,
  CompanyDetailRequest,
  CompanyDetailResponse,
  ValidateTaxNumberRequest,
  ValidateTaxNumberResponse,
} from './company-data-provider.interface';
import { CompanyDataProvider as CompanyDataProviderEnum } from '@prisma/client';

@Injectable()
export class CompanyDataService {
  private readonly logger = new Logger(CompanyDataService.name);
  private providers: Map<string, CompanyDataProvider> = new Map();

  constructor(
    private prisma: PrismaService,
    private optenProvider: OptenProvider,
  ) {
    // Register available providers
    this.providers.set('opten', this.optenProvider);
  }

  /**
   * Get the configured company data provider for a network
   */
  async getProviderForNetwork(networkId: string): Promise<{ provider: CompanyDataProvider | null; providerName: string }> {
    const settings = await this.prisma.networkSettings.findUnique({
      where: { networkId },
    });

    if (!settings || settings.companyDataProvider === CompanyDataProviderEnum.NONE) {
      return { provider: null, providerName: 'none' };
    }

    if (settings.companyDataProvider === CompanyDataProviderEnum.OPTEN) {
      if (settings.optenApiKey) {
        this.optenProvider.configure(
          settings.optenApiKey,
          settings.optenApiSecret || undefined,
        );
        return { provider: this.optenProvider, providerName: 'opten' };
      }
      return { provider: null, providerName: 'opten' };
    }

    // Bisnode support (for future)
    if (settings.companyDataProvider === CompanyDataProviderEnum.BISNODE) {
      // TODO: Implement Bisnode provider
      this.logger.warn('Bisnode provider not yet implemented');
      return { provider: null, providerName: 'bisnode' };
    }

    // e-Cégjegyzék support (for future)
    if (settings.companyDataProvider === CompanyDataProviderEnum.E_CEGJEGYZEK) {
      // TODO: Implement e-Cégjegyzék provider
      this.logger.warn('e-Cégjegyzék provider not yet implemented');
      return { provider: null, providerName: 'e_cegjegyzek' };
    }

    return { provider: null, providerName: 'none' };
  }

  /**
   * Get provider by name (for explicit provider selection)
   */
  getProvider(providerName: string): CompanyDataProvider | undefined {
    return this.providers.get(providerName);
  }

  /**
   * Search for companies using the network's configured provider
   */
  async searchCompanies(networkId: string, request: CompanySearchRequest): Promise<CompanySearchResponse> {
    const { provider, providerName } = await this.getProviderForNetwork(networkId);

    if (!provider) {
      return {
        success: false,
        results: [],
        error: providerName === 'none'
          ? 'Nincs cégadatbázis szolgáltató konfigurálva'
          : `${providerName} szolgáltató nincs megfelelően konfigurálva`,
      };
    }

    this.logger.log(`Searching companies via ${providerName} for network ${networkId}`);
    return provider.searchCompanies(request);
  }

  /**
   * Get detailed company information using the network's configured provider
   */
  async getCompanyDetails(networkId: string, request: CompanyDetailRequest): Promise<CompanyDetailResponse> {
    const { provider, providerName } = await this.getProviderForNetwork(networkId);

    if (!provider) {
      return {
        success: false,
        error: providerName === 'none'
          ? 'Nincs cégadatbázis szolgáltató konfigurálva'
          : `${providerName} szolgáltató nincs megfelelően konfigurálva`,
      };
    }

    this.logger.log(`Getting company details via ${providerName} for network ${networkId}`);
    return provider.getCompanyDetails(request);
  }

  /**
   * Validate a Hungarian tax number using the network's configured provider
   */
  async validateTaxNumber(networkId: string, request: ValidateTaxNumberRequest): Promise<ValidateTaxNumberResponse> {
    const { provider, providerName } = await this.getProviderForNetwork(networkId);

    if (!provider) {
      // Fall back to format validation only
      const isValid = this.isValidTaxNumberFormat(request.taxNumber);
      return {
        success: true,
        isValid,
        error: isValid ? undefined : 'Érvénytelen adószám formátum',
      };
    }

    this.logger.log(`Validating tax number via ${providerName} for network ${networkId}`);
    return provider.validateTaxNumber(request);
  }

  /**
   * Validate provider connection/credentials
   */
  async validateProviderConnection(networkId: string): Promise<{ success: boolean; providerName: string; error?: string }> {
    const { provider, providerName } = await this.getProviderForNetwork(networkId);

    if (!provider) {
      return {
        success: false,
        providerName,
        error: providerName === 'none'
          ? 'Nincs cégadatbázis szolgáltató konfigurálva'
          : `${providerName} szolgáltató nincs megfelelően konfigurálva`,
      };
    }

    try {
      const isConnected = await provider.validateConnection();
      return {
        success: isConnected,
        providerName,
        error: isConnected ? undefined : 'Sikertelen kapcsolat teszt',
      };
    } catch (error: any) {
      return {
        success: false,
        providerName,
        error: error.message || 'Ismeretlen hiba a kapcsolat teszt során',
      };
    }
  }

  /**
   * Simple tax number format validation (without API call)
   */
  isValidTaxNumberFormat(taxNumber: string): boolean {
    const digits = taxNumber.replace(/\D/g, '');
    // Hungarian tax number: 8 digit company ID + 1 digit VAT code + 2 digit county code
    return digits.length === 11 || digits.length === 8;
  }

  /**
   * Format tax number for display (12345678-2-42)
   */
  formatTaxNumber(taxNumber: string): string {
    const digits = taxNumber.replace(/\D/g, '');
    if (digits.length === 11) {
      return `${digits.slice(0, 8)}-${digits[8]}-${digits.slice(9)}`;
    }
    return taxNumber;
  }

  /**
   * Get supported providers list
   */
  getSupportedProviders(): Array<{ id: string; name: string; description: string }> {
    return [
      {
        id: 'NONE',
        name: 'Nincs',
        description: 'Cégadatbázis integráció kikapcsolva',
      },
      {
        id: 'OPTEN',
        name: 'Opten',
        description: 'Magyar cégadatbázis, kockázati értékelés, NAV ellenőrzés',
      },
      {
        id: 'BISNODE',
        name: 'Bisnode / D&B',
        description: 'Nemzetközi cégadatbázis (jövőbeli támogatás)',
      },
      {
        id: 'E_CEGJEGYZEK',
        name: 'e-Cégjegyzék',
        description: 'Ingyenes, korlátozott céginformáció (jövőbeli támogatás)',
      },
    ];
  }
}
