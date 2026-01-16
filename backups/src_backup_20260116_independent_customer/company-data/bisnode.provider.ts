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
 * Bisnode (Dun & Bradstreet Hungary) cégadatbázis provider
 *
 * A Bisnode (ma D&B Hungary) Magyarország egyik vezető üzleti információs szolgáltatója.
 * API dokumentáció: https://www.dnb.com/hu-hu/
 *
 * A Bisnode API a D&B Direct+ platformon keresztül érhető el.
 */
@Injectable()
export class BisnodeProvider extends CompanyDataProvider {
  readonly providerName = 'bisnode';
  private readonly logger = new Logger(BisnodeProvider.name);

  private apiKey: string = '';
  private apiSecret: string = '';
  private httpClient: AxiosInstance;
  private isConfigured = false;
  private accessToken: string = '';
  private tokenExpiry: Date | null = null;

  // Bisnode D&B Direct+ API base URL
  private readonly baseUrl = 'https://plus.dnb.com/v1';
  private readonly authUrl = 'https://plus.dnb.com/v2/token';

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
    this.isConfigured = !!(apiKey && apiSecret);
    this.accessToken = '';
    this.tokenExpiry = null;

    this.logger.log('Bisnode provider configured');
  }

  /**
   * Get OAuth access token
   */
  private async getAccessToken(): Promise<string> {
    // Check if we have a valid token
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const credentials = Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString('base64');

      const response = await axios.post(
        this.authUrl,
        'grant_type=client_credentials',
        {
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      this.accessToken = response.data.access_token;
      // Token typically expires in 1 hour, set expiry to 55 minutes to be safe
      this.tokenExpiry = new Date(Date.now() + 55 * 60 * 1000);

      this.logger.log('Bisnode access token obtained');
      return this.accessToken;
    } catch (error: any) {
      this.logger.error(`Failed to get Bisnode access token: ${error.message}`);
      throw new Error('Bisnode authentikáció sikertelen');
    }
  }

  /**
   * Create authenticated HTTP client
   */
  private async getAuthenticatedClient(): Promise<AxiosInstance> {
    const token = await this.getAccessToken();

    return axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
  }

  /**
   * Validate API connection
   */
  async validateConnection(): Promise<boolean> {
    if (!this.isConfigured) {
      this.logger.warn('Bisnode provider not configured');
      return false;
    }

    try {
      await this.getAccessToken();
      return true;
    } catch (error: any) {
      this.logger.error(`Bisnode connection validation failed: ${error.message}`);
      return false;
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
        error: 'Bisnode szolgáltató nincs konfigurálva',
      };
    }

    try {
      const client = await this.getAuthenticatedClient();

      // Build search criteria
      const searchCriteria: any = {
        countryISOAlpha2Code: 'HU',
      };

      if (request.taxNumber) {
        searchCriteria.registrationNumber = this.normalizeTaxNumber(request.taxNumber);
      }
      if (request.name) {
        searchCriteria.searchTerm = request.name;
      }
      if (request.query) {
        searchCriteria.searchTerm = request.query;
      }
      if (request.registrationNumber) {
        searchCriteria.registrationNumber = request.registrationNumber;
      }

      const response = await client.post('/search/companyList', {
        searchCriteria,
        candidateMaximumQuantity: request.limit || 10,
      });

      const results: CompanySearchResult[] = (response.data.searchCandidates || []).map((item: any) =>
        this.mapToCompanySearchResult(item)
      );

      return {
        success: true,
        results,
        totalCount: response.data.candidatesReturnedQuantity || results.length,
        rawResponse: response.data,
      };
    } catch (error: any) {
      this.logger.error(`Bisnode search failed: ${error.message}`);
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
        error: 'Bisnode szolgáltató nincs konfigurálva',
      };
    }

    try {
      const client = await this.getAuthenticatedClient();

      // First search for DUNS number by tax number
      const searchResult = await this.searchCompanies({ taxNumber: request.taxNumber });

      if (!searchResult.success || searchResult.results.length === 0) {
        return {
          success: false,
          error: 'Nem található cég ezzel az adószámmal',
        };
      }

      // Get the DUNS number from search result
      const dunsNumber = (searchResult.rawResponse?.searchCandidates?.[0]?.organization?.duns) ||
        this.extractDunsFromResult(searchResult.results[0]);

      if (!dunsNumber) {
        // If no DUNS, return basic info from search
        return {
          success: true,
          company: searchResult.results[0] as CompanyDetailedInfo,
          rawResponse: searchResult.rawResponse,
        };
      }

      // Build product request based on options
      const productIds: string[] = ['cmpelk']; // Basic company info

      if (request.includeFinancials) productIds.push('fi_fin');
      if (request.includeOwners) productIds.push('cmpbol');
      if (request.includeExecutives) productIds.push('cmpbol');

      const response = await client.get(`/data/duns/${dunsNumber}`, {
        params: {
          productId: productIds.join(','),
          versionId: 'v1',
        },
      });

      const company = this.mapToCompanyDetailedInfo(response.data);

      return {
        success: true,
        company,
        rawResponse: response.data,
      };
    } catch (error: any) {
      this.logger.error(`Bisnode getCompanyDetails failed: ${error.message}`);
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
        error: 'Bisnode szolgáltató nincs konfigurálva',
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
        error: 'Nem található cég ezzel az adószámmal',
      };
    } catch (error: any) {
      this.logger.error(`Bisnode validateTaxNumber failed: ${error.message}`);
      return {
        success: false,
        isValid: false,
        error: this.handleApiError(error),
      };
    }
  }

  // ============ Helper methods ============

  private normalizeTaxNumber(taxNumber: string): string {
    return taxNumber.replace(/\D/g, '');
  }

  private formatTaxNumber(digits: string): string {
    if (digits.length === 11) {
      return `${digits.slice(0, 8)}-${digits[8]}-${digits.slice(9)}`;
    }
    return digits;
  }

  private isValidTaxNumberFormat(taxNumber: string): boolean {
    const digits = taxNumber.replace(/\D/g, '');
    return digits.length === 11 || digits.length === 8;
  }

  private extractDunsFromResult(result: CompanySearchResult): string | null {
    // DUNS number might be stored in registrationNumber for D&B results
    return null;
  }

  private mapToCompanySearchResult(data: any): CompanySearchResult {
    const org = data.organization || {};
    const primaryAddress = org.primaryAddress || {};

    return {
      taxNumber: this.formatTaxNumber(
        org.registrationNumbers?.find((r: any) => r.typeDnBCode === 6863)?.registrationNumber ||
        org.taxIdentificationNumber || ''
      ),
      registrationNumber: org.registrationNumbers?.find((r: any) =>
        r.typeDnBCode === 1358)?.registrationNumber,
      name: org.primaryName || '',
      shortName: org.tradeStyleNames?.[0]?.name,
      address: [
        primaryAddress.streetAddressLine?.map((l: any) => l.lineText).join(' '),
      ].filter(Boolean).join(', '),
      city: primaryAddress.addressLocality?.name || '',
      zipCode: primaryAddress.postalCode || '',
      country: primaryAddress.addressCountry?.isoAlpha2Code || 'HU',
      status: org.dunsControlStatus?.operatingStatus?.description,
      foundedDate: org.startDate,
      euVatNumber: org.registrationNumbers?.find((r: any) =>
        r.typeDnBCode === 6862)?.registrationNumber,
    };
  }

  private mapToCompanyDetailedInfo(data: any): CompanyDetailedInfo {
    const org = data.organization || {};
    const basic = this.mapToCompanySearchResult({ organization: org });

    return {
      ...basic,

      owners: org.principals?.filter((p: any) => p.isShareholderIndicator)?.map((p: any) => ({
        name: p.fullName,
        share: p.ownershipPercentage,
        role: p.jobTitles?.[0]?.title,
      })),

      executives: org.principals?.filter((p: any) => !p.isShareholderIndicator)?.map((p: any) => ({
        name: p.fullName,
        position: p.jobTitles?.[0]?.title || p.managementResponsibilities?.[0]?.description,
        startDate: p.startDate,
      })),

      financials: org.financials?.[0] ? {
        annualRevenue: org.financials[0].yearlyRevenue?.[0]?.value,
        annualProfit: org.financials[0].netIncome?.value,
        employeeCount: org.numberOfEmployees?.[0]?.value,
        equityCapital: org.financials[0].totalEquity?.value,
        year: org.financials[0].financialStatementToDate?.substring(0, 4),
        currency: org.financials[0].yearlyRevenue?.[0]?.currency || 'HUF',
      } : undefined,

      riskInfo: org.assessment ? {
        riskClass: org.assessment.overallRiskClass,
        riskScore: org.assessment.overallRiskScore,
        paymentMorale: org.assessment.paymentBehavior?.paydexScore?.toString(),
        bankruptcyProbability: org.assessment.failureProbability?.probabilityPercentage,
        creditLimit: org.assessment.creditLimitRecommendation?.recommendedLimit?.value,
        lastUpdated: org.assessment.lastUpdateDate,
      } : undefined,

      activities: org.industryCodes?.map((a: any) => ({
        code: a.code,
        name: a.description,
        isPrimary: a.priority === 1,
      })),

      lastModified: org.lastUpdateDate,
      dataSource: 'BISNODE',
    };
  }

  private handleApiError(error: any): string {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.error?.message ||
        error.response.data?.errorMessage;

      switch (status) {
        case 401:
          return 'Érvénytelen Bisnode API kulcs';
        case 403:
          return 'Nincs jogosultság ehhez a művelethez';
        case 404:
          return 'Nem található adat';
        case 429:
          return 'Túl sok kérés, próbáld újra később';
        case 500:
          return 'Bisnode szerverhiba, próbáld újra később';
        default:
          return message || `Bisnode API hiba (${status})`;
      }
    }

    if (error.code === 'ECONNREFUSED') {
      return 'Nem sikerült kapcsolódni a Bisnode szerverhez';
    }

    if (error.code === 'ETIMEDOUT') {
      return 'Időtúllépés a Bisnode kérésnél';
    }

    return error.message || 'Ismeretlen hiba';
  }
}
