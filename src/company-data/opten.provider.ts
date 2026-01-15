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
 * OPTEN cégadatbázis provider
 *
 * Az Opten Magyarország vezető céginformációs szolgáltatója.
 * API dokumentáció: https://api.opten.hu
 *
 * Megjegyzés: Az Opten SOAP és REST API-t is biztosít.
 * Ez az implementáció a REST API-t használja.
 */
@Injectable()
export class OptenProvider extends CompanyDataProvider {
  readonly providerName = 'opten';
  private readonly logger = new Logger(OptenProvider.name);

  private apiKey: string = '';
  private apiSecret: string = '';
  private httpClient: AxiosInstance;
  private isConfigured = false;

  // Opten API base URL
  private readonly baseUrl = 'https://api.opten.hu/api/v1';

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
   */
  configure(apiKey: string, apiSecret?: string): void {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret || '';
    this.isConfigured = !!(apiKey);

    // Update HTTP client with authentication
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

    this.logger.log('Opten provider configured');
  }

  /**
   * Validate API connection
   */
  async validateConnection(): Promise<boolean> {
    if (!this.isConfigured) {
      this.logger.warn('Opten provider not configured');
      return false;
    }

    try {
      // Try a simple search to validate credentials
      const response = await this.httpClient.get('/status');
      return response.status === 200;
    } catch (error: any) {
      // If status endpoint doesn't exist, try a minimal search
      try {
        const testSearch = await this.searchCompanies({ taxNumber: '12345678242' });
        return testSearch.success || !testSearch.error?.includes('unauthorized');
      } catch {
        this.logger.error(`Opten connection validation failed: ${error.message}`);
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
        error: 'Opten szolgáltató nincs konfigurálva',
      };
    }

    try {
      const params: Record<string, any> = {
        limit: request.limit || 10,
      };

      if (request.taxNumber) {
        params.taxNumber = this.normalizeTaxNumber(request.taxNumber);
      }
      if (request.name) {
        params.name = request.name;
      }
      if (request.registrationNumber) {
        params.registrationNumber = request.registrationNumber;
      }
      if (request.query) {
        params.q = request.query;
      }

      const response = await this.httpClient.get('/companies/search', { params });

      const results: CompanySearchResult[] = (response.data.results || []).map((item: any) =>
        this.mapToCompanySearchResult(item)
      );

      return {
        success: true,
        results,
        totalCount: response.data.totalCount || results.length,
        rawResponse: response.data,
      };
    } catch (error: any) {
      this.logger.error(`Opten search failed: ${error.message}`);
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
        error: 'Opten szolgáltató nincs konfigurálva',
      };
    }

    try {
      const taxNumber = this.normalizeTaxNumber(request.taxNumber);
      const params: Record<string, any> = {};

      if (request.includeFinancials) params.includeFinancials = true;
      if (request.includeRiskInfo) params.includeRiskInfo = true;
      if (request.includeOwners) params.includeOwners = true;
      if (request.includeExecutives) params.includeExecutives = true;
      if (request.includeActivities) params.includeActivities = true;

      const response = await this.httpClient.get(`/companies/${taxNumber}`, { params });

      const company = this.mapToCompanyDetailedInfo(response.data);

      return {
        success: true,
        company,
        rawResponse: response.data,
      };
    } catch (error: any) {
      this.logger.error(`Opten getCompanyDetails failed: ${error.message}`);
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
        error: 'Opten szolgáltató nincs konfigurálva',
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
      // Search for the company
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
        error: 'Nem található cég ezzel az adószámmal',
      };
    } catch (error: any) {
      this.logger.error(`Opten validateTaxNumber failed: ${error.message}`);
      return {
        success: false,
        isValid: false,
        error: this.handleApiError(error),
      };
    }
  }

  // ============ Helper methods ============

  /**
   * Normalize Hungarian tax number to 11-digit format
   * Input formats: 12345678-2-42, 12345678242, 12345678 2 42
   */
  private normalizeTaxNumber(taxNumber: string): string {
    // Remove all non-digit characters
    const digits = taxNumber.replace(/\D/g, '');

    // Hungarian tax number should be 11 digits
    if (digits.length === 11) {
      return digits;
    }

    // If it's 8 digits, it might be just the base number (needs VAT code + county)
    if (digits.length === 8) {
      return digits; // Return as-is, API might handle it
    }

    return digits;
  }

  /**
   * Format tax number for display (12345678-2-42)
   */
  private formatTaxNumber(digits: string): string {
    if (digits.length === 11) {
      return `${digits.slice(0, 8)}-${digits[8]}-${digits.slice(9)}`;
    }
    return digits;
  }

  /**
   * Validate tax number format
   */
  private isValidTaxNumberFormat(taxNumber: string): boolean {
    const digits = taxNumber.replace(/\D/g, '');
    // Hungarian tax number: 8 digit company ID + 1 digit VAT code + 2 digit county code
    return digits.length === 11 || digits.length === 8;
  }

  /**
   * Map API response to CompanySearchResult
   */
  private mapToCompanySearchResult(data: any): CompanySearchResult {
    return {
      taxNumber: this.formatTaxNumber(data.taxNumber || data.adoszam || ''),
      registrationNumber: data.registrationNumber || data.cegjegyzekszam,
      name: data.name || data.cegnev || '',
      shortName: data.shortName || data.rovidnev,
      address: data.address || data.szekhely || '',
      city: data.city || data.telepules || '',
      zipCode: data.zipCode || data.iranyitoszam || '',
      country: data.country || 'HU',
      status: data.status || data.statusz,
      foundedDate: data.foundedDate || data.alapitas,
      euVatNumber: data.euVatNumber || data.kozossegi_adoszam,
    };
  }

  /**
   * Map API response to CompanyDetailedInfo
   */
  private mapToCompanyDetailedInfo(data: any): CompanyDetailedInfo {
    const basic = this.mapToCompanySearchResult(data);

    return {
      ...basic,

      owners: data.owners?.map((o: any) => ({
        name: o.name || o.nev,
        share: o.share || o.tulajdoni_hanyad,
        role: o.role || o.szerep,
      })),

      executives: data.executives?.map((e: any) => ({
        name: e.name || e.nev,
        position: e.position || e.beosztas,
        startDate: e.startDate || e.kezdet,
      })),

      financials: data.financials ? {
        annualRevenue: data.financials.revenue || data.financials.arbevetel,
        annualProfit: data.financials.profit || data.financials.eredmeny,
        employeeCount: data.financials.employees || data.financials.letszam,
        equityCapital: data.financials.equity || data.financials.sajat_toke,
        year: data.financials.year || data.financials.ev,
        currency: data.financials.currency || 'HUF',
      } : undefined,

      riskInfo: data.riskInfo || data.kockazat ? {
        riskClass: data.riskInfo?.riskClass || data.kockazat?.osztaly,
        riskScore: data.riskInfo?.riskScore || data.kockazat?.pontszam,
        paymentMorale: data.riskInfo?.paymentMorale || data.kockazat?.fizetesi_moral,
        bankruptcyProbability: data.riskInfo?.bankruptcyProb || data.kockazat?.csod_valoszinuseg,
        creditLimit: data.riskInfo?.creditLimit || data.kockazat?.hitelkeret,
        lastUpdated: data.riskInfo?.updatedAt || data.kockazat?.frissitve,
      } : undefined,

      navInfo: data.navInfo ? {
        isRegistered: data.navInfo.isRegistered ?? true,
        vatStatus: data.navInfo.vatStatus,
        hasDebt: data.navInfo.hasDebt,
      } : undefined,

      activities: data.activities?.map((a: any) => ({
        code: a.code || a.teaor,
        name: a.name || a.nev,
        isPrimary: a.isPrimary || a.fo_tevekenyseg || false,
      })),

      lastModified: data.lastModified || data.utolso_modositas,
      dataSource: 'OPTEN',
    };
  }

  /**
   * Handle API errors
   */
  private handleApiError(error: any): string {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.message || error.response.data?.error;

      switch (status) {
        case 401:
          return 'Érvénytelen Opten API kulcs';
        case 403:
          return 'Nincs jogosultság ehhez a művelethez';
        case 404:
          return 'Nem található adat';
        case 429:
          return 'Túl sok kérés, próbáld újra később';
        case 500:
          return 'Opten szerverhiba, próbáld újra később';
        default:
          return message || `Opten API hiba (${status})`;
      }
    }

    if (error.code === 'ECONNREFUSED') {
      return 'Nem sikerült kapcsolódni az Opten szerverhez';
    }

    if (error.code === 'ETIMEDOUT') {
      return 'Időtúllépés az Opten kérésnél';
    }

    return error.message || 'Ismeretlen hiba';
  }
}
