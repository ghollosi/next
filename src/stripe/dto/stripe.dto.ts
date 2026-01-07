import { IsString, IsOptional, IsBoolean, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCheckoutSessionDto {
  @ApiProperty({ description: 'URL to redirect after successful checkout' })
  @IsString()
  successUrl: string;

  @ApiProperty({ description: 'URL to redirect if user cancels checkout' })
  @IsString()
  cancelUrl: string;
}

export class CreateBillingPortalDto {
  @ApiProperty({ description: 'URL to return to after leaving billing portal' })
  @IsString()
  returnUrl: string;
}

export class SubscriptionDetailsDto {
  @ApiProperty({ description: 'Subscription status from Stripe' })
  status: string;

  @ApiPropertyOptional({ description: 'Current billing period start' })
  currentPeriodStart?: Date;

  @ApiPropertyOptional({ description: 'Current billing period end' })
  currentPeriodEnd?: Date;

  @ApiProperty({ description: 'Whether subscription will cancel at period end' })
  cancelAtPeriodEnd: boolean;

  @ApiPropertyOptional({ description: 'Trial end date if in trial' })
  trialEnd?: Date | null;

  @ApiPropertyOptional({ description: 'Base monthly fee in HUF' })
  baseMonthlyFee?: number;

  @ApiPropertyOptional({ description: 'Per wash fee in HUF' })
  perWashFee?: number;

  @ApiPropertyOptional({ description: 'Current month wash usage count' })
  currentUsage?: number;

  @ApiProperty({ description: 'Has active payment method' })
  hasPaymentMethod: boolean;
}

export class CheckoutSessionResponseDto {
  @ApiProperty({ description: 'Stripe checkout session ID' })
  sessionId: string;

  @ApiProperty({ description: 'URL to redirect user to Stripe checkout' })
  url: string;
}

export class BillingPortalResponseDto {
  @ApiProperty({ description: 'URL to Stripe billing portal' })
  url: string;
}

export class PublishableKeyResponseDto {
  @ApiPropertyOptional({ description: 'Stripe publishable key' })
  publishableKey: string | null;
}

export class WebhookResponseDto {
  @ApiProperty({ description: 'Whether webhook was received' })
  received: boolean;
}
