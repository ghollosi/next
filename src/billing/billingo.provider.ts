import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  InvoiceProvider,
  CreateInvoiceRequest,
  CreateInvoiceResponse,
  CancelInvoiceRequest,
  CancelInvoiceResponse,
  GetInvoicePdfRequest,
  GetInvoicePdfResponse,
} from './invoice-provider.interface';

/**
 * Billingo API v3 invoice provider implementation
 * API documentation: https://app.swaggerhub.com/apis/Billingo/Billingo/3.0.0
 */
@Injectable()
export class BillingoProvider extends InvoiceProvider {
  private readonly logger = new Logger(BillingoProvider.name);
  readonly providerName = 'billingo';

  private readonly apiUrl = 'https://api.billingo.hu/v3';

  // These can be set dynamically per-network
  private apiKey: string;
  private blockId: number;
  private bankAccountId: number;

  constructor(private configService: ConfigService) {
    super();
    // Default values from env (can be overridden per network)
    this.apiKey = this.configService.get<string>('BILLINGO_API_KEY', '');
    this.blockId = this.configService.get<number>('BILLINGO_BLOCK_ID', 0);
    this.bankAccountId = this.configService.get<number>('BILLINGO_BANK_ACCOUNT_ID', 0);
  }

  /**
   * Configure the provider with network-specific settings
   */
  configure(apiKey: string, blockId: number, bankAccountId?: number): void {
    this.apiKey = apiKey;
    this.blockId = blockId;
    if (bankAccountId) {
      this.bankAccountId = bankAccountId;
    }
  }

  /**
   * Create a partner in Billingo (required before creating invoice)
   */
  private async createOrGetPartner(customer: CreateInvoiceRequest['customer']): Promise<number> {
    // First try to find existing partner by tax number
    if (customer.taxNumber) {
      const searchResult = await this.apiRequest('GET', `/partners?query=${encodeURIComponent(customer.taxNumber)}`);
      if (searchResult?.data?.length > 0) {
        return searchResult.data[0].id;
      }
    }

    // Create new partner
    const partnerData = {
      name: customer.name,
      address: {
        country_code: this.mapCountryCode(customer.country),
        post_code: customer.zipCode,
        city: customer.city,
        address: customer.address,
      },
      taxcode: customer.taxNumber || '',
      ...(customer.euVatNumber && { eutaxcode: customer.euVatNumber }),
    };

    const result = await this.apiRequest('POST', '/partners', partnerData);
    return result.id;
  }

  async createInvoice(request: CreateInvoiceRequest): Promise<CreateInvoiceResponse> {
    try {
      if (!this.apiKey || !this.blockId) {
        throw new Error('Billingo API key or Block ID not configured');
      }

      // Create or get partner
      const partnerId = await this.createOrGetPartner(request.customer);

      // Map payment method
      const paymentMethodMap: Record<string, string> = {
        cash: 'cash',
        transfer: 'wire_transfer',
        card: 'bankcard',
        other: 'other',
      };

      // Calculate dates
      const fulfillmentDate = new Date().toISOString().split('T')[0];
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + request.paymentDueDays);

      // Map items
      const items = request.items.map((item) => ({
        name: item.description,
        unit_price: item.unitPrice,
        unit_price_type: 'net', // We're working with net prices
        quantity: item.quantity,
        unit: item.unit || 'db',
        vat: this.mapVatRate(item.vatRate),
      }));

      const invoiceData = {
        partner_id: partnerId,
        block_id: this.blockId,
        bank_account_id: this.bankAccountId || undefined,
        type: 'invoice',
        fulfillment_date: fulfillmentDate,
        due_date: dueDate.toISOString().split('T')[0],
        payment_method: paymentMethodMap[request.paymentMethod] || 'wire_transfer',
        language: request.language || 'hu',
        currency: request.currency || 'HUF',
        electronic: true, // e-számla
        items,
        ...(request.comment && { comment: request.comment }),
        settings: {
          should_send_email: request.sendEmail || false,
        },
      };

      this.logger.debug('Creating Billingo invoice', { partnerId, blockId: this.blockId });

      const result = await this.apiRequest('POST', '/documents', invoiceData);

      if (result?.id) {
        return {
          success: true,
          invoiceNumber: result.invoice_number,
          externalId: String(result.id),
          pdfUrl: `${this.apiUrl}/documents/${result.id}/download`,
          rawResponse: result,
        };
      } else {
        return {
          success: false,
          error: 'No invoice ID returned from Billingo',
          rawResponse: result,
        };
      }
    } catch (error: any) {
      this.logger.error('Error creating Billingo invoice', error);
      return {
        success: false,
        error: error.message || 'Unknown error creating invoice',
      };
    }
  }

  async cancelInvoice(request: CancelInvoiceRequest): Promise<CancelInvoiceResponse> {
    try {
      if (!this.apiKey) {
        throw new Error('Billingo API key not configured');
      }

      // Get document ID from invoice number
      const searchResult = await this.apiRequest(
        'GET',
        `/documents?invoice_number=${encodeURIComponent(request.invoiceNumber)}`
      );

      if (!searchResult?.data?.length) {
        return {
          success: false,
          error: `Invoice not found: ${request.invoiceNumber}`,
        };
      }

      const documentId = searchResult.data[0].id;

      // Create cancellation invoice (storno)
      const cancelData = {
        cancellation_reason: request.reason || 'Számla sztornózása',
      };

      const result = await this.apiRequest(
        'POST',
        `/documents/${documentId}/cancel`,
        cancelData
      );

      if (result?.id) {
        return {
          success: true,
          cancelledInvoiceNumber: result.invoice_number,
        };
      } else {
        return {
          success: false,
          error: 'Failed to cancel invoice',
        };
      }
    } catch (error: any) {
      this.logger.error('Error cancelling Billingo invoice', error);
      return {
        success: false,
        error: error.message || 'Unknown error cancelling invoice',
      };
    }
  }

  async getInvoicePdf(request: GetInvoicePdfRequest): Promise<GetInvoicePdfResponse> {
    try {
      if (!this.apiKey) {
        throw new Error('Billingo API key not configured');
      }

      // Get document ID from invoice number
      const searchResult = await this.apiRequest(
        'GET',
        `/documents?invoice_number=${encodeURIComponent(request.invoiceNumber)}`
      );

      if (!searchResult?.data?.length) {
        return {
          success: false,
          error: `Invoice not found: ${request.invoiceNumber}`,
        };
      }

      const documentId = searchResult.data[0].id;

      // Download PDF
      const response = await fetch(`${this.apiUrl}/documents/${documentId}/download`, {
        method: 'GET',
        headers: {
          'X-API-KEY': this.apiKey,
          'Accept': 'application/pdf',
        },
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to download PDF: HTTP ${response.status}`,
        };
      }

      const buffer = await response.arrayBuffer();

      return {
        success: true,
        pdfBuffer: Buffer.from(buffer),
      };
    } catch (error: any) {
      this.logger.error('Error getting Billingo invoice PDF', error);
      return {
        success: false,
        error: error.message || 'Unknown error getting PDF',
      };
    }
  }

  async validateConnection(): Promise<boolean> {
    try {
      if (!this.apiKey) {
        return false;
      }

      // Try to get document blocks to validate connection
      const result = await this.apiRequest('GET', '/document-blocks');
      return Array.isArray(result?.data);
    } catch (error) {
      this.logger.error('Billingo connection validation failed', error);
      return false;
    }
  }

  /**
   * Get available document blocks (számlatömbök)
   */
  async getDocumentBlocks(): Promise<Array<{ id: number; name: string; prefix: string }>> {
    try {
      const result = await this.apiRequest('GET', '/document-blocks');
      return result?.data?.map((block: any) => ({
        id: block.id,
        name: block.name,
        prefix: block.prefix,
      })) || [];
    } catch (error) {
      this.logger.error('Failed to get document blocks', error);
      return [];
    }
  }

  /**
   * Get available bank accounts
   */
  async getBankAccounts(): Promise<Array<{ id: number; name: string; accountNumber: string }>> {
    try {
      const result = await this.apiRequest('GET', '/bank-accounts');
      return result?.data?.map((account: any) => ({
        id: account.id,
        name: account.name,
        accountNumber: account.account_number,
      })) || [];
    } catch (error) {
      this.logger.error('Failed to get bank accounts', error);
      return [];
    }
  }

  // =========================================================================
  // PRIVATE HELPERS
  // =========================================================================

  private async apiRequest(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    body?: any,
  ): Promise<any> {
    const url = `${this.apiUrl}${endpoint}`;

    const headers: Record<string, string> = {
      'X-API-KEY': this.apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const text = await response.text();

    if (!response.ok) {
      this.logger.error(`Billingo API error: ${response.status} - ${text}`);
      throw new Error(`Billingo API error: ${response.status} - ${text}`);
    }

    return text ? JSON.parse(text) : null;
  }

  private mapCountryCode(country: string): string {
    // Map country names/codes to ISO 2-letter codes
    const countryMap: Record<string, string> = {
      'Magyarország': 'HU',
      'Hungary': 'HU',
      'HU': 'HU',
      'Szlovákia': 'SK',
      'Slovakia': 'SK',
      'SK': 'SK',
      'Románia': 'RO',
      'Romania': 'RO',
      'RO': 'RO',
      'Ausztria': 'AT',
      'Austria': 'AT',
      'AT': 'AT',
      'Németország': 'DE',
      'Germany': 'DE',
      'DE': 'DE',
    };
    return countryMap[country] || country || 'HU';
  }

  private mapVatRate(vatRate: number): string {
    // Billingo VAT codes
    // See: https://api.billingo.hu/v3 documentation
    if (vatRate === 0) return '0%';
    if (vatRate === 5) return '5%';
    if (vatRate === 18) return '18%';
    if (vatRate === 27) return '27%';
    // Special VAT codes
    if (vatRate === -1) return 'AAM'; // ÁFA mentes (alanyi)
    if (vatRate === -2) return 'TAM'; // Tárgyi adómentes
    if (vatRate === -3) return 'EU'; // EU outside Hungary
    if (vatRate === -4) return 'EUK'; // EU outside Hungary (services)
    if (vatRate === -5) return 'MAA'; // Magyar ÁFA alany

    return `${vatRate}%`;
  }
}
