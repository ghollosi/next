import {
  Controller,
  Post,
  Get,
  Headers,
  RawBodyRequest,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request } from 'express';
import { StripeService } from './stripe.service';
import { PublishableKeyResponseDto, WebhookResponseDto } from './dto/stripe.dto';

@ApiTags('Stripe')
@Controller('stripe')
export class StripeController {
  constructor(private readonly stripeService: StripeService) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle Stripe webhooks' })
  @ApiResponse({ status: 200, description: 'Webhook received', type: WebhookResponseDto })
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ): Promise<WebhookResponseDto> {
    return this.stripeService.handleWebhook(req.rawBody!, signature);
  }

  @Get('publishable-key')
  @ApiOperation({ summary: 'Get Stripe publishable key for frontend' })
  @ApiResponse({ status: 200, description: 'Publishable key', type: PublishableKeyResponseDto })
  async getPublishableKey(): Promise<PublishableKeyResponseDto> {
    const key = await this.stripeService.getPublishableKey();
    return { publishableKey: key };
  }

  @Get('configured')
  @ApiOperation({ summary: 'Check if Stripe is configured' })
  @ApiResponse({ status: 200, description: 'Configuration status' })
  async isConfigured(): Promise<{ configured: boolean }> {
    const configured = await this.stripeService.isConfigured();
    return { configured };
  }
}
