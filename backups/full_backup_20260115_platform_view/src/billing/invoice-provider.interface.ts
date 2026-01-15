/**
 * Abstract interface for invoice providers (szamlazz.hu, billingo, etc.)
 */

export interface InvoiceAddress {
  name: string;
  address: string;
  city: string;
  zipCode: string;
  country: string;
  taxNumber?: string;
  euVatNumber?: string;
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number; // Net price
  vatRate: number; // VAT percentage (e.g., 27)
  unit?: string; // Unit of measure (default: 'db')
}

export interface CreateInvoiceRequest {
  // Customer data
  customer: InvoiceAddress;

  // Invoice metadata
  currency?: string; // Default: HUF
  language?: string; // Default: hu
  paymentMethod: 'cash' | 'transfer' | 'card' | 'other';
  paymentDueDays: number;
  comment?: string;

  // Items
  items: InvoiceLineItem[];

  // Additional options
  sendEmail?: boolean;
  emailTo?: string;
}

export interface CreateInvoiceResponse {
  success: boolean;
  invoiceNumber?: string;
  externalId?: string;
  pdfUrl?: string;
  rawResponse?: any;
  error?: string;
}

export interface CancelInvoiceRequest {
  invoiceNumber: string;
  reason?: string;
}

export interface CancelInvoiceResponse {
  success: boolean;
  cancelledInvoiceNumber?: string;
  error?: string;
}

export interface GetInvoicePdfRequest {
  invoiceNumber: string;
}

export interface GetInvoicePdfResponse {
  success: boolean;
  pdfBuffer?: Buffer;
  pdfUrl?: string;
  error?: string;
}

/**
 * Abstract interface that all invoice providers must implement
 */
export abstract class InvoiceProvider {
  abstract readonly providerName: string;

  /**
   * Create and issue an invoice
   */
  abstract createInvoice(request: CreateInvoiceRequest): Promise<CreateInvoiceResponse>;

  /**
   * Cancel (storno) an existing invoice
   */
  abstract cancelInvoice(request: CancelInvoiceRequest): Promise<CancelInvoiceResponse>;

  /**
   * Get PDF of an invoice
   */
  abstract getInvoicePdf(request: GetInvoicePdfRequest): Promise<GetInvoicePdfResponse>;

  /**
   * Validate connection/credentials
   */
  abstract validateConnection(): Promise<boolean>;
}
