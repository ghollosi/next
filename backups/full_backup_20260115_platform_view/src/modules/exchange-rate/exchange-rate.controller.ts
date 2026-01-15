import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { ExchangeRateService } from './exchange-rate.service';

@ApiTags('exchange-rates')
@Controller('exchange-rates')
export class ExchangeRateController {
  constructor(private readonly exchangeRateService: ExchangeRateService) {}

  @Get()
  @ApiOperation({ summary: 'Get all current exchange rates' })
  @ApiResponse({
    status: 200,
    description: 'Current exchange rates from MNB and ECB',
  })
  getAllRates() {
    return this.exchangeRateService.getAllRates();
  }

  @Get('huf')
  @ApiOperation({ summary: 'Get HUF exchange rate for a currency (MNB)' })
  @ApiQuery({ name: 'currency', required: true, description: 'Currency code (e.g., EUR, USD)' })
  @ApiResponse({ status: 200, description: 'Exchange rate (1 currency = X HUF)' })
  getHufRate(@Query('currency') currency: string) {
    if (!currency) {
      throw new BadRequestException('Currency is required');
    }

    const rate = this.exchangeRateService.getHufRate(currency.toUpperCase());

    if (rate === null) {
      throw new BadRequestException(`No rate found for ${currency}`);
    }

    return {
      currency: currency.toUpperCase(),
      rate,
      base: 'HUF',
      source: 'MNB',
      description: `1 ${currency.toUpperCase()} = ${rate} HUF`,
    };
  }

  @Get('eur')
  @ApiOperation({ summary: 'Get EUR exchange rate for a currency (ECB)' })
  @ApiQuery({ name: 'currency', required: true, description: 'Currency code (e.g., USD, GBP)' })
  @ApiResponse({ status: 200, description: 'Exchange rate (1 EUR = X currency)' })
  getEurRate(@Query('currency') currency: string) {
    if (!currency) {
      throw new BadRequestException('Currency is required');
    }

    const rate = this.exchangeRateService.getEurRate(currency.toUpperCase());

    if (rate === null) {
      throw new BadRequestException(`No rate found for ${currency}`);
    }

    return {
      currency: currency.toUpperCase(),
      rate,
      base: 'EUR',
      source: 'ECB',
      description: `1 EUR = ${rate} ${currency.toUpperCase()}`,
    };
  }

  @Get('convert')
  @ApiOperation({ summary: 'Convert amount between currencies' })
  @ApiQuery({ name: 'amount', required: true, description: 'Amount to convert' })
  @ApiQuery({ name: 'from', required: true, description: 'Source currency code' })
  @ApiQuery({ name: 'to', required: true, description: 'Target currency code' })
  @ApiResponse({ status: 200, description: 'Converted amount' })
  convert(
    @Query('amount') amountStr: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const amount = parseFloat(amountStr);

    if (isNaN(amount)) {
      throw new BadRequestException('Invalid amount');
    }
    if (!from || !to) {
      throw new BadRequestException('Both from and to currencies are required');
    }

    const result = this.exchangeRateService.convert(
      amount,
      from.toUpperCase(),
      to.toUpperCase(),
    );

    if (result === null) {
      throw new BadRequestException(
        `Cannot convert between ${from} and ${to}`,
      );
    }

    return {
      originalAmount: amount,
      originalCurrency: from.toUpperCase(),
      convertedAmount: Math.round(result * 100) / 100,
      targetCurrency: to.toUpperCase(),
    };
  }

  @Get('refresh')
  @ApiOperation({ summary: 'Force refresh exchange rates from sources' })
  @ApiResponse({ status: 200, description: 'Rates refreshed' })
  async refresh() {
    await this.exchangeRateService.fetchAndCacheRates();
    return {
      success: true,
      message: 'Exchange rates refreshed',
      rates: this.exchangeRateService.getAllRates(),
    };
  }
}
