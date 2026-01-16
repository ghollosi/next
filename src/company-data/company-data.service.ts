import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { OptenProvider } from './opten.provider';
import { BisnodeProvider } from './bisnode.provider';
import { ECegjegyzekProvider } from './ecegjegyzek.provider';
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
    private bisnodeProvider: BisnodeProvider,
    private eCegjegyzekProvider: ECegjegyzekProvider,
  ) {
    // Register available providers
    this.providers.set('opten', this.optenProvider);
    this.providers.set('bisnode', this.bisnodeProvider);
    this.providers.set('e_cegjegyzek', this.eCegjegyzekProvider);
  }

  /**
   * Get the configured company data provider for a network
   *
   * Logic:
   * 1. If network has allowCustomCompanyDataProvider = true and has own config → use network's own
   * 2. Otherwise, use Platform's central company data service (if configured)
   */
  async getProviderForNetwork(networkId: string): Promise<{
    provider: CompanyDataProvider | null;
    providerName: string;
    source: 'network' | 'platform' | 'none';
  }> {
    const networkSettings = await this.prisma.networkSettings.findUnique({
      where: { networkId },
    });

    // Check if network is allowed to use custom provider AND has one configured
    if (networkSettings?.allowCustomCompanyDataProvider &&
        networkSettings.companyDataProvider !== CompanyDataProviderEnum.NONE) {
      return this.configureProviderFromSettings(
        networkSettings.companyDataProvider,
        networkSettings.optenApiKey,
        networkSettings.optenApiSecret,
        networkSettings.bisnodeApiKey,
        networkSettings.bisnodeApiSecret,
        'network',
      );
    }

    // Fall back to Platform's central company data service
    const platformSettings = await this.prisma.platformSettings.findFirst();

    if (platformSettings && platformSettings.companyDataProvider !== CompanyDataProviderEnum.NONE) {
      return this.configureProviderFromSettings(
        platformSettings.companyDataProvider,
        platformSettings.optenApiKey,
        platformSettings.optenApiSecret,
        platformSettings.bisnodeApiKey,
        platformSettings.bisnodeApiSecret,
        'platform',
      );
    }

    return { provider: null, providerName: 'none', source: 'none' };
  }

  /**
   * Configure provider from settings (used by both network and platform level)
   */
  private configureProviderFromSettings(
    providerType: CompanyDataProviderEnum,
    optenApiKey: string | null,
    optenApiSecret: string | null,
    bisnodeApiKey: string | null,
    bisnodeApiSecret: string | null,
    source: 'network' | 'platform',
  ): { provider: CompanyDataProvider | null; providerName: string; source: 'network' | 'platform' | 'none' } {
    if (providerType === CompanyDataProviderEnum.OPTEN) {
      if (optenApiKey) {
        this.optenProvider.configure(
          optenApiKey,
          optenApiSecret || undefined,
        );
        return { provider: this.optenProvider, providerName: 'opten', source };
      }
      return { provider: null, providerName: 'opten', source: 'none' };
    }

    // Bisnode support
    if (providerType === CompanyDataProviderEnum.BISNODE) {
      if (bisnodeApiKey && bisnodeApiSecret) {
        this.bisnodeProvider.configure(
          bisnodeApiKey,
          bisnodeApiSecret,
        );
        return { provider: this.bisnodeProvider, providerName: 'bisnode', source };
      }
      return { provider: null, providerName: 'bisnode', source: 'none' };
    }

    // e-Cégjegyzék support
    if (providerType === CompanyDataProviderEnum.E_CEGJEGYZEK) {
      // e-Cégjegyzék can work without API key in limited mode
      this.eCegjegyzekProvider.configure(
        optenApiKey || '', // Using opten fields for now, could be separate fields
        optenApiSecret || '',
      );
      return { provider: this.eCegjegyzekProvider, providerName: 'e_cegjegyzek', source };
    }

    return { provider: null, providerName: 'none', source: 'none' };
  }

  /**
   * Check if network can configure custom provider (used by UI)
   */
  async canNetworkConfigureCustomProvider(networkId: string): Promise<boolean> {
    const settings = await this.prisma.networkSettings.findUnique({
      where: { networkId },
    });
    return settings?.allowCustomCompanyDataProvider ?? false;
  }

  /**
   * Get company data service info for a network (used by Network Admin UI)
   */
  async getNetworkCompanyDataInfo(networkId: string): Promise<{
    hasAccess: boolean;
    source: 'network' | 'platform' | 'none';
    providerName: string;
    canConfigureCustom: boolean;
    platformServiceName?: string;
  }> {
    const networkSettings = await this.prisma.networkSettings.findUnique({
      where: { networkId },
    });

    const canConfigureCustom = networkSettings?.allowCustomCompanyDataProvider ?? false;

    // If network can configure custom and has one
    if (canConfigureCustom && networkSettings?.companyDataProvider !== CompanyDataProviderEnum.NONE) {
      return {
        hasAccess: true,
        source: 'network',
        providerName: networkSettings!.companyDataProvider,
        canConfigureCustom: true,
      };
    }

    // Check platform service
    const platformSettings = await this.prisma.platformSettings.findFirst();
    if (platformSettings && platformSettings.companyDataProvider !== CompanyDataProviderEnum.NONE) {
      return {
        hasAccess: true,
        source: 'platform',
        providerName: platformSettings.companyDataProvider,
        canConfigureCustom,
        platformServiceName: 'Vemiax Platform',
      };
    }

    return {
      hasAccess: false,
      source: 'none',
      providerName: 'none',
      canConfigureCustom,
    };
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
    const { provider, providerName, source } = await this.getProviderForNetwork(networkId);

    if (!provider) {
      return {
        success: false,
        results: [],
        error: source === 'none'
          ? 'Nincs cégadatbázis szolgáltató konfigurálva'
          : `${providerName} szolgáltató nincs megfelelően konfigurálva`,
      };
    }

    this.logger.log(`Searching companies via ${providerName} (source: ${source}) for network ${networkId}`);
    return provider.searchCompanies(request);
  }

  /**
   * Get detailed company information using the network's configured provider
   */
  async getCompanyDetails(networkId: string, request: CompanyDetailRequest): Promise<CompanyDetailResponse> {
    const { provider, providerName, source } = await this.getProviderForNetwork(networkId);

    if (!provider) {
      return {
        success: false,
        error: source === 'none'
          ? 'Nincs cégadatbázis szolgáltató konfigurálva'
          : `${providerName} szolgáltató nincs megfelelően konfigurálva`,
      };
    }

    this.logger.log(`Getting company details via ${providerName} (source: ${source}) for network ${networkId}`);
    return provider.getCompanyDetails(request);
  }

  /**
   * Validate a Hungarian tax number using the network's configured provider
   */
  async validateTaxNumber(networkId: string, request: ValidateTaxNumberRequest): Promise<ValidateTaxNumberResponse> {
    const { provider, providerName, source } = await this.getProviderForNetwork(networkId);

    if (!provider) {
      // Fall back to format validation only
      const isValid = this.isValidTaxNumberFormat(request.taxNumber);
      return {
        success: true,
        isValid,
        error: isValid ? undefined : 'Érvénytelen adószám formátum',
      };
    }

    this.logger.log(`Validating tax number via ${providerName} (source: ${source}) for network ${networkId}`);
    return provider.validateTaxNumber(request);
  }

  /**
   * Validate provider connection/credentials
   */
  async validateProviderConnection(networkId: string): Promise<{
    success: boolean;
    providerName: string;
    source: 'network' | 'platform' | 'none';
    error?: string;
  }> {
    const { provider, providerName, source } = await this.getProviderForNetwork(networkId);

    if (!provider) {
      return {
        success: false,
        providerName,
        source,
        error: source === 'none'
          ? 'Nincs cégadatbázis szolgáltató konfigurálva'
          : `${providerName} szolgáltató nincs megfelelően konfigurálva`,
      };
    }

    try {
      const isConnected = await provider.validateConnection();
      return {
        success: isConnected,
        providerName,
        source,
        error: isConnected ? undefined : 'Sikertelen kapcsolat teszt',
      };
    } catch (error: any) {
      return {
        success: false,
        providerName,
        source,
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
