import { IsString, IsOptional, IsDateString, IsEnum, IsNumber, IsEmail, Min, Max, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { VehicleType, BookingStatus, PaymentStatus, PaymentProvider } from '@prisma/client';

// =============================================================================
// QUERY DTOs
// =============================================================================

export class GetAvailableSlotsDto {
  @IsString()
  locationId: string;

  @IsDateString()
  date: string; // YYYY-MM-DD

  @IsOptional()
  @IsString()
  servicePackageId?: string;

  @IsOptional()
  @IsEnum(VehicleType)
  vehicleType?: VehicleType;
}

export class ListBookingsQueryDto {
  @IsOptional()
  @IsString()
  locationId?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

// =============================================================================
// CREATE / UPDATE DTOs
// =============================================================================

export class CreateBookingDto {
  @IsString()
  locationId: string;

  @IsDateString()
  scheduledStart: string; // ISO datetime

  @IsString()
  servicePackageId: string;

  @IsEnum(VehicleType)
  vehicleType: VehicleType;

  @IsOptional()
  @IsString()
  plateNumber?: string;

  // Ügyfél adatok (kötelező ha nincs driverId)
  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  customerPhone?: string;

  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  // Driver ID (ha bejelentkezett sofőr foglalja)
  @IsOptional()
  @IsString()
  driverId?: string;

  // Fizetési mód választás
  @IsOptional()
  @IsEnum(PaymentProvider)
  paymentProvider?: PaymentProvider;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateBookingDto {
  @IsOptional()
  @IsDateString()
  scheduledStart?: string;

  @IsOptional()
  @IsString()
  servicePackageId?: string;

  @IsOptional()
  @IsEnum(VehicleType)
  vehicleType?: VehicleType;

  @IsOptional()
  @IsString()
  plateNumber?: string;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  customerPhone?: string;

  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CancelBookingDto {
  @IsString()
  reason: string;
}

export class ConfirmBookingDto {
  @IsOptional()
  @IsEnum(PaymentProvider)
  paymentProvider?: PaymentProvider;

  @IsOptional()
  @IsString()
  paymentMethodSelected?: string;
}

// =============================================================================
// BOOKING SETTINGS DTOs
// =============================================================================

export class UpdateBookingSettingsDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(168) // Max 1 hét
  cancellationDeadlineHours?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  cancellationFeePercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  noShowFeePercent?: number;

  @IsOptional()
  @IsBoolean()
  reminderEnabled?: boolean;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  reminderHoursBefore?: number[];

  @IsOptional()
  @IsBoolean()
  requirePrepaymentOnline?: boolean;

  @IsOptional()
  @IsBoolean()
  allowPayOnSiteCash?: boolean;

  @IsOptional()
  @IsBoolean()
  allowPayOnSiteCard?: boolean;

  @IsOptional()
  @IsBoolean()
  allowOnlineCard?: boolean;

  @IsOptional()
  @IsBoolean()
  allowApplePay?: boolean;

  @IsOptional()
  @IsBoolean()
  allowGooglePay?: boolean;

  @IsOptional()
  @IsString()
  stripeAccountId?: string;

  @IsOptional()
  @IsString()
  simplepayMerchantId?: string;

  @IsOptional()
  @IsString()
  simplepaySecretKey?: string;

  @IsOptional()
  @IsString()
  barionPosKey?: string;

  @IsOptional()
  @IsString()
  barionPixelId?: string;

  @IsOptional()
  @IsString()
  cancellationPolicyText?: string;

  @IsOptional()
  @IsString()
  confirmationMessage?: string;
}

// =============================================================================
// BLOCKED TIME SLOT DTOs
// =============================================================================

export class CreateBlockedTimeSlotDto {
  @IsString()
  locationId: string;

  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreateRecurringBlockDto {
  @IsString()
  locationId: string;

  @IsString()
  dayOfWeek: string; // MONDAY, TUESDAY, etc.

  @IsString()
  startTime: string; // HH:MM

  @IsString()
  endTime: string; // HH:MM

  @IsOptional()
  @IsString()
  reason?: string;
}

// =============================================================================
// RESPONSE DTOs
// =============================================================================

export class TimeSlotDto {
  startTime: string; // ISO datetime
  endTime: string;   // ISO datetime
  available: boolean;
  remainingSlots: number;
}

export class BookingResponseDto {
  id: string;
  bookingCode: string;
  networkId: string;
  locationId: string;
  driverId?: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  vehicleType: VehicleType;
  plateNumber?: string;
  servicePackageId: string;
  serviceDurationMinutes: number;
  servicePrice: number;
  currency: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  paymentProvider?: PaymentProvider;
  prepaidAmount: number;
  totalPaid: number;
  cancelledAt?: Date;
  cancellationReason?: string;
  washEventId?: string;
  createdAt: Date;
  updatedAt: Date;

  // Populated relations
  location?: {
    id: string;
    name: string;
    code: string;
    city?: string;
  };
  servicePackage?: {
    id: string;
    name: string;
    code: string;
  };
}

export class BookingSettingsResponseDto {
  cancellationDeadlineHours: number;
  cancellationFeePercent: number;
  noShowFeePercent: number;
  reminderEnabled: boolean;
  reminderHoursBefore: number[];
  requirePrepaymentOnline: boolean;
  allowPayOnSiteCash: boolean;
  allowPayOnSiteCard: boolean;
  allowOnlineCard: boolean;
  allowApplePay: boolean;
  allowGooglePay: boolean;
  hasStripeAccount: boolean;
  hasSimplePay: boolean;
  hasBarion: boolean;
  cancellationPolicyText?: string;
  confirmationMessage?: string;
}
