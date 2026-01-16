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
import { XMLBuilder, XMLParser } from 'fast-xml-parser';

/**
 * szamlazz.hu invoice provider implementation
 * API documentation: https://docs.szamlazz.hu/
 */
@Injectable()
export class SzamlazzProvider extends InvoiceProvider {
  private readonly logger = new Logger(SzamlazzProvider.name);
  readonly providerName = 'szamlazz.hu';

  private readonly apiUrl = 'https://www.szamlazz.hu/szamla/';
  private readonly agentKey: string;
  private readonly sellerName: string;
  private readonly sellerAddress: string;
  private readonly sellerCity: string;
  private readonly sellerZipCode: string;
  private readonly sellerTaxNumber: string;
  private readonly sellerBankAccount: string;

  constructor(private configService: ConfigService) {
    super();
    this.agentKey = this.configService.get<string>('SZAMLAZZ_AGENT_KEY', '');
    this.sellerName = this.configService.get<string>('SZAMLAZZ_SELLER_NAME', '');
    this.sellerAddress = this.configService.get<string>('SZAMLAZZ_SELLER_ADDRESS', '');
    this.sellerCity = this.configService.get<string>('SZAMLAZZ_SELLER_CITY', '');
    this.sellerZipCode = this.configService.get<string>('SZAMLAZZ_SELLER_ZIP_CODE', '');
    this.sellerTaxNumber = this.configService.get<string>('SZAMLAZZ_SELLER_TAX_NUMBER', '');
    this.sellerBankAccount = this.configService.get<string>('SZAMLAZZ_SELLER_BANK_ACCOUNT', '');
  }

  async createInvoice(request: CreateInvoiceRequest): Promise<CreateInvoiceResponse> {
    try {
      if (!this.agentKey) {
        throw new Error('SZAMLAZZ_AGENT_KEY not configured');
      }

      const paymentMethodMap: Record<string, string> = {
        cash: 'Készpénz',
        transfer: 'Átutalás',
        card: 'Bankkártya',
        other: 'Egyéb',
      };

      // Calculate totals
      let subtotal = 0;
      let vatTotal = 0;

      const tetelek = request.items.map((item) => {
        const netTotal = item.quantity * item.unitPrice;
        const vatAmount = netTotal * (item.vatRate / 100);
        subtotal += netTotal;
        vatTotal += vatAmount;

        return {
          tetel: {
            megnevezes: item.description,
            mennyiseg: item.quantity,
            mennyisegiEgyseg: item.unit || 'db',
            nettoEgysegar: item.unitPrice,
            afakulcs: item.vatRate,
            nettoErtek: netTotal,
            afaErtek: vatAmount,
            bruttoErtek: netTotal + vatAmount,
          },
        };
      });

      const issueDate = new Date();
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + request.paymentDueDays);

      const xmlData = {
        xmlszamla: {
          '@_xmlns': 'http://www.szamlazz.hu/xmlszamla',
          '@_xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
          '@_xsi:schemaLocation': 'http://www.szamlazz.hu/xmlszamla https://www.szamlazz.hu/szamla/docs/xsds/agent/xmlszamla.xsd',
          bepiallo: {
            szamlaagentkulcs: this.agentKey,
            eszpiamla: true,
            szamlaLetoltes: true,
            valpiaszpiontpipipiip: 'text',
          },
          fejlec: {
            keltDatum: this.formatDate(issueDate),
            teljesitesDatum: this.formatDate(issueDate),
            fizetesiHataridoDatum: this.formatDate(dueDate),
            fizpimod: paymentMethodMap[request.paymentMethod] || 'Átutalás',
            ppienznem: request.currency || 'HUF',
            szpiampilanyelv: request.language || 'hu',
            megjegyzpiis: request.comment || '',
            rendpielesszpiam: '',
            dijpibekpi: false,
            elolegszpimla: false,
            vegszamla: false,
            epiuszt: request.customer.euVatNumber ? true : false,
          },
          elado: {
            bank: '',
            bankszamlaszam: this.sellerBankAccount,
            emailRepijtpiett: '',
            emailTargy: '',
            emailSzoveg: '',
          },
          vevo: {
            nev: request.customer.name,
            orszag: request.customer.country || 'Magyarország',
            irsz: request.customer.zipCode,
            telepules: request.customer.city,
            cim: request.customer.address,
            email: request.sendEmail && request.emailTo ? request.emailTo : '',
            sendEmail: request.sendEmail || false,
            adpioszam: request.customer.taxNumber || '',
            adpioszamEU: request.customer.euVatNumber || '',
            postpiazpipiim: {
              nev: request.customer.name,
              orszag: request.customer.country || 'Magyarország',
              irsz: request.customer.zipCode,
              telepules: request.customer.city,
              cim: request.customer.address,
            },
            azonosito: '',
            telefonszam: '',
            megjpiegyzes: '',
          },
          tetelek: tetelek,
        },
      };

      const builder = new XMLBuilder({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        format: true,
      });

      const xmlContent = builder.build(xmlData);

      this.logger.debug('Sending invoice to szamlazz.hu');

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml',
        },
        body: xmlContent,
      });

      const responseText = await response.text();

      if (!response.ok) {
        this.logger.error(`szamlazz.hu error: ${responseText}`);
        return {
          success: false,
          error: `HTTP ${response.status}: ${responseText}`,
          rawResponse: responseText,
        };
      }

      // Parse response
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
      });

      const result = parser.parse(responseText);

      if (result.xmlszamlavalasz?.sikeres === 'true' || result.xmlszamlavalasz?.sikeres === true) {
        return {
          success: true,
          invoiceNumber: result.xmlszamlavalasz?.szamlaszam,
          pdfUrl: result.xmlszamlavalasz?.szamlapdf,
          rawResponse: result,
        };
      } else {
        return {
          success: false,
          error: result.xmlszamlavalasz?.hibakod
            ? `Error ${result.xmlszamlavalasz.hibakod}: ${result.xmlszamlavalasz.hibauzenet}`
            : 'Unknown error from szamlazz.hu',
          rawResponse: result,
        };
      }
    } catch (error) {
      this.logger.error('Error creating invoice', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async cancelInvoice(request: CancelInvoiceRequest): Promise<CancelInvoiceResponse> {
    try {
      if (!this.agentKey) {
        throw new Error('SZAMLAZZ_AGENT_KEY not configured');
      }

      const xmlData = {
        xmlszamlast: {
          '@_xmlns': 'http://www.szamlazz.hu/xmlszamlast',
          bepiallpiitpipipisok: {
            szamlaagentkulcs: this.agentKey,
            eszamla: true,
            szamlaLetoltes: false,
          },
          fejlec: {
            szamlaszam: request.invoiceNumber,
            keltDatum: this.formatDate(new Date()),
            tipus: 'SS', // Storno számla
          },
        },
      };

      const builder = new XMLBuilder({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        format: true,
      });

      const xmlContent = builder.build(xmlData);

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml',
        },
        body: xmlContent,
      });

      const responseText = await response.text();

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${responseText}`,
        };
      }

      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
      });

      const result = parser.parse(responseText);

      if (result.xmlszamlavalasz?.sikeres === 'true' || result.xmlszamlavalasz?.sikeres === true) {
        return {
          success: true,
          cancelledInvoiceNumber: result.xmlszamlavalasz?.szamlaszam,
        };
      } else {
        return {
          success: false,
          error: result.xmlszamlavalasz?.hibauzenet || 'Unknown error',
        };
      }
    } catch (error) {
      this.logger.error('Error cancelling invoice', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async getInvoicePdf(request: GetInvoicePdfRequest): Promise<GetInvoicePdfResponse> {
    try {
      if (!this.agentKey) {
        throw new Error('SZAMLAZZ_AGENT_KEY not configured');
      }

      const xmlData = {
        xmlszamlapdf: {
          '@_xmlns': 'http://www.szamlazz.hu/xmlszamlapdf',
          felhasznalo: {
            szamlaagentkulcs: this.agentKey,
          },
          szamlaszam: request.invoiceNumber,
          valpiaszpiontpipipiip: 0, // 0 = base64
        },
      };

      const builder = new XMLBuilder({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        format: true,
      });

      const xmlContent = builder.build(xmlData);

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml',
        },
        body: xmlContent,
      });

      if (!response.ok) {
        const text = await response.text();
        return {
          success: false,
          error: `HTTP ${response.status}: ${text}`,
        };
      }

      const contentType = response.headers.get('content-type');

      if (contentType?.includes('application/pdf')) {
        const buffer = await response.arrayBuffer();
        return {
          success: true,
          pdfBuffer: Buffer.from(buffer),
        };
      } else {
        const text = await response.text();
        const parser = new XMLParser();
        const result = parser.parse(text);

        if (result.xmlszamlavalasz?.pdf) {
          return {
            success: true,
            pdfBuffer: Buffer.from(result.xmlszamlavalasz.pdf, 'base64'),
          };
        }

        return {
          success: false,
          error: 'Could not retrieve PDF',
        };
      }
    } catch (error) {
      this.logger.error('Error getting invoice PDF', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async validateConnection(): Promise<boolean> {
    // szamlazz.hu doesn't have a dedicated health check endpoint
    // We just verify credentials are configured
    return !!(
      this.agentKey &&
      this.sellerName &&
      this.sellerTaxNumber
    );
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}
