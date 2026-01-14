import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsEnum,
  IsOptional,
  MinLength,
  MaxLength,
  IsUUID,
  IsNumber,
  IsBoolean,
  ValidateIf,
  IsInt,
} from 'class-validator';
import { PlatformRole, SubscriptionStatus, InvoiceProvider } from '@prisma/client';

// ============================================================================
// AUTH DTOs
// ============================================================================

export class PlatformLoginDto {
  @ApiProperty({ description: 'Admin email' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Admin password' })
  @IsString()
  @MinLength(6)
  password: string;
}

export class PlatformLoginResponseDto {
  @ApiProperty({ description: 'JWT access token' })
  accessToken: string;

  @ApiProperty({ description: 'Admin ID' })
  adminId: string;

  @ApiProperty({ description: 'Admin name' })
  name: string;

  @ApiProperty({ description: 'Admin email' })
  email: string;

  @ApiProperty({ description: 'Admin role', enum: PlatformRole })
  role: PlatformRole;
}

export class CreatePlatformAdminDto {
  @ApiProperty({ description: 'Admin email' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Admin password' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ description: 'Admin name' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ description: 'Admin role', enum: PlatformRole })
  @IsOptional()
  @IsEnum(PlatformRole)
  role?: PlatformRole;

  @ApiProperty({ description: 'Recovery email (required for PLATFORM_OWNER)' })
  @ValidateIf((o) => o.role === PlatformRole.PLATFORM_OWNER)
  @IsEmail()
  recoveryEmail?: string;
}

export class UpdatePlatformAdminDto {
  @ApiPropertyOptional({ description: 'Admin name' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Admin role', enum: PlatformRole })
  @IsOptional()
  @IsEnum(PlatformRole)
  role?: PlatformRole;

  @ApiPropertyOptional({ description: 'Is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'New password' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiPropertyOptional({ description: 'Recovery email' })
  @IsOptional()
  @IsEmail()
  recoveryEmail?: string;
}

export class PlatformAdminListItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: PlatformRole })
  role: PlatformRole;

  @ApiProperty()
  isActive: boolean;

  @ApiPropertyOptional()
  recoveryEmail?: string;

  @ApiPropertyOptional()
  lastLoginAt?: Date;

  @ApiProperty()
  createdAt: Date;
}

export class RequestPasswordResetDto {
  @ApiProperty({ description: 'Admin email or recovery email' })
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'Reset token' })
  @IsString()
  token: string;

  @ApiProperty({ description: 'New password' })
  @IsString()
  @MinLength(8)
  newPassword: string;
}

export class GenerateEmergencyTokenResponseDto {
  @ApiProperty({ description: 'Emergency access token' })
  token: string;

  @ApiProperty({ description: 'Token expiry date' })
  expiresAt: Date;

  @ApiProperty({ description: 'Message' })
  message: string;
}

export class EmergencyLoginDto {
  @ApiProperty({ description: 'Emergency token' })
  @IsString()
  token: string;
}

// ============================================================================
// PLATFORM SETTINGS DTOs
// ============================================================================

export class UpdatePlatformSettingsDto {
  @ApiPropertyOptional({ description: 'Platform name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  platformName?: string;

  @ApiPropertyOptional({ description: 'Platform URL' })
  @IsOptional()
  @IsString()
  platformUrl?: string;

  @ApiPropertyOptional({ description: 'Support email' })
  @IsOptional()
  @IsEmail()
  supportEmail?: string;

  @ApiPropertyOptional({ description: 'Support phone' })
  @IsOptional()
  @IsString()
  supportPhone?: string;

  // Company data (for invoicing)
  @ApiPropertyOptional({ description: 'Company name' })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional({ description: 'Company address' })
  @IsOptional()
  @IsString()
  companyAddress?: string;

  @ApiPropertyOptional({ description: 'Company city' })
  @IsOptional()
  @IsString()
  companyCity?: string;

  @ApiPropertyOptional({ description: 'Company zip code' })
  @IsOptional()
  @IsString()
  companyZipCode?: string;

  @ApiPropertyOptional({ description: 'Company country (ISO 2-letter code)' })
  @IsOptional()
  @IsString()
  companyCountry?: string;

  @ApiPropertyOptional({ description: 'Tax number' })
  @IsOptional()
  @IsString()
  taxNumber?: string;

  @ApiPropertyOptional({ description: 'EU VAT number' })
  @IsOptional()
  @IsString()
  euVatNumber?: string;

  @ApiPropertyOptional({ description: 'Bank account number' })
  @IsOptional()
  @IsString()
  bankAccountNumber?: string;

  @ApiPropertyOptional({ description: 'Bank account IBAN' })
  @IsOptional()
  @IsString()
  bankAccountIban?: string;

  @ApiPropertyOptional({ description: 'Bank name' })
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional({ description: 'Default trial days for new networks' })
  @IsOptional()
  @IsNumber()
  defaultTrialDays?: number;

  @ApiPropertyOptional({ description: 'Base monthly fee' })
  @IsOptional()
  @IsNumber()
  baseMonthlyFee?: number;

  @ApiPropertyOptional({ description: 'Per wash fee' })
  @IsOptional()
  @IsNumber()
  perWashFee?: number;

  @ApiPropertyOptional({ description: 'Resend API key' })
  @IsOptional()
  @IsString()
  resendApiKey?: string;

  @ApiPropertyOptional({ description: 'Twilio Account SID' })
  @IsOptional()
  @IsString()
  twilioAccountSid?: string;

  @ApiPropertyOptional({ description: 'Twilio Auth Token' })
  @IsOptional()
  @IsString()
  twilioAuthToken?: string;

  @ApiPropertyOptional({ description: 'Twilio Phone Number' })
  @IsOptional()
  @IsString()
  twilioPhoneNumber?: string;

  // Stripe
  @ApiPropertyOptional({ description: 'Stripe Secret Key' })
  @IsOptional()
  @IsString()
  stripeSecretKey?: string;

  @ApiPropertyOptional({ description: 'Stripe Publishable Key' })
  @IsOptional()
  @IsString()
  stripePublishableKey?: string;

  @ApiPropertyOptional({ description: 'Stripe Webhook Secret' })
  @IsOptional()
  @IsString()
  stripeWebhookSecret?: string;

  @ApiPropertyOptional({ description: 'Stripe Product ID' })
  @IsOptional()
  @IsString()
  stripeProductId?: string;

  @ApiPropertyOptional({ description: 'Stripe Base Price ID (monthly fee)' })
  @IsOptional()
  @IsString()
  stripeBasePriceId?: string;

  @ApiPropertyOptional({ description: 'Stripe Usage Price ID (per wash fee)' })
  @IsOptional()
  @IsString()
  stripeUsagePriceId?: string;

  // Invoice Provider settings (for billing networks)
  @ApiPropertyOptional({ description: 'Invoice provider for billing networks', enum: InvoiceProvider })
  @IsOptional()
  @IsEnum(InvoiceProvider)
  invoiceProvider?: InvoiceProvider;

  @ApiPropertyOptional({ description: 'Szamlazz.hu Agent Key' })
  @IsOptional()
  @IsString()
  szamlazzAgentKey?: string;

  @ApiPropertyOptional({ description: 'Billingo API Key' })
  @IsOptional()
  @IsString()
  billingoApiKey?: string;

  @ApiPropertyOptional({ description: 'Billingo Block ID' })
  @IsOptional()
  @IsInt()
  billingoBlockId?: number;

  @ApiPropertyOptional({ description: 'Billingo Bank Account ID' })
  @IsOptional()
  @IsInt()
  billingoBankAccountId?: number;
}

export class PlatformSettingsResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  platformName: string;

  @ApiPropertyOptional()
  platformUrl?: string;

  @ApiPropertyOptional()
  supportEmail?: string;

  @ApiPropertyOptional()
  supportPhone?: string;

  @ApiProperty()
  defaultTrialDays: number;

  @ApiProperty()
  baseMonthlyFee: number;

  @ApiProperty()
  perWashFee: number;

  @ApiProperty({ description: 'Whether email is configured' })
  emailConfigured: boolean;

  @ApiProperty({ description: 'Whether SMS is configured' })
  smsConfigured: boolean;

  @ApiProperty({ description: 'Whether Stripe is configured' })
  stripeConfigured: boolean;

  @ApiProperty({ description: 'Whether invoice provider is configured' })
  invoiceConfigured: boolean;

  @ApiPropertyOptional({ description: 'Invoice provider', enum: InvoiceProvider })
  invoiceProvider?: InvoiceProvider;
}

// ============================================================================
// NETWORK MANAGEMENT DTOs
// ============================================================================

export class CreateNetworkDto {
  @ApiProperty({ description: 'Network name' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({ description: 'Network slug (URL-friendly identifier)' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  slug: string;

  @ApiPropertyOptional({ description: 'Country code (ISO 3166-1 alpha-2)' })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  country?: string;

  @ApiPropertyOptional({ description: 'Timezone' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ description: 'Default currency (ISO 4217)' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  defaultCurrency?: string;

  @ApiPropertyOptional({ description: 'Owner admin email' })
  @IsOptional()
  @IsEmail()
  ownerEmail?: string;

  @ApiPropertyOptional({ description: 'Owner admin name' })
  @IsOptional()
  @IsString()
  ownerName?: string;

  @ApiPropertyOptional({ description: 'Owner admin password' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  ownerPassword?: string;
}

export class UpdateNetworkDto {
  @ApiPropertyOptional({ description: 'Network name' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Is network active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Subscription status', enum: SubscriptionStatus })
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  subscriptionStatus?: SubscriptionStatus;

  @ApiPropertyOptional({ description: 'Trial end date' })
  @IsOptional()
  @IsString()
  trialEndsAt?: string;

  @ApiPropertyOptional({ description: 'Country code' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ description: 'Timezone' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ description: 'Default currency' })
  @IsOptional()
  @IsString()
  defaultCurrency?: string;

  @ApiPropertyOptional({ description: 'Custom monthly fee (null = use platform default)' })
  @IsOptional()
  @IsNumber()
  customMonthlyFee?: number | null;

  @ApiPropertyOptional({ description: 'Custom per wash fee (null = use platform default)' })
  @IsOptional()
  @IsNumber()
  customPerWashFee?: number | null;

  @ApiPropertyOptional({ description: 'Pricing notes' })
  @IsOptional()
  @IsString()
  pricingNotes?: string;

  // Platform billing data (számlázási adatok a Platform felé)
  @ApiPropertyOptional({ description: 'Billing company name' })
  @IsOptional()
  @IsString()
  billingCompanyName?: string;

  @ApiPropertyOptional({ description: 'Billing address' })
  @IsOptional()
  @IsString()
  billingAddress?: string;

  @ApiPropertyOptional({ description: 'Billing city' })
  @IsOptional()
  @IsString()
  billingCity?: string;

  @ApiPropertyOptional({ description: 'Billing zip code' })
  @IsOptional()
  @IsString()
  billingZipCode?: string;

  @ApiPropertyOptional({ description: 'Billing country (ISO 2-letter code)' })
  @IsOptional()
  @IsString()
  billingCountry?: string;

  @ApiPropertyOptional({ description: 'Billing tax number' })
  @IsOptional()
  @IsString()
  billingTaxNumber?: string;

  @ApiPropertyOptional({ description: 'Billing EU VAT number' })
  @IsOptional()
  @IsString()
  billingEuVatNumber?: string;

  @ApiPropertyOptional({ description: 'Billing email for invoices' })
  @IsOptional()
  @IsEmail()
  billingEmail?: string;
}

export class NetworkListItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ enum: SubscriptionStatus })
  subscriptionStatus: SubscriptionStatus;

  @ApiPropertyOptional()
  trialEndsAt?: Date;

  @ApiProperty()
  country: string;

  @ApiProperty()
  defaultCurrency: string;

  @ApiProperty()
  createdAt: Date;

  // Statistics
  @ApiProperty()
  locationCount: number;

  @ApiProperty()
  driverCount: number;

  @ApiProperty()
  washEventCount: number;
}

export class NetworkDetailDto extends NetworkListItemDto {
  @ApiProperty()
  timezone: string;

  @ApiProperty()
  defaultLanguage: string;

  @ApiPropertyOptional()
  subscriptionStartAt?: Date;

  @ApiPropertyOptional()
  subscriptionEndAt?: Date;

  @ApiProperty()
  partnerCompanyCount: number;

  // Egyedi árazás (null = platform alapértelmezett)
  @ApiPropertyOptional({ description: 'Custom monthly fee' })
  customMonthlyFee?: number | null;

  @ApiPropertyOptional({ description: 'Custom per wash fee' })
  customPerWashFee?: number | null;

  @ApiPropertyOptional({ description: 'Pricing notes' })
  pricingNotes?: string | null;

  // Platform alapértelmezett árak (összehasonlításhoz)
  @ApiPropertyOptional({ description: 'Platform default monthly fee' })
  platformMonthlyFee?: number;

  @ApiPropertyOptional({ description: 'Platform default per wash fee' })
  platformPerWashFee?: number;

  // Effektív (használt) árak
  @ApiProperty({ description: 'Effective monthly fee (custom or platform default)' })
  effectiveMonthlyFee: number;

  @ApiProperty({ description: 'Effective per wash fee (custom or platform default)' })
  effectivePerWashFee: number;

  // Platform billing data (számlázási adatok a Platform felé)
  @ApiPropertyOptional({ description: 'Billing company name' })
  billingCompanyName?: string;

  @ApiPropertyOptional({ description: 'Billing address' })
  billingAddress?: string;

  @ApiPropertyOptional({ description: 'Billing city' })
  billingCity?: string;

  @ApiPropertyOptional({ description: 'Billing zip code' })
  billingZipCode?: string;

  @ApiPropertyOptional({ description: 'Billing country' })
  billingCountry?: string;

  @ApiPropertyOptional({ description: 'Billing tax number' })
  billingTaxNumber?: string;

  @ApiPropertyOptional({ description: 'Billing EU VAT number' })
  billingEuVatNumber?: string;

  @ApiPropertyOptional({ description: 'Billing email' })
  billingEmail?: string;

  // Billing data completeness indicator
  @ApiProperty({ description: 'Whether billing data is complete for invoicing' })
  billingDataComplete: boolean;
}

// ============================================================================
// NETWORK ADMIN DTOs
// ============================================================================

export class NetworkAdminDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  role: string;

  @ApiProperty()
  isActive: boolean;

  @ApiPropertyOptional()
  lastLoginAt?: Date;

  @ApiProperty()
  createdAt: Date;
}

export class CreateNetworkAdminDto {
  @ApiProperty({ description: 'Admin email' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Admin name' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({ description: 'Admin password' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ description: 'Admin role', enum: ['NETWORK_OWNER', 'NETWORK_ADMIN', 'NETWORK_OPERATOR'] })
  @IsOptional()
  @IsString()
  role?: string;
}

export class UpdateNetworkAdminDto {
  @ApiPropertyOptional({ description: 'Admin name' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Admin role' })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({ description: 'Is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'New password' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}

// ============================================================================
// DASHBOARD DTOs
// ============================================================================

export class PlatformDashboardDto {
  @ApiProperty({ description: 'Total number of networks' })
  totalNetworks: number;

  @ApiProperty({ description: 'Active networks' })
  activeNetworks: number;

  @ApiProperty({ description: 'Trial networks' })
  trialNetworks: number;

  @ApiProperty({ description: 'Total locations across all networks' })
  totalLocations: number;

  @ApiProperty({ description: 'Total drivers across all networks' })
  totalDrivers: number;

  @ApiProperty({ description: 'Total wash events this month' })
  washEventsThisMonth: number;

  @ApiProperty({ description: 'Revenue this month (platform fees)' })
  revenueThisMonth: number;

  @ApiProperty({ description: 'Networks expiring soon (within 7 days)' })
  networksExpiringSoon: NetworkListItemDto[];
}
