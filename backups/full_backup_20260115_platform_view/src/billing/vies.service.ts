import { Injectable, Logger } from '@nestjs/common';

/**
 * VIES (VAT Information Exchange System) validation service
 * For validating EU VAT numbers
 * API: https://ec.europa.eu/taxation_customs/vies/
 */

export interface ViesValidationResult {
  valid: boolean;
  countryCode?: string;
  vatNumber?: string;
  name?: string;
  address?: string;
  requestDate?: string;
  error?: string;
}

@Injectable()
export class ViesService {
  private readonly logger = new Logger(ViesService.name);
  private readonly soapEndpoint = 'https://ec.europa.eu/taxation_customs/vies/services/checkVatService';

  /**
   * Validate an EU VAT number using the VIES SOAP service
   * @param vatNumber Full VAT number including country code (e.g., "HU12345678")
   */
  async validateVatNumber(vatNumber: string): Promise<ViesValidationResult> {
    try {
      // Extract country code and number
      const cleanVat = vatNumber.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

      if (cleanVat.length < 4) {
        return {
          valid: false,
          error: 'VAT number too short',
        };
      }

      const countryCode = cleanVat.substring(0, 2);
      const number = cleanVat.substring(2);

      // Validate country code is EU member
      const euCountries = [
        'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'EL', 'ES',
        'FI', 'FR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT',
        'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK', 'XI', // XI = Northern Ireland
      ];

      if (!euCountries.includes(countryCode)) {
        return {
          valid: false,
          countryCode,
          vatNumber: number,
          error: `Country code ${countryCode} is not an EU member state`,
        };
      }

      // Build SOAP request
      const soapRequest = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:ec.europa.eu:taxud:vies:services:checkVat:types">
   <soapenv:Header/>
   <soapenv:Body>
      <urn:checkVat>
         <urn:countryCode>${countryCode}</urn:countryCode>
         <urn:vatNumber>${number}</urn:vatNumber>
      </urn:checkVat>
   </soapenv:Body>
</soapenv:Envelope>`;

      this.logger.debug(`Validating VAT number: ${countryCode}${number}`);

      const response = await fetch(this.soapEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml;charset=UTF-8',
          'SOAPAction': '',
        },
        body: soapRequest,
      });

      if (!response.ok) {
        const text = await response.text();
        this.logger.error(`VIES API error: ${response.status} - ${text}`);
        return {
          valid: false,
          countryCode,
          vatNumber: number,
          error: `VIES service error: HTTP ${response.status}`,
        };
      }

      const responseText = await response.text();

      // Parse SOAP response
      const validMatch = responseText.match(/<valid>(\w+)<\/valid>/);
      const nameMatch = responseText.match(/<name>([^<]*)<\/name>/);
      const addressMatch = responseText.match(/<address>([^<]*)<\/address>/);
      const dateMatch = responseText.match(/<requestDate>([^<]*)<\/requestDate>/);

      const isValid = validMatch ? validMatch[1].toLowerCase() === 'true' : false;

      return {
        valid: isValid,
        countryCode,
        vatNumber: number,
        name: nameMatch ? this.decodeHtmlEntities(nameMatch[1]) : undefined,
        address: addressMatch ? this.decodeHtmlEntities(addressMatch[1]) : undefined,
        requestDate: dateMatch ? dateMatch[1] : undefined,
      };
    } catch (error) {
      this.logger.error('Error validating VAT number', error);
      return {
        valid: false,
        error: error.message || 'Unknown error during VAT validation',
      };
    }
  }

  /**
   * Format VAT number for display
   */
  formatVatNumber(vatNumber: string): string {
    const clean = vatNumber.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (clean.length < 4) return vatNumber;

    const countryCode = clean.substring(0, 2);
    const number = clean.substring(2);

    return `${countryCode} ${number}`;
  }

  /**
   * Extract country code from VAT number
   */
  getCountryCode(vatNumber: string): string | null {
    const clean = vatNumber.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (clean.length < 2) return null;
    return clean.substring(0, 2);
  }

  private decodeHtmlEntities(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/\n/g, ', ')
      .trim();
  }
}
