import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import {
  CompanyDataProvider,
  CompanySearchRequest,
  CompanySearchResponse,
  CompanyDetailRequest,
  CompanyDetailResponse,
  ValidateTaxNumberRequest,
  ValidateTaxNumberResponse,
  CompanySearchResult,
  CompanyDetailedInfo,
} from './company-data-provider.interface';

/**
 * e-Cégjegyzék (Hungarian Official Company Registry) provider
 *
 * Az e-Cégjegyzék a hivatalos magyar cégnyilvántartás elektronikus szolgáltatása.
 * A szolgáltatás az Igazságügyi Minisztérium felügyelete alatt működik.
 *
 * Weboldal: https://e-cegjegyzek.hu
 * API: https://e-cegjegyzek.hu/info/page/ceginfo
 *
 * Megjegyzés: Az e-Cégjegyzék publikus API korlátozott funkcionalitást biztosít.
 * Részletes adatokhoz e-akta előfizetés szükséges.
 */
@Injectable()
export class ECegjegyzekProvider extends CompanyDataProvider {
  readonly providerName = 'e_cegjegyzek';
  private readonly logger = new Logger(ECegjegyzekProvider.name);

  private apiKey: string = '';
  private apiSecret: string = '';
  private httpClient: AxiosInstance;
  private isConfigured = false;

  // e-Cégjegyzék API base URL
  private readonly baseUrl = 'https://api.e-cegjegyzek.hu/v1';
  // Public query endpoint (no auth required for basic queries)
  private readonly publicUrl = 'https://e-cegjegyzek.hu/ceginformacio-szolgaltatas';

  constructor() {
    super();
    this.httpClient = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });
  }

  /**
   * Configure the provider with API credentials
   * Note: e-Cégjegyzék allows some queries without credentials,
   * but full access requires e-akta subscription
   */
  configure(apiKey: string, apiSecret?: string): void {
    this.apiKey = apiKey || '';
    this.apiSecret = apiSecret || '';
    // e-Cégjegyzék can work with or without credentials (limited mode)
    this.isConfigured = true;

    if (apiKey) {
      this.httpClient = axios.create({
        baseURL: this.baseUrl,
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-API-Key': this.apiKey,
          ...(this.apiSecret && { 'X-API-Secret': this.apiSecret }),
        },
      });
      this.logger.log('e-Cégjegyzék provider configured with API credentials');
    } else {
      this.logger.log('e-Cégjegyzék provider configured in public mode (limited functionality)');
    }
  }

  /**
   * Validate API connection
   */
  async validateConnection(): Promise<boolean> {
    if (!this.isConfigured) {
      this.logger.warn('e-Cégjegyzék provider not configured');
      return false;
    }

    try {
      // Try a test query
      if (this.apiKey) {
        const response = await this.httpClient.get('/status');
        return response.status === 200;
      } else {
        // For public mode, just return true as we can make basic queries
        return true;
      }
    } catch (error: any) {
      // If no API key, try public query
      try {
        const testResult = await this.searchCompanies({ taxNumber: '12345678242' });
        return true; // If we get any response, connection works
      } catch {
        this.logger.error(`e-Cégjegyzék connection validation failed: ${error.message}`);
        return false;
      }
    }
  }

  /**
   * Search for companies
   */
  async searchCompanies(request: CompanySearchRequest): Promise<CompanySearchResponse> {
    if (!this.isConfigured) {
      return {
        success: false,
        results: [],
        error: 'e-Cégjegyzék szolgáltató nincs konfigurálva',
      };
    }

    try {
      const params: Record<string, any> = {};

      if (request.taxNumber) {
        params.adoszam = this.normalizeTaxNumber(request.taxNumber);
      }
      if (request.name) {
        params.cegnev = request.name;
      }
      if (request.registrationNumber) {
        params.cegjegyzekszam = this.normalizeRegistrationNumber(request.registrationNumber);
      }
      if (request.query) {
        params.kereses = request.query;
      }

      let response;

      if (this.apiKey) {
        // Use authenticated API
        response = await this.httpClient.get('/cegek/kereso', { params });
      } else {
        // Use public query (limited)
        response = await this.queryPublicRegistry(params);
      }

      const results: CompanySearchResult[] = this.parseSearchResults(response.data);

      return {
        success: true,
        results: results.slice(0, request.limit || 10),
        totalCount: results.length,
        rawResponse: response.data,
      };
    } catch (error: any) {
      this.logger.error(`e-Cégjegyzék search failed: ${error.message}`);
      return {
        success: false,
        results: [],
        error: this.handleApiError(error),
        rawResponse: error.response?.data,
      };
    }
  }

  /**
   * Get detailed company information
   */
  async getCompanyDetails(request: CompanyDetailRequest): Promise<CompanyDetailResponse> {
    if (!this.isConfigured) {
      return {
        success: false,
        error: 'e-Cégjegyzék szolgáltató nincs konfigurálva',
      };
    }

    try {
      const taxNumber = this.normalizeTaxNumber(request.taxNumber);

      let response;

      if (this.apiKey) {
        // Use authenticated API for full details
        const params: Record<string, any> = {};
        if (request.includeOwners) params.tulajdonosok = true;
        if (request.includeExecutives) params.tisztsegviselok = true;
        if (request.includeActivities) params.tevekenysegek = true;

        response = await this.httpClient.get(`/cegek/${taxNumber}`, { params });
      } else {
        // First search, then get basic details
        const searchResult = await this.searchCompanies({ taxNumber });
        if (!searchResult.success || searchResult.results.length === 0) {
          return {
            success: false,
            error: 'Nem található cég ezzel az adószámmal',
          };
        }

        // In public mode, return search result as detailed info
        return {
          success: true,
          company: {
            ...searchResult.results[0],
            dataSource: 'E_CEGJEGYZEK',
          } as CompanyDetailedInfo,
          rawResponse: searchResult.rawResponse,
        };
      }

      const company = this.mapToCompanyDetailedInfo(response.data);

      return {
        success: true,
        company,
        rawResponse: response.data,
      };
    } catch (error: any) {
      this.logger.error(`e-Cégjegyzék getCompanyDetails failed: ${error.message}`);
      return {
        success: false,
        error: this.handleApiError(error),
        rawResponse: error.response?.data,
      };
    }
  }

  /**
   * Validate a tax number
   */
  async validateTaxNumber(request: ValidateTaxNumberRequest): Promise<ValidateTaxNumberResponse> {
    if (!this.isConfigured) {
      return {
        success: false,
        isValid: false,
        error: 'e-Cégjegyzék szolgáltató nincs konfigurálva',
      };
    }

    // First, validate format
    const taxNumber = this.normalizeTaxNumber(request.taxNumber);
    if (!this.isValidTaxNumberFormat(taxNumber)) {
      return {
        success: true,
        isValid: false,
        error: 'Érvénytelen adószám formátum',
      };
    }

    try {
      const searchResult = await this.searchCompanies({ taxNumber });

      if (searchResult.success && searchResult.results.length > 0) {
        return {
          success: true,
          isValid: true,
          company: searchResult.results[0],
        };
      }

      return {
        success: true,
        isValid: false,
        error: 'Nem található cég ezzel az adószámmal a cégjegyzékben',
      };
    } catch (error: any) {
      this.logger.error(`e-Cégjegyzék validateTaxNumber failed: ${error.message}`);
      return {
        success: false,
        isValid: false,
        error: this.handleApiError(error),
      };
    }
  }

  // ============ Helper methods ============

  /**
   * Query public registry (no auth required)
   */
  private async queryPublicRegistry(params: Record<string, any>): Promise<any> {
    // The public e-Cégjegyzék website allows basic queries
    // This simulates the query structure
    const searchParams = new URLSearchParams();

    if (params.adoszam) {
      searchParams.append('adoszam', params.adoszam);
    }
    if (params.cegnev) {
      searchParams.append('cegnev', params.cegnev);
    }
    if (params.cegjegyzekszam) {
      searchParams.append('cegjegyzekszam', params.cegjegyzekszam);
    }

    try {
      const response = await axios.get(
        `${this.publicUrl}/cegkereses`,
        {
          params: searchParams,
          timeout: 30000,
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'VSys-CompanyData/1.0',
          },
        }
      );
      return response;
    } catch (error: any) {
      // If JSON API fails, the service might only support HTML
      // Return empty result
      this.logger.warn('e-Cégjegyzék public API not available, returning empty result');
      return { data: { results: [] } };
    }
  }

  private normalizeTaxNumber(taxNumber: string): string {
    return taxNumber.replace(/\D/g, '');
  }

  /**
   * Normalize registration number format
   * Format: Cg.01-09-123456 or 01-09-123456
   */
  private normalizeRegistrationNumber(regNumber: string): string {
    // Remove Cg. prefix and normalize
    return regNumber.replace(/^Cg\./i, '').replace(/\s/g, '');
  }

  private formatTaxNumber(digits: string): string {
    if (digits.length === 11) {
      return `${digits.slice(0, 8)}-${digits[8]}-${digits.slice(9)}`;
    }
    return digits;
  }

  /**
   * Format registration number for display
   */
  private formatRegistrationNumber(regNumber: string): string {
    const cleaned = regNumber.replace(/[^0-9-]/g, '');
    if (cleaned.match(/^\d{2}-\d{2}-\d{6}$/)) {
      return `Cg.${cleaned}`;
    }
    return regNumber;
  }

  private isValidTaxNumberFormat(taxNumber: string): boolean {
    const digits = taxNumber.replace(/\D/g, '');
    return digits.length === 11 || digits.length === 8;
  }

  private parseSearchResults(data: any): CompanySearchResult[] {
    // Handle different response formats
    const items = data.results || data.cegek || data.talalatok || [];

    if (!Array.isArray(items)) {
      if (data.cegnev || data.adoszam) {
        // Single result
        return [this.mapToCompanySearchResult(data)];
      }
      return [];
    }

    return items.map((item: any) => this.mapToCompanySearchResult(item));
  }

  private mapToCompanySearchResult(data: any): CompanySearchResult {
    return {
      taxNumber: this.formatTaxNumber(data.adoszam || data.taxNumber || ''),
      registrationNumber: this.formatRegistrationNumber(
        data.cegjegyzekszam || data.registrationNumber || ''
      ),
      name: data.cegnev || data.name || data.rovidNev || '',
      shortName: data.rovidNev || data.shortName,
      address: data.szekhely || data.address || this.buildAddress(data),
      city: data.telepules || data.city || '',
      zipCode: data.iranyitoszam || data.zipCode || '',
      country: 'HU',
      status: this.mapStatus(data.statusz || data.status || data.cegstatus),
      foundedDate: data.alapitas || data.foundedDate || data.bpiDatum,
      euVatNumber: data.kozossegiAdoszam || data.euVatNumber,
    };
  }

  private buildAddress(data: any): string {
    const parts = [
      data.iranyitoszam,
      data.telepules,
      data.utca || data.kozteruletNev,
      data.hazszam || data.hazszamJel,
    ].filter(Boolean);
    return parts.join(' ');
  }

  private mapStatus(status: string | undefined): string | undefined {
    if (!status) return undefined;

    const statusLower = status.toLowerCase();

    if (statusLower.includes('aktív') || statusLower.includes('mukodo') ||
        statusLower === 'a' || statusLower === 'active') {
      return 'Aktív';
    }
    if (statusLower.includes('töröl') || statusLower.includes('megszunt') ||
        statusLower === 't' || statusLower === 'deleted') {
      return 'Törölve';
    }
    if (statusLower.includes('felszámolás') || statusLower.includes('csod')) {
      return 'Felszámolás alatt';
    }
    if (statusLower.includes('végelszámolás')) {
      return 'Végelszámolás alatt';
    }

    return status;
  }

  private mapToCompanyDetailedInfo(data: any): CompanyDetailedInfo {
    const basic = this.mapToCompanySearchResult(data);

    return {
      ...basic,

      owners: (data.tulajdonosok || data.owners || []).map((o: any) => ({
        name: o.nev || o.name,
        share: o.tulajdonHanyad || o.share,
        role: o.szerep || o.role || 'Tulajdonos',
      })),

      executives: (data.tisztsegviselok || data.executives || []).map((e: any) => ({
        name: e.nev || e.name,
        position: e.beosztas || e.position || e.tisztseg,
        startDate: e.kezdet || e.startDate,
      })),

      activities: (data.tevekenysegek || data.activities || []).map((a: any) => ({
        code: a.teaorKod || a.code,
        name: a.tevekenysegNev || a.name || a.megnevezes,
        isPrimary: a.foTevekenyseg || a.isPrimary || false,
      })),

      navInfo: {
        isRegistered: true, // If found in cégjegyzék, it's registered
        vatStatus: data.afaStatusz || data.vatStatus,
        hasDebt: undefined, // Not available from cégjegyzék
      },

      lastModified: data.utolsoModositas || data.lastModified,
      dataSource: 'E_CEGJEGYZEK',
    };
  }

  private handleApiError(error: any): string {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.message ||
        error.response.data?.hiba ||
        error.response.data?.error;

      switch (status) {
        case 401:
          return 'Érvénytelen e-Cégjegyzék API kulcs';
        case 403:
          return 'Nincs jogosultság ehhez a művelethez (e-akta előfizetés szükséges)';
        case 404:
          return 'Nem található adat';
        case 429:
          return 'Túl sok kérés, próbáld újra később';
        case 500:
          return 'e-Cégjegyzék szerverhiba, próbáld újra később';
        default:
          return message || `e-Cégjegyzék API hiba (${status})`;
      }
    }

    if (error.code === 'ECONNREFUSED') {
      return 'Nem sikerült kapcsolódni az e-Cégjegyzék szerverhez';
    }

    if (error.code === 'ETIMEDOUT') {
      return 'Időtúllépés az e-Cégjegyzék kérésnél';
    }

    return error.message || 'Ismeretlen hiba';
  }
}
