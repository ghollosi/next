/**
 * Abstract interface for company data providers (Opten, Bisnode, e-Cégjegyzék, etc.)
 * Used for Hungarian company registry lookups, VAT number validation, and risk assessment.
 */

export interface CompanySearchResult {
  taxNumber: string;           // Adószám (pl. 12345678-2-42)
  registrationNumber?: string; // Cégjegyzékszám
  name: string;                // Cégnév
  shortName?: string;          // Rövidített cégnév
  address: string;             // Székhely cím
  city: string;                // Település
  zipCode: string;             // Irányítószám
  country: string;             // Ország kód (HU, AT, DE, etc.)
  status?: string;             // Státusz (aktív, törölve, stb.)
  foundedDate?: string;        // Alapítás dátuma
  euVatNumber?: string;        // EU közösségi adószám
}

export interface CompanyDetailedInfo extends CompanySearchResult {
  // Tulajdonosi információk
  owners?: Array<{
    name: string;
    share?: number;            // Tulajdoni hányad %
    role?: string;             // Szerep (tulajdonos, ügyvezető, stb.)
  }>;

  // Vezetők
  executives?: Array<{
    name: string;
    position: string;          // Beosztás
    startDate?: string;
  }>;

  // Pénzügyi adatok
  financials?: {
    annualRevenue?: number;     // Éves árbevétel
    annualProfit?: number;      // Éves eredmény
    employeeCount?: number;     // Létszám
    equityCapital?: number;     // Saját tőke
    year?: number;              // Pénzügyi év
    currency?: string;          // Pénznem
  };

  // Kockázati értékelés (Opten specifikus)
  riskInfo?: {
    riskClass?: string;         // Kockázati osztály (A, B, C, D, E)
    riskScore?: number;         // Kockázati pontszám (0-100)
    paymentMorale?: string;     // Fizetési morál
    bankruptcyProbability?: number;  // Csődvalószínűség %
    creditLimit?: number;       // Javasolt hitelkeret
    lastUpdated?: string;
  };

  // NAV kapcsolat
  navInfo?: {
    isRegistered: boolean;
    vatStatus?: string;         // Áfa státusz
    hasDebt?: boolean;          // Van-e NAV tartozása
  };

  // Tevékenységek
  activities?: Array<{
    code: string;               // TEÁOR kód
    name: string;               // Tevékenység neve
    isPrimary: boolean;         // Főtevékenység-e
  }>;

  // Változások
  lastModified?: string;        // Utolsó módosítás dátuma
  dataSource?: string;          // Adatforrás
}

export interface CompanySearchRequest {
  query?: string;              // Szabad szöveges keresés
  taxNumber?: string;          // Adószámra keresés
  name?: string;               // Cégnévre keresés
  registrationNumber?: string; // Cégjegyzékszámra keresés
  limit?: number;              // Max találatok száma (default: 10)
}

export interface CompanySearchResponse {
  success: boolean;
  results: CompanySearchResult[];
  totalCount?: number;
  error?: string;
  rawResponse?: any;
}

export interface CompanyDetailRequest {
  taxNumber: string;           // Adószám (kötelező)
  includeFinancials?: boolean; // Pénzügyi adatok lekérése
  includeRiskInfo?: boolean;   // Kockázati értékelés lekérése
  includeOwners?: boolean;     // Tulajdonosok lekérése
  includeExecutives?: boolean; // Vezetők lekérése
  includeActivities?: boolean; // Tevékenységek lekérése
}

export interface CompanyDetailResponse {
  success: boolean;
  company?: CompanyDetailedInfo;
  error?: string;
  rawResponse?: any;
}

export interface ValidateTaxNumberRequest {
  taxNumber: string;
}

export interface ValidateTaxNumberResponse {
  success: boolean;
  isValid: boolean;
  company?: CompanySearchResult;
  error?: string;
}

/**
 * Abstract interface that all company data providers must implement
 */
export abstract class CompanyDataProvider {
  abstract readonly providerName: string;

  /**
   * Search for companies by various criteria
   */
  abstract searchCompanies(request: CompanySearchRequest): Promise<CompanySearchResponse>;

  /**
   * Get detailed company information by tax number
   */
  abstract getCompanyDetails(request: CompanyDetailRequest): Promise<CompanyDetailResponse>;

  /**
   * Validate a Hungarian tax number and get basic company info
   */
  abstract validateTaxNumber(request: ValidateTaxNumberRequest): Promise<ValidateTaxNumberResponse>;

  /**
   * Validate connection/credentials
   */
  abstract validateConnection(): Promise<boolean>;

  /**
   * Configure the provider with credentials
   */
  abstract configure(apiKey: string, apiSecret?: string): void;
}
