import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { BookingStatus, PaymentStatus, DayOfWeek, Prisma, VehicleType } from '@prisma/client';
import {
  CreateBookingDto,
  UpdateBookingDto,
  CancelBookingDto,
  GetAvailableSlotsDto,
  ListBookingsQueryDto,
  UpdateBookingSettingsDto,
  CreateBlockedTimeSlotDto,
  CreateRecurringBlockDto,
  TimeSlotDto,
} from './dto/booking.dto';

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  // =============================================================================
  // BOOKING CRUD
  // =============================================================================

  /**
   * Foglalás létrehozása
   */
  async createBooking(networkId: string, dto: CreateBookingDto, createdBy?: { type: string; id: string }) {
    // 1. Helyszín ellenőrzése
    const location = await this.prisma.location.findFirst({
      where: { id: dto.locationId, networkId, deletedAt: null },
    });
    if (!location) {
      throw new NotFoundException('Helyszín nem található');
    }
    if (!location.bookingEnabled) {
      throw new BadRequestException('Ezen a helyszínen nem engedélyezett az online foglalás');
    }

    // 2. Szolgáltatás ellenőrzése és időtartam lekérése
    const servicePrice = await this.prisma.servicePrice.findFirst({
      where: {
        networkId,
        servicePackageId: dto.servicePackageId,
        vehicleType: dto.vehicleType as VehicleType,
        isActive: true,
      },
      include: { servicePackage: true },
    });
    if (!servicePrice) {
      throw new NotFoundException('A kiválasztott szolgáltatás nem elérhető ehhez a járműtípushoz');
    }

    // 3. Időpont ellenőrzése
    const scheduledStart = new Date(dto.scheduledStart);
    const scheduledEnd = new Date(scheduledStart.getTime() + servicePrice.durationMinutes * 60 * 1000);

    // Minimum előfoglalási idő ellenőrzése
    const now = new Date();
    const minNoticeTime = new Date(now.getTime() + location.minBookingNoticeHours * 60 * 60 * 1000);
    if (scheduledStart < minNoticeTime) {
      throw new BadRequestException(`Minimum ${location.minBookingNoticeHours} óra előre kell foglalni`);
    }

    // Maximum előre foglalás ellenőrzése
    const maxAdvanceTime = new Date(now.getTime() + location.maxBookingAdvanceDays * 24 * 60 * 60 * 1000);
    if (scheduledStart > maxAdvanceTime) {
      throw new BadRequestException(`Maximum ${location.maxBookingAdvanceDays} napra előre foglalható`);
    }

    // 4. Slot elérhetőség ellenőrzése
    const isAvailable = await this.checkSlotAvailability(
      networkId,
      dto.locationId,
      scheduledStart,
      scheduledEnd,
      location.parallelSlots,
    );
    if (!isAvailable) {
      throw new ConflictException('A kiválasztott időpont már foglalt');
    }

    // 5. Nyitvatartás ellenőrzése
    const dayOfWeek = this.getDayOfWeek(scheduledStart);
    const openingHours = await this.prisma.locationOpeningHours.findUnique({
      where: { locationId_dayOfWeek: { locationId: dto.locationId, dayOfWeek } },
    });
    if (!openingHours || openingHours.isClosed) {
      throw new BadRequestException('A helyszín zárva van ezen a napon');
    }

    const startTimeStr = scheduledStart.toTimeString().slice(0, 5);
    const endTimeStr = scheduledEnd.toTimeString().slice(0, 5);
    if (startTimeStr < openingHours.openTime || endTimeStr > openingHours.closeTime) {
      throw new BadRequestException('Az időpont a nyitvatartási időn kívül esik');
    }

    // 6. Foglalás létrehozása
    const bookingCode = await this.generateBookingCode();

    const booking = await this.prisma.booking.create({
      data: {
        networkId,
        locationId: dto.locationId,
        driverId: dto.driverId,
        bookingCode,
        scheduledStart,
        scheduledEnd,
        vehicleType: dto.vehicleType as VehicleType,
        plateNumber: dto.plateNumber,
        servicePackageId: dto.servicePackageId,
        serviceDurationMinutes: servicePrice.durationMinutes,
        servicePrice: servicePrice.price,
        currency: servicePrice.currency,
        customerName: dto.customerName,
        customerPhone: dto.customerPhone,
        customerEmail: dto.customerEmail,
        status: BookingStatus.PENDING,
        paymentStatus: PaymentStatus.PENDING,
        paymentProvider: dto.paymentProvider,
        createdByType: createdBy?.type,
        createdById: createdBy?.id,
        notes: dto.notes,
      },
      include: {
        location: { select: { id: true, name: true, code: true, city: true, address: true } },
        servicePackage: { select: { id: true, name: true, code: true } },
      },
    });

    // 7. Visszaigazoló email küldése
    if (dto.customerEmail) {
      try {
        await this.emailService.sendBookingConfirmationEmail(
          networkId,
          dto.customerEmail,
          dto.customerName || 'Kedves Ügyfelünk',
          {
            bookingCode,
            locationName: booking.location?.name || location.name,
            locationAddress: booking.location?.address || location.address || undefined,
            scheduledStart,
            scheduledEnd,
            serviceName: booking.servicePackage?.name || servicePrice.servicePackage.name,
            vehicleType: dto.vehicleType as string,
            plateNumber: dto.plateNumber,
            price: Number(servicePrice.price),
            currency: servicePrice.currency,
          },
        );
        this.logger.log(`Booking confirmation email sent to ${dto.customerEmail} for booking ${bookingCode}`);
      } catch (error) {
        // Email küldési hiba nem akadályozza meg a foglalást
        this.logger.error(`Failed to send booking confirmation email: ${error.message}`);
      }
    }

    return booking;
  }

  /**
   * Foglalás lekérése
   */
  async getBooking(networkId: string, bookingId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, networkId },
      include: {
        location: { select: { id: true, name: true, code: true, city: true } },
        servicePackage: { select: { id: true, name: true, code: true } },
        driver: { select: { id: true, firstName: true, lastName: true } },
        washEvent: { select: { id: true, status: true } },
      },
    });
    if (!booking) {
      throw new NotFoundException('Foglalás nem található');
    }
    return booking;
  }

  /**
   * Foglalás lekérése kóddal (publikus - email/sms linkhez)
   */
  async getBookingByCode(bookingCode: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { bookingCode },
      include: {
        location: { select: { id: true, name: true, code: true, city: true, address: true } },
        servicePackage: { select: { id: true, name: true, code: true } },
      },
    });
    if (!booking) {
      throw new NotFoundException('Foglalás nem található');
    }
    return booking;
  }

  /**
   * Foglalások listázása
   */
  async listBookings(networkId: string, query: ListBookingsQueryDto) {
    const where: Prisma.BookingWhereInput = { networkId };

    if (query.locationId) {
      where.locationId = query.locationId;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.dateFrom || query.dateTo) {
      where.scheduledStart = {};
      if (query.dateFrom) {
        where.scheduledStart.gte = new Date(query.dateFrom);
      }
      if (query.dateTo) {
        where.scheduledStart.lte = new Date(query.dateTo + 'T23:59:59Z');
      }
    }

    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: {
          location: { select: { id: true, name: true, code: true } },
          servicePackage: { select: { id: true, name: true, code: true } },
        },
        orderBy: { scheduledStart: 'asc' },
        skip: ((query.page || 1) - 1) * (query.limit || 20),
        take: query.limit || 20,
      }),
      this.prisma.booking.count({ where }),
    ]);

    return { data: bookings, total, page: query.page || 1, limit: query.limit || 20 };
  }

  /**
   * Mai foglalások egy helyszínen (operátor nézet)
   */
  async getTodaysBookings(networkId: string, locationId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.prisma.booking.findMany({
      where: {
        networkId,
        locationId,
        scheduledStart: { gte: today, lt: tomorrow },
        status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS] },
      },
      include: {
        servicePackage: { select: { id: true, name: true, code: true } },
      },
      orderBy: { scheduledStart: 'asc' },
    });
  }

  /**
   * Foglalás módosítása
   */
  async updateBooking(networkId: string, bookingId: string, dto: UpdateBookingDto) {
    const booking = await this.getBooking(networkId, bookingId);

    // Csak PENDING státuszú foglalás módosítható
    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException('Csak függőben lévő foglalás módosítható');
    }

    const updateData: Prisma.BookingUpdateInput = {};

    if (dto.scheduledStart) {
      const location = await this.prisma.location.findUnique({
        where: { id: booking.locationId },
      });

      const servicePrice = await this.prisma.servicePrice.findFirst({
        where: {
          networkId,
          servicePackageId: dto.servicePackageId || booking.servicePackageId,
          vehicleType: dto.vehicleType || booking.vehicleType,
          isActive: true,
        },
      });

      const newStart = new Date(dto.scheduledStart);
      const duration = servicePrice?.durationMinutes || booking.serviceDurationMinutes;
      const newEnd = new Date(newStart.getTime() + duration * 60 * 1000);

      const isAvailable = await this.checkSlotAvailability(
        networkId,
        booking.locationId,
        newStart,
        newEnd,
        location?.parallelSlots || 1,
        bookingId, // Kizárjuk a saját foglalást
      );
      if (!isAvailable) {
        throw new ConflictException('A kiválasztott időpont már foglalt');
      }

      updateData.scheduledStart = newStart;
      updateData.scheduledEnd = newEnd;
    }

    if (dto.servicePackageId) {
      updateData.servicePackage = { connect: { id: dto.servicePackageId } };
    }
    if (dto.vehicleType) {
      updateData.vehicleType = dto.vehicleType;
    }
    if (dto.plateNumber !== undefined) {
      updateData.plateNumber = dto.plateNumber;
    }
    if (dto.customerName !== undefined) {
      updateData.customerName = dto.customerName;
    }
    if (dto.customerPhone !== undefined) {
      updateData.customerPhone = dto.customerPhone;
    }
    if (dto.customerEmail !== undefined) {
      updateData.customerEmail = dto.customerEmail;
    }
    if (dto.notes !== undefined) {
      updateData.notes = dto.notes;
    }

    return this.prisma.booking.update({
      where: { id: bookingId },
      data: updateData,
      include: {
        location: { select: { id: true, name: true, code: true, city: true } },
        servicePackage: { select: { id: true, name: true, code: true } },
      },
    });
  }

  /**
   * Foglalás megerősítése
   */
  async confirmBooking(networkId: string, bookingId: string) {
    const booking = await this.getBooking(networkId, bookingId);

    if (booking.status !== BookingStatus.PENDING) {
      throw new BadRequestException('Csak függőben lévő foglalás erősíthető meg');
    }

    return this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.CONFIRMED },
      include: {
        location: { select: { id: true, name: true, code: true, city: true } },
        servicePackage: { select: { id: true, name: true, code: true } },
      },
    });
  }

  /**
   * Foglalás lemondása
   */
  async cancelBooking(
    networkId: string,
    bookingId: string,
    dto: CancelBookingDto,
    cancelledBy: string,
  ) {
    const booking = await this.getBooking(networkId, bookingId);

    // Csak PENDING vagy CONFIRMED státuszú foglalás mondható le
    if (booking.status !== BookingStatus.PENDING && booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException('Ez a foglalás már nem mondható le');
    }

    // Lemondási díj számítása
    const settings = await this.getBookingSettings(networkId);
    let cancellationFee = 0;

    const hoursUntilBooking = (booking.scheduledStart.getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursUntilBooking < settings.cancellationDeadlineHours) {
      cancellationFee = Number(booking.servicePrice) * (settings.cancellationFeePercent / 100);
    }

    return this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledBy,
        cancellationReason: dto.reason,
        cancellationFeeApplied: cancellationFee > 0 ? cancellationFee : null,
      },
      include: {
        location: { select: { id: true, name: true, code: true, city: true } },
        servicePackage: { select: { id: true, name: true, code: true } },
      },
    });
  }

  /**
   * Foglalás indítása (mosás elkezdése)
   */
  async startBooking(networkId: string, bookingId: string) {
    const booking = await this.getBooking(networkId, bookingId);

    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException('Csak megerősített foglalás indítható');
    }

    return this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.IN_PROGRESS },
    });
  }

  /**
   * Foglalás befejezése
   */
  async completeBooking(networkId: string, bookingId: string, washEventId?: string) {
    const booking = await this.getBooking(networkId, bookingId);

    if (booking.status !== BookingStatus.IN_PROGRESS) {
      throw new BadRequestException('Csak folyamatban lévő foglalás fejezhető be');
    }

    return this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.COMPLETED,
        washEventId,
      },
    });
  }

  /**
   * No-show megjelölése
   */
  async markNoShow(networkId: string, bookingId: string) {
    const booking = await this.getBooking(networkId, bookingId);

    if (booking.status !== BookingStatus.PENDING && booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException('Csak függőben lévő vagy megerősített foglalás jelölhető no-show-nak');
    }

    const settings = await this.getBookingSettings(networkId);
    const noShowFee = Number(booking.servicePrice) * (settings.noShowFeePercent / 100);

    return this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.NO_SHOW,
        cancellationFeeApplied: noShowFee > 0 ? noShowFee : null,
      },
    });
  }

  // =============================================================================
  // AVAILABILITY & SLOTS
  // =============================================================================

  /**
   * Elérhető időpontok lekérése egy napra
   */
  async getAvailableSlots(networkId: string, dto: GetAvailableSlotsDto): Promise<TimeSlotDto[]> {
    const location = await this.prisma.location.findFirst({
      where: { id: dto.locationId, networkId, deletedAt: null },
    });
    if (!location || !location.bookingEnabled) {
      return [];
    }

    // Szolgáltatás időtartam lekérése (ha van)
    let durationMinutes = location.slotIntervalMinutes;
    if (dto.servicePackageId && dto.vehicleType) {
      const servicePrice = await this.prisma.servicePrice.findFirst({
        where: {
          networkId,
          servicePackageId: dto.servicePackageId,
          vehicleType: dto.vehicleType,
          isActive: true,
        },
      });
      if (servicePrice) {
        durationMinutes = servicePrice.durationMinutes;
      }
    }

    // Nap meghatározása
    const date = new Date(dto.date);
    const dayOfWeek = this.getDayOfWeek(date);

    // Nyitvatartás lekérése
    const openingHours = await this.prisma.locationOpeningHours.findUnique({
      where: { locationId_dayOfWeek: { locationId: dto.locationId, dayOfWeek } },
    });
    if (!openingHours || openingHours.isClosed) {
      return [];
    }

    // Nap kezdete és vége
    const [openHour, openMin] = openingHours.openTime.split(':').map(Number);
    const [closeHour, closeMin] = openingHours.closeTime.split(':').map(Number);

    const dayStart = new Date(date);
    dayStart.setHours(openHour, openMin, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(closeHour, closeMin, 0, 0);

    // Meglévő foglalások lekérése
    const existingBookings = await this.prisma.booking.findMany({
      where: {
        networkId,
        locationId: dto.locationId,
        scheduledStart: { gte: dayStart, lt: dayEnd },
        status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS] },
      },
      select: { scheduledStart: true, scheduledEnd: true },
    });

    // Letiltott időszakok lekérése
    const blockedSlots = await this.prisma.blockedTimeSlot.findMany({
      where: {
        networkId,
        locationId: dto.locationId,
        OR: [
          // Egyszeri blokkolás
          { isRecurring: false, startTime: { gte: dayStart, lt: dayEnd } },
          // Ismétlődő blokkolás
          { isRecurring: true, recurringDayOfWeek: dayOfWeek },
        ],
      },
    });

    // Időpontok generálása
    const slots: TimeSlotDto[] = [];
    const slotInterval = location.slotIntervalMinutes;
    let currentSlot = new Date(dayStart);

    const now = new Date();
    const minNoticeTime = new Date(now.getTime() + location.minBookingNoticeHours * 60 * 60 * 1000);

    while (currentSlot.getTime() + durationMinutes * 60 * 1000 <= dayEnd.getTime()) {
      const slotEnd = new Date(currentSlot.getTime() + durationMinutes * 60 * 1000);

      // Ellenőrzések
      let available = true;
      let reason = '';

      // Múltbeli vagy túl közeli időpont
      if (currentSlot < minNoticeTime) {
        available = false;
        reason = 'past';
      }

      // Foglalások ütközése
      if (available) {
        const conflictingBookings = existingBookings.filter(
          (b) => currentSlot < b.scheduledEnd && slotEnd > b.scheduledStart,
        );
        if (conflictingBookings.length >= location.parallelSlots) {
          available = false;
          reason = 'booked';
        }
      }

      // Letiltott időszak
      if (available) {
        const blocked = blockedSlots.some((b) => {
          if (b.isRecurring && b.recurringStartTime && b.recurringEndTime) {
            const slotTimeStr = currentSlot.toTimeString().slice(0, 5);
            const slotEndTimeStr = slotEnd.toTimeString().slice(0, 5);
            return slotTimeStr < b.recurringEndTime && slotEndTimeStr > b.recurringStartTime;
          }
          return currentSlot < b.endTime && slotEnd > b.startTime;
        });
        if (blocked) {
          available = false;
          reason = 'blocked';
        }
      }

      // Szabad helyek száma
      const conflictingCount = existingBookings.filter(
        (b) => currentSlot < b.scheduledEnd && slotEnd > b.scheduledStart,
      ).length;
      const remainingSlots = Math.max(0, location.parallelSlots - conflictingCount);

      slots.push({
        startTime: currentSlot.toISOString(),
        endTime: slotEnd.toISOString(),
        available,
        remainingSlots: available ? remainingSlots : 0,
      });

      // Következő slot
      currentSlot = new Date(currentSlot.getTime() + slotInterval * 60 * 1000);
    }

    return slots;
  }

  /**
   * Slot elérhetőség ellenőrzése
   */
  private async checkSlotAvailability(
    networkId: string,
    locationId: string,
    start: Date,
    end: Date,
    parallelSlots: number,
    excludeBookingId?: string,
  ): Promise<boolean> {
    const where: Prisma.BookingWhereInput = {
      networkId,
      locationId,
      status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS] },
      AND: [
        { scheduledStart: { lt: end } },
        { scheduledEnd: { gt: start } },
      ],
    };

    if (excludeBookingId) {
      where.id = { not: excludeBookingId };
    }

    const conflictingCount = await this.prisma.booking.count({ where });
    return conflictingCount < parallelSlots;
  }

  // =============================================================================
  // BOOKING SETTINGS
  // =============================================================================

  /**
   * Foglalási beállítások lekérése
   */
  async getBookingSettings(networkId: string) {
    let settings = await this.prisma.bookingSettings.findUnique({
      where: { networkId },
    });

    // Ha nincs, létrehozzuk alapértelmezett értékekkel
    if (!settings) {
      settings = await this.prisma.bookingSettings.create({
        data: { networkId },
      });
    }

    return {
      cancellationDeadlineHours: settings.cancellationDeadlineHours,
      cancellationFeePercent: Number(settings.cancellationFeePercent),
      noShowFeePercent: Number(settings.noShowFeePercent),
      reminderEnabled: settings.reminderEnabled,
      reminderHoursBefore: settings.reminderHoursBefore,
      requirePrepaymentOnline: settings.requirePrepaymentOnline,
      allowPayOnSiteCash: settings.allowPayOnSiteCash,
      allowPayOnSiteCard: settings.allowPayOnSiteCard,
      allowOnlineCard: settings.allowOnlineCard,
      allowApplePay: settings.allowApplePay,
      allowGooglePay: settings.allowGooglePay,
      hasStripeAccount: !!settings.stripeAccountId,
      hasSimplePay: !!settings.simplepayMerchantId,
      hasBarion: !!settings.barionPosKey,
      cancellationPolicyText: settings.cancellationPolicyText || undefined,
      confirmationMessage: settings.confirmationMessage || undefined,
    };
  }

  /**
   * Foglalási beállítások frissítése
   */
  async updateBookingSettings(networkId: string, dto: UpdateBookingSettingsDto) {
    await this.prisma.bookingSettings.upsert({
      where: { networkId },
      create: { networkId, ...dto },
      update: dto,
    });

    return this.getBookingSettings(networkId);
  }

  // =============================================================================
  // BLOCKED TIME SLOTS
  // =============================================================================

  /**
   * Letiltott időszak létrehozása
   */
  async createBlockedTimeSlot(networkId: string, dto: CreateBlockedTimeSlotDto, createdBy?: string) {
    return this.prisma.blockedTimeSlot.create({
      data: {
        networkId,
        locationId: dto.locationId,
        startTime: new Date(dto.startTime),
        endTime: new Date(dto.endTime),
        reason: dto.reason,
        isRecurring: false,
        createdBy,
      },
    });
  }

  /**
   * Ismétlődő letiltás létrehozása
   */
  async createRecurringBlock(networkId: string, dto: CreateRecurringBlockDto, createdBy?: string) {
    // A start/end time egy jövőbeli dátumra, de a lényeg a recurring mezők
    const now = new Date();
    return this.prisma.blockedTimeSlot.create({
      data: {
        networkId,
        locationId: dto.locationId,
        startTime: now,
        endTime: now,
        reason: dto.reason,
        isRecurring: true,
        recurringDayOfWeek: dto.dayOfWeek as DayOfWeek,
        recurringStartTime: dto.startTime,
        recurringEndTime: dto.endTime,
        createdBy,
      },
    });
  }

  /**
   * Letiltott időszakok listázása
   */
  async listBlockedTimeSlots(networkId: string, locationId?: string) {
    const where: Prisma.BlockedTimeSlotWhereInput = { networkId };
    if (locationId) {
      where.locationId = locationId;
    }

    return this.prisma.blockedTimeSlot.findMany({
      where,
      include: {
        location: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ isRecurring: 'asc' }, { startTime: 'asc' }],
    });
  }

  /**
   * Letiltott időszak törlése
   */
  async deleteBlockedTimeSlot(networkId: string, blockedSlotId: string) {
    const blocked = await this.prisma.blockedTimeSlot.findFirst({
      where: { id: blockedSlotId, networkId },
    });
    if (!blocked) {
      throw new NotFoundException('Letiltott időszak nem található');
    }

    await this.prisma.blockedTimeSlot.delete({ where: { id: blockedSlotId } });
    return { success: true };
  }

  // =============================================================================
  // HELPER METHODS
  // =============================================================================

  /**
   * DayOfWeek enum meghatározása dátumból
   */
  private getDayOfWeek(date: Date): DayOfWeek {
    const days: DayOfWeek[] = [
      DayOfWeek.SUNDAY,
      DayOfWeek.MONDAY,
      DayOfWeek.TUESDAY,
      DayOfWeek.WEDNESDAY,
      DayOfWeek.THURSDAY,
      DayOfWeek.FRIDAY,
      DayOfWeek.SATURDAY,
    ];
    return days[date.getDay()];
  }

  /**
   * Egyedi foglalási kód generálása
   */
  private async generateBookingCode(): Promise<string> {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Kihagyjuk a félreérthető karaktereket (I, O, 0, 1)
    let code: string;
    let exists = true;

    while (exists) {
      code = '';
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      const existing = await this.prisma.booking.findUnique({
        where: { bookingCode: code },
      });
      exists = !!existing;
    }

    return code!;
  }
}
