import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';

interface ExchangeRate {
  currency: string;
  rate: number;
  date: Date;
  source: 'MNB' | 'ECB';
}

@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name);
  private cachedRates: Map<string, ExchangeRate> = new Map();

  constructor(private prisma: PrismaService) {
    // Load rates on startup
    this.fetchAndCacheRates().catch((err) =>
      this.logger.warn('Failed to fetch initial exchange rates', err),
    );
  }

  /**
   * Fetch exchange rates from MNB (Magyar Nemzeti Bank)
   * MNB provides SOAP/XML API for official HUF exchange rates
   */
  async fetchMnbRates(): Promise<ExchangeRate[]> {
    const rates: ExchangeRate[] = [];
    const today = new Date();

    try {
      // MNB provides a public SOAP API, but we'll use their simpler RSS/XML feed
      // Alternative: arfolyamok.mnb.hu provides JSON API
      const response = await fetch(
        'https://www.mnb.hu/arfolyam-lekerdezes?devizanem=EUR,USD,GBP,CHF,PLN,CZK,RON&datum=' +
          today.toISOString().split('T')[0],
        {
          headers: {
            Accept: 'application/json',
          },
        },
      );

      if (!response.ok) {
        throw new Error(`MNB API error: ${response.status}`);
      }

      // MNB returns XML, parse it
      const text = await response.text();

      // Simple XML parsing for MNB format
      // Format: <Day date="2024-01-07"><Rate curr="EUR" unit="1">390.55</Rate>...</Day>
      const currencyMatches = text.matchAll(/<Rate curr="(\w+)" unit="(\d+)">([0-9,.]+)<\/Rate>/g);

      for (const match of currencyMatches) {
        const currency = match[1];
        const unit = parseInt(match[2], 10);
        const rateValue = parseFloat(match[3].replace(',', '.')) / unit;

        rates.push({
          currency,
          rate: rateValue,
          date: today,
          source: 'MNB',
        });
      }

      this.logger.log(`Fetched ${rates.length} rates from MNB`);
    } catch (error) {
      this.logger.warn('Failed to fetch MNB rates, using fallback', error);

      // Use hardcoded fallback rates (should be updated periodically)
      rates.push(
        { currency: 'EUR', rate: 390.0, date: today, source: 'MNB' },
        { currency: 'USD', rate: 365.0, date: today, source: 'MNB' },
        { currency: 'GBP', rate: 460.0, date: today, source: 'MNB' },
        { currency: 'CHF', rate: 420.0, date: today, source: 'MNB' },
      );
    }

    return rates;
  }

  /**
   * Fetch exchange rates from ECB (European Central Bank)
   * ECB provides free XML/JSON API for EUR-based exchange rates
   */
  async fetchEcbRates(): Promise<ExchangeRate[]> {
    const rates: ExchangeRate[] = [];
    const today = new Date();

    try {
      // ECB provides a daily updated XML feed
      const response = await fetch(
        'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml',
      );

      if (!response.ok) {
        throw new Error(`ECB API error: ${response.status}`);
      }

      const text = await response.text();

      // Parse ECB XML format
      // Format: <Cube currency="USD" rate="1.0855"/>
      const currencyMatches = text.matchAll(/currency='(\w+)' rate='([0-9.]+)'/g);

      for (const match of currencyMatches) {
        const currency = match[1];
        const rateValue = parseFloat(match[2]);

        rates.push({
          currency,
          rate: rateValue, // ECB rates are EUR-based (1 EUR = X currency)
          date: today,
          source: 'ECB',
        });
      }

      // Add EUR itself with rate 1
      rates.push({ currency: 'EUR', rate: 1, date: today, source: 'ECB' });

      this.logger.log(`Fetched ${rates.length} rates from ECB`);
    } catch (error) {
      this.logger.warn('Failed to fetch ECB rates', error);
    }

    return rates;
  }

  /**
   * Fetch and cache all rates
   */
  async fetchAndCacheRates(): Promise<void> {
    const mnbRates = await this.fetchMnbRates();
    const ecbRates = await this.fetchEcbRates();

    // Cache MNB rates (these are HUF-based)
    for (const rate of mnbRates) {
      this.cachedRates.set(`MNB:${rate.currency}`, rate);
    }

    // Cache ECB rates (these are EUR-based)
    for (const rate of ecbRates) {
      this.cachedRates.set(`ECB:${rate.currency}`, rate);
    }

    // Also store in database for persistence
    await this.saveRatesToDatabase([...mnbRates, ...ecbRates]);

    this.logger.log(
      `Cached ${this.cachedRates.size} exchange rates from MNB and ECB`,
    );
  }

  /**
   * Save rates to database (ExchangeRateCache)
   */
  private async saveRatesToDatabase(rates: ExchangeRate[]): Promise<void> {
    const validUntil = new Date();
    validUntil.setHours(validUntil.getHours() + 24); // Valid for 24 hours

    try {
      for (const rate of rates) {
        await this.prisma.exchangeRateCache.upsert({
          where: {
            sourceCurrency_targetCurrency_source: {
              sourceCurrency: rate.currency,
              targetCurrency: rate.source === 'MNB' ? 'HUF' : 'EUR',
              source: rate.source,
            },
          },
          update: {
            rate: rate.rate,
            fetchedAt: new Date(),
            validUntil,
          },
          create: {
            sourceCurrency: rate.currency,
            targetCurrency: rate.source === 'MNB' ? 'HUF' : 'EUR',
            rate: rate.rate,
            source: rate.source,
            fetchedAt: new Date(),
            validUntil,
          },
        });
      }
    } catch (error) {
      // Table might not exist yet - that's okay
      this.logger.debug('Could not save rates to database', error);
    }
  }

  /**
   * Get current exchange rate for a currency (HUF-based, from MNB)
   */
  getHufRate(currency: string): number | null {
    if (currency === 'HUF') return 1;

    const rate = this.cachedRates.get(`MNB:${currency}`);
    return rate?.rate || null;
  }

  /**
   * Get current exchange rate for a currency (EUR-based, from ECB)
   */
  getEurRate(currency: string): number | null {
    if (currency === 'EUR') return 1;

    const rate = this.cachedRates.get(`ECB:${currency}`);
    return rate?.rate || null;
  }

  /**
   * Convert amount from one currency to another
   */
  convert(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
  ): number | null {
    if (fromCurrency === toCurrency) return amount;

    // If converting to/from HUF, use MNB rates
    if (fromCurrency === 'HUF' || toCurrency === 'HUF') {
      if (fromCurrency === 'HUF') {
        const rate = this.getHufRate(toCurrency);
        return rate ? amount / rate : null;
      } else {
        const rate = this.getHufRate(fromCurrency);
        return rate ? amount * rate : null;
      }
    }

    // For other conversions, go through EUR using ECB rates
    const fromEurRate = this.getEurRate(fromCurrency);
    const toEurRate = this.getEurRate(toCurrency);

    if (!fromEurRate || !toEurRate) return null;

    // Convert from source currency to EUR, then to target currency
    const eurAmount = amount / fromEurRate;
    return eurAmount * toEurRate;
  }

  /**
   * Get all cached rates
   */
  getAllRates(): { mnb: ExchangeRate[]; ecb: ExchangeRate[] } {
    const mnb: ExchangeRate[] = [];
    const ecb: ExchangeRate[] = [];

    for (const [key, rate] of this.cachedRates) {
      if (key.startsWith('MNB:')) {
        mnb.push(rate);
      } else if (key.startsWith('ECB:')) {
        ecb.push(rate);
      }
    }

    return { mnb, ecb };
  }

  /**
   * Scheduled task to refresh rates daily at 8 AM (after MNB publishes)
   */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async refreshRatesDaily(): Promise<void> {
    this.logger.log('Running scheduled exchange rate refresh');
    await this.fetchAndCacheRates();
  }
}
