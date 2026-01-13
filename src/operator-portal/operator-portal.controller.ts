import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  BadRequestException,
  Req,
  Res,
} from '@nestjs/common';
import { LoginThrottle } from '../common/throttler/login-throttle.decorator';
import { Request, Response } from 'express';
import { AuditLogService } from '../modules/audit-log/audit-log.service';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { WashEventService } from '../modules/wash-event/wash-event.service';
import { LocationService } from '../modules/location/location.service';
import { BillingService } from '../billing/billing.service';
import { BookingService } from '../modules/booking/booking.service';
import { SessionService, OperatorSessionData } from '../common/session/session.service';
import { SessionType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { setSessionCookie, clearSessionCookie, getSessionId, SESSION_COOKIES } from '../common/session/cookie.helper';

@Controller('operator-portal')
export class OperatorPortalController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly washEventService: WashEventService,
    private readonly locationService: LocationService,
    private readonly billingService: BillingService,
    private readonly bookingService: BookingService,
    private readonly sessionService: SessionService,
    private readonly auditLogService: AuditLogService,
  ) {}

  // SECURITY: Get session from cookie (httpOnly) or header (backwards compatibility)
  private async getSession(headerSessionId: string | undefined, req?: Request): Promise<OperatorSessionData> {
    // Try cookie first if request is provided
    let sessionId = headerSessionId;
    if (req) {
      const cookieSessionId = getSessionId(req, SESSION_COOKIES.OPERATOR, 'x-operator-session');
      if (cookieSessionId) {
        sessionId = cookieSessionId;
      }
    }

    if (!sessionId) {
      throw new UnauthorizedException('Session ID required');
    }
    const session = await this.sessionService.getSession<OperatorSessionData>(
      sessionId,
      SessionType.OPERATOR,
    );
    if (!session) {
      throw new UnauthorizedException('Invalid or expired session');
    }
    return session;
  }

  @Post('login')
  @LoginThrottle() // SECURITY: Brute force protection - 5 attempts per minute
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: { locationCode: string; pin: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ipAddress = req.ip || req.socket?.remoteAddress;
    const userAgent = req.get('user-agent');

    if (!body.locationCode || !body.pin) {
      throw new BadRequestException('Location code and PIN are required');
    }

    // Find location by code (across all networks for now - could be restricted)
    const location = await this.prisma.location.findFirst({
      where: {
        code: body.locationCode.toUpperCase(),
        isActive: true,
        deletedAt: null,
      },
      include: {
        network: true,
        operators: {
          where: {
            isActive: true,
            deletedAt: null,
          },
        },
      },
    });

    if (!location) {
      // AUDIT: Log failed login - invalid location code
      await this.auditLogService.log({
        action: AuditAction.LOGIN_FAILED,
        actorType: 'OPERATOR',
        metadata: { locationCode: body.locationCode.toUpperCase(), error: 'Invalid location code' },
        ipAddress,
        userAgent,
      });
      throw new UnauthorizedException('Invalid location code');
    }

    // Try to authenticate with location operators first
    let authenticatedOperator: { id: string; name: string } | null = null;

    for (const operator of location.operators) {
      const isValidPin = await bcrypt.compare(body.pin, operator.pinHash);
      if (isValidPin) {
        authenticatedOperator = { id: operator.id, name: operator.name };
        break;
      }
    }

    // If no operator found with valid PIN, reject authentication
    if (!authenticatedOperator) {
      // AUDIT: Log failed login - invalid PIN
      await this.auditLogService.log({
        networkId: location.networkId,
        action: AuditAction.LOGIN_FAILED,
        actorType: 'OPERATOR',
        metadata: { locationCode: body.locationCode.toUpperCase(), locationId: location.id, error: 'Invalid PIN' },
        ipAddress,
        userAgent,
      });
      throw new UnauthorizedException('Hibás PIN kód. Kérd a Network Admin-t, hogy hozzon létre operátort ehhez a helyszínhez.');
    }

    // Create session and store in database
    const sessionData: OperatorSessionData = {
      networkId: location.networkId,
      locationId: location.id,
      locationName: location.name,
      locationCode: location.code,
      washMode: location.washMode,
      operatorId: authenticatedOperator.id || null,
      operatorName: authenticatedOperator.name,
    };

    const sessionId = await this.sessionService.createSession(
      SessionType.OPERATOR,
      sessionData,
      {
        networkId: location.networkId,
        userId: authenticatedOperator.id,
      },
    );

    // SECURITY: Set httpOnly cookie for session (XSS protection)
    setSessionCookie(res, SESSION_COOKIES.OPERATOR, sessionId);

    // AUDIT: Log successful login
    await this.auditLogService.log({
      networkId: location.networkId,
      action: AuditAction.LOGIN_SUCCESS,
      actorType: 'OPERATOR',
      actorId: authenticatedOperator.id,
      metadata: { locationCode: body.locationCode.toUpperCase(), locationId: location.id, operatorName: authenticatedOperator.name },
      ipAddress,
      userAgent,
    });

    return {
      sessionId,
      locationId: location.id,
      locationName: location.name,
      locationCode: location.code,
      washMode: location.washMode,
      networkName: location.network.name,
      operatorName: authenticatedOperator.name,
    };
  }

  @Get('profile')
  async getProfile(
    @Headers('x-operator-session') sessionId: string,
  ) {
    const session = await this.getSession(sessionId);

    const location = await this.prisma.location.findUnique({
      where: { id: session.locationId },
      include: {
        network: true,
        openingHoursStructured: true,
      },
    });

    // Nyitvatartási órák mapelése
    const openingHours = location?.openingHoursStructured?.reduce((acc, oh) => {
      acc[oh.dayOfWeek] = {
        openTime: oh.openTime,
        closeTime: oh.closeTime,
        isClosed: oh.isClosed,
      };
      return acc;
    }, {} as Record<string, { openTime: string; closeTime: string; isClosed: boolean }>) || {};

    return {
      locationId: session.locationId,
      locationName: location?.name || session.locationName,
      locationCode: location?.code || session.locationCode,
      washMode: location?.washMode || session.washMode,
      networkName: location?.network.name,
      operatorId: session.operatorId,
      operatorName: session.operatorName,
      openingHours,
    };
  }

  @Get('queue')
  async getWashQueue(
    @Headers('x-operator-session') sessionId: string,
  ) {
    const session = await this.getSession(sessionId);

    // Get wash events that are in queue (CREATED, AUTHORIZED, IN_PROGRESS)
    const events = await this.prisma.washEvent.findMany({
      where: {
        networkId: session.networkId,
        locationId: session.locationId,
        status: {
          in: ['CREATED', 'AUTHORIZED', 'IN_PROGRESS'],
        },
      },
      include: {
        driver: true,
        partnerCompany: true,
        servicePackage: true,
        tractorVehicle: true,
        trailerVehicle: true,
        services: {
          include: {
            servicePackage: true,
          },
        },
      },
      orderBy: [
        { status: 'asc' }, // IN_PROGRESS first
        { createdAt: 'asc' },
      ],
    });

    // Group by status for easier display
    const inProgress = events.filter(e => e.status === 'IN_PROGRESS');
    const authorized = events.filter(e => e.status === 'AUTHORIZED');
    const created = events.filter(e => e.status === 'CREATED');

    return {
      inProgress,
      authorized,
      created,
      total: events.length,
      washMode: session.washMode,
    };
  }

  @Get('wash-events')
  async getWashEvents(
    @Headers('x-operator-session') sessionId: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
  ) {
    const session = await this.getSession(sessionId);

    const where: any = {
      networkId: session.networkId,
      locationId: session.locationId,
    };

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const events = await this.prisma.washEvent.findMany({
      where,
      include: {
        driver: true,
        partnerCompany: true,
        servicePackage: true,
        tractorVehicle: true,
        trailerVehicle: true,
        services: {
          include: {
            servicePackage: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit ? parseInt(limit) : 50,
    });

    return { data: events };
  }

  @Get('wash-events/:id')
  async getWashEvent(
    @Param('id') id: string,
    @Headers('x-operator-session') sessionId: string,
  ) {
    const session = await this.getSession(sessionId);

    const event = await this.prisma.washEvent.findFirst({
      where: {
        id,
        networkId: session.networkId,
        locationId: session.locationId,
      },
      include: {
        driver: true,
        partnerCompany: true,
        servicePackage: true,
        tractorVehicle: true,
        trailerVehicle: true,
        services: {
          include: {
            servicePackage: true,
          },
        },
        auditLogs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!event) {
      throw new BadRequestException('Wash event not found');
    }

    return event;
  }

  @Post('wash-events/:id/authorize')
  @HttpCode(HttpStatus.OK)
  async authorizeWashEvent(
    @Param('id') id: string,
    @Headers('x-operator-session') sessionId: string,
    @Req() req: Request,
  ) {
    const session = await this.getSession(sessionId);

    // Verify event belongs to this location
    const event = await this.prisma.washEvent.findFirst({
      where: {
        id,
        networkId: session.networkId,
        locationId: session.locationId,
      },
    });

    if (!event) {
      throw new BadRequestException('Wash event not found');
    }

    return this.washEventService.authorize(session.networkId, id, {
      actorType: 'USER',
      actorId: `operator:${session.locationCode}`,
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.get('user-agent'),
    });
  }

  @Post('wash-events/:id/start')
  @HttpCode(HttpStatus.OK)
  async startWashEvent(
    @Param('id') id: string,
    @Headers('x-operator-session') sessionId: string,
    @Req() req: Request,
  ) {
    const session = await this.getSession(sessionId);

    // Verify event belongs to this location
    const event = await this.prisma.washEvent.findFirst({
      where: {
        id,
        networkId: session.networkId,
        locationId: session.locationId,
      },
    });

    if (!event) {
      throw new BadRequestException('Wash event not found');
    }

    return this.washEventService.start(session.networkId, id, {
      actorType: 'USER',
      actorId: `operator:${session.locationCode}`,
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.get('user-agent'),
    });
  }

  @Post('wash-events/:id/complete')
  @HttpCode(HttpStatus.OK)
  async completeWashEvent(
    @Param('id') id: string,
    @Headers('x-operator-session') sessionId: string,
    @Req() req: Request,
  ) {
    const session = await this.getSession(sessionId);

    // Verify event belongs to this location
    const event = await this.prisma.washEvent.findFirst({
      where: {
        id,
        networkId: session.networkId,
        locationId: session.locationId,
      },
    });

    if (!event) {
      throw new BadRequestException('Wash event not found');
    }

    return this.washEventService.complete(session.networkId, id, {
      actorType: 'USER',
      actorId: `operator:${session.locationCode}`,
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.get('user-agent'),
    });
  }

  @Post('wash-events/:id/reject')
  @HttpCode(HttpStatus.OK)
  async rejectWashEvent(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Headers('x-operator-session') sessionId: string,
    @Req() req: Request,
  ) {
    const session = await this.getSession(sessionId);

    if (!reason) {
      throw new BadRequestException('Rejection reason is required');
    }

    // Verify event belongs to this location
    const event = await this.prisma.washEvent.findFirst({
      where: {
        id,
        networkId: session.networkId,
        locationId: session.locationId,
      },
    });

    if (!event) {
      throw new BadRequestException('Wash event not found');
    }

    return this.washEventService.reject(session.networkId, id, reason, {
      actorType: 'USER',
      actorId: `operator:${session.locationCode}`,
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.get('user-agent'),
    });
  }

  @Get('statistics')
  async getStatistics(
    @Headers('x-operator-session') sessionId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const session = await this.getSession(sessionId);

    const where: any = {
      networkId: session.networkId,
      locationId: session.locationId,
    };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    // Get counts by status
    const statusCounts = await this.prisma.washEvent.groupBy({
      by: ['status'],
      where,
      _count: true,
    });

    // Get total
    const total = await this.prisma.washEvent.count({ where });

    // Get today's stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = await this.prisma.washEvent.count({
      where: {
        ...where,
        createdAt: { gte: today },
      },
    });

    const todayCompleted = await this.prisma.washEvent.count({
      where: {
        ...where,
        createdAt: { gte: today },
        status: 'COMPLETED',
      },
    });

    return {
      total,
      byStatus: Object.fromEntries(
        statusCounts.map(s => [s.status, s._count])
      ),
      today: {
        total: todayCount,
        completed: todayCompleted,
      },
    };
  }

  // ==================== Partner és szolgáltatás lista ====================

  @Get('partners')
  async getPartners(
    @Headers('x-operator-session') sessionId: string,
  ) {
    const session = await this.getSession(sessionId);

    const partners = await this.prisma.partnerCompany.findMany({
      where: {
        networkId: session.networkId,
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        code: true,
        name: true,
        billingType: true,
        billingName: true,
        billingAddress: true,
        billingCity: true,
        billingZipCode: true,
        billingCountry: true,
        taxNumber: true,
        email: true,
      },
      orderBy: { name: 'asc' },
    });

    return { data: partners };
  }

  @Get('services')
  async getServices(
    @Headers('x-operator-session') sessionId: string,
  ) {
    const session = await this.getSession(sessionId);

    const services = await this.prisma.servicePackage.findMany({
      where: {
        networkId: session.networkId,
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
      },
      orderBy: { name: 'asc' },
    });

    return { data: services };
  }

  @Get('prices')
  async getPrices(
    @Headers('x-operator-session') sessionId: string,
    @Query('serviceId') serviceId?: string,
    @Query('vehicleType') vehicleType?: string,
  ) {
    const session = await this.getSession(sessionId);

    const where: any = {
      networkId: session.networkId,
      isActive: true,
    };

    if (serviceId) {
      where.servicePackageId = serviceId;
    }
    if (vehicleType) {
      where.vehicleType = vehicleType;
    }

    const prices = await this.prisma.servicePrice.findMany({
      where,
      include: {
        servicePackage: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    return { data: prices };
  }

  // ==================== Manuális mosás rögzítés ====================

  @Post('wash-events/create')
  @HttpCode(HttpStatus.CREATED)
  async createManualWashEvent(
    @Headers('x-operator-session') sessionId: string,
    @Body() body: {
      // Szerződéses ügyfél
      partnerCompanyId?: string;

      // Nem szerződéses ügyfél adatai
      isAdHoc?: boolean;
      companyName?: string;
      taxNumber?: string;
      billingAddress?: string;
      billingCity?: string;
      billingZipCode?: string;
      billingCountry?: string;
      email?: string;

      // Járművek
      tractorPlate: string;
      tractorVehicleType: string;
      trailerPlate?: string;
      trailerVehicleType?: string;
      driverName?: string;

      // DEPRECATED - régi egyetlen szolgáltatás (visszafelé kompatibilitás)
      servicePackageId?: string;

      // ÚJ - Több szolgáltatás támogatása
      services?: Array<{
        servicePackageId: string;
        vehicleType: string;
        vehicleRole?: 'TRACTOR' | 'TRAILER';  // Melyik járműhöz tartozik
        plateNumber?: string;
        quantity?: number;
      }>;

      // Fizetési mód (AD_HOC esetén)
      paymentMethod?: string;
    },
    @Req() req: Request,
  ) {
    const session = await this.getSession(sessionId);

    // Validáció - kell legalább egy szolgáltatás (új vagy régi módon)
    const hasServices = body.services && body.services.length > 0;
    const hasLegacyService = body.servicePackageId && body.tractorVehicleType;

    if (!hasServices && !hasLegacyService) {
      throw new BadRequestException('Legalább egy szolgáltatás megadása kötelező');
    }

    if (!body.tractorPlate) {
      throw new BadRequestException('Rendszám megadása kötelező');
    }

    let partnerCompanyId: string;
    let isAdHocCustomer = body.isAdHoc === true;

    if (isAdHocCustomer) {
      // Nem szerződéses ügyfél - ellenőrzés és létrehozás
      if (!body.companyName || !body.taxNumber || !body.email) {
        throw new BadRequestException('Cégnév, adószám és email megadása kötelező nem szerződéses ügyfélnél');
      }

      // Létrehozunk egy egyedi kódot az ad-hoc partnernek
      const adHocCode = `ADHOC_${Date.now()}`;

      // Létrehozzuk a partnert CASH billing típussal
      const partner = await this.prisma.partnerCompany.create({
        data: {
          networkId: session.networkId,
          name: body.companyName,
          code: adHocCode,
          email: body.email,
          billingType: 'CASH',
          billingName: body.companyName,
          billingAddress: body.billingAddress || '',
          billingCity: body.billingCity || '',
          billingZipCode: body.billingZipCode || '',
          billingCountry: body.billingCountry || 'HU',
          taxNumber: body.taxNumber,
          isActive: true,
        },
      });

      partnerCompanyId = partner.id;
    } else {
      // Szerződéses ügyfél
      if (!body.partnerCompanyId) {
        throw new BadRequestException('Partner kiválasztása kötelező szerződéses ügyfélnél');
      }

      // Ellenőrizzük, hogy a partner létezik és ehhez a networkhoz tartozik
      const partner = await this.prisma.partnerCompany.findFirst({
        where: {
          id: body.partnerCompanyId,
          networkId: session.networkId,
          isActive: true,
          deletedAt: null,
        },
      });

      if (!partner) {
        throw new BadRequestException('Partner nem található');
      }

      partnerCompanyId = partner.id;
    }

    // Szolgáltatások és árak előkészítése
    type ServiceItem = {
      servicePackageId: string;
      vehicleType: string;
      vehicleRole?: 'TRACTOR' | 'TRAILER';
      plateNumber?: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    };

    const serviceItems: ServiceItem[] = [];
    let totalPrice = 0;

    if (hasServices) {
      // Új mód - több szolgáltatás
      for (const svc of body.services!) {
        const price = await this.billingService.getPrice(
          session.networkId,
          svc.servicePackageId,
          svc.vehicleType as any,
          partnerCompanyId,
        );

        if (!price) {
          throw new BadRequestException(`Nincs ár beállítva: ${svc.servicePackageId} / ${svc.vehicleType}`);
        }

        const qty = svc.quantity || 1;
        const unitPrice = Number(price.price);
        const itemTotal = unitPrice * qty;

        serviceItems.push({
          servicePackageId: svc.servicePackageId,
          vehicleType: svc.vehicleType,
          vehicleRole: svc.vehicleRole,
          plateNumber: svc.plateNumber || (svc.vehicleRole === 'TRAILER' ? body.trailerPlate : body.tractorPlate),
          quantity: qty,
          unitPrice,
          totalPrice: itemTotal,
        });

        totalPrice += itemTotal;
      }
    } else {
      // Régi mód - kompatibilitás
      const tractorPrice = await this.billingService.getPrice(
        session.networkId,
        body.servicePackageId!,
        body.tractorVehicleType as any,
        partnerCompanyId,
      );

      if (!tractorPrice) {
        throw new BadRequestException('Nincs ár beállítva ehhez a járműtípushoz és szolgáltatáshoz');
      }

      serviceItems.push({
        servicePackageId: body.servicePackageId!,
        vehicleType: body.tractorVehicleType,
        vehicleRole: 'TRACTOR',
        plateNumber: body.tractorPlate,
        quantity: 1,
        unitPrice: Number(tractorPrice.price),
        totalPrice: Number(tractorPrice.price),
      });

      totalPrice += Number(tractorPrice.price);

      if (body.trailerPlate && body.trailerVehicleType) {
        const trailerPrice = await this.billingService.getPrice(
          session.networkId,
          body.servicePackageId!,
          body.trailerVehicleType as any,
          partnerCompanyId,
        );

        if (trailerPrice) {
          serviceItems.push({
            servicePackageId: body.servicePackageId!,
            vehicleType: body.trailerVehicleType,
            vehicleRole: 'TRAILER',
            plateNumber: body.trailerPlate,
            quantity: 1,
            unitPrice: Number(trailerPrice.price),
            totalPrice: Number(trailerPrice.price),
          });

          totalPrice += Number(trailerPrice.price);
        }
      }
    }

    // WashEvent létrehozása COMPLETED státusszal (manuális rögzítés)
    const washEvent = await this.prisma.washEvent.create({
      data: {
        networkId: session.networkId,
        locationId: session.locationId,
        partnerCompanyId,
        servicePackageId: serviceItems[0]?.servicePackageId || null, // Fő szolgáltatás (kompatibilitás)
        status: 'COMPLETED',
        entryMode: 'MANUAL_OPERATOR',
        tractorPlateManual: body.tractorPlate.toUpperCase(),
        tractorPrice: new Decimal(serviceItems.filter(s => s.vehicleRole === 'TRACTOR').reduce((sum, s) => sum + s.totalPrice, 0)),
        trailerPlateManual: body.trailerPlate?.toUpperCase() || null,
        trailerPrice: new Decimal(serviceItems.filter(s => s.vehicleRole === 'TRAILER').reduce((sum, s) => sum + s.totalPrice, 0)),
        totalPrice: new Decimal(totalPrice),
        finalPrice: new Decimal(totalPrice),
        driverNameManual: body.driverName || null,
        authorizedAt: new Date(),
        startedAt: new Date(),
        completedAt: new Date(),
        paymentMethod: body.paymentMethod as any || null,
        paidAt: isAdHocCustomer ? new Date() : null,
        // Kapcsolt szolgáltatások létrehozása
        services: {
          create: serviceItems.map(item => ({
            servicePackageId: item.servicePackageId,
            vehicleType: item.vehicleType as any,
            unitPrice: new Decimal(item.unitPrice),
            quantity: item.quantity,
            totalPrice: new Decimal(item.totalPrice),
            vehicleRole: item.vehicleRole || null,
            plateNumber: item.plateNumber?.toUpperCase() || null,
          })),
        },
      },
      include: {
        partnerCompany: true,
        servicePackage: true,
        services: {
          include: {
            servicePackage: true,
          },
        },
      },
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        networkId: session.networkId,
        washEventId: washEvent.id,
        action: 'CREATE',
        actorType: 'USER',
        actorId: `operator:${session.locationCode}`,
        ipAddress: req.ip || req.socket?.remoteAddress,
        userAgent: req.get('user-agent'),
        newData: {
          status: 'COMPLETED',
          entryMode: 'MANUAL_OPERATOR',
          isAdHoc: isAdHocCustomer,
          servicesCount: serviceItems.length,
        },
      },
    });

    // Ha AD_HOC ügyfél, azonnal számlát generálunk
    let invoiceResult: { invoiceNumber?: string; pdfUrl?: string } | null = null;
    if (isAdHocCustomer) {
      try {
        const invoice = await this.billingService.createCashInvoice(
          session.networkId,
          washEvent.id,
          body.paymentMethod || 'CASH',
        );

        // Számla kiállítása szamlazz.hu-n
        const issueResult = await this.billingService.issueInvoice(invoice.id, 'szamlazz');
        if (issueResult.success) {
          invoiceResult = {
            invoiceNumber: issueResult.invoiceNumber,
            pdfUrl: issueResult.pdfUrl,
          };
        }
      } catch (err: any) {
        // Loggoljuk a hibát, de ne dobjunk kivételt - a mosás már rögzítve van
        console.error('Számla generálási hiba:', err.message);
      }
    }

    return {
      success: true,
      washEvent,
      invoice: invoiceResult,
      totalPrice,
      servicesCount: serviceItems.length,
    };
  }

  // ==================== Rendszám alapú keresés ====================

  @Get('lookup-plate/:plate')
  async lookupPlate(
    @Param('plate') plate: string,
    @Headers('x-operator-session') sessionId: string,
  ) {
    const session = await this.getSession(sessionId);

    if (!plate || plate.length < 3) {
      return { found: false };
    }

    const normalizedPlate = plate.toUpperCase().replace(/[^A-Z0-9]/g, '');

    // Keresünk korábbi mosásokat ezzel a rendszámmal
    const recentWashes = await this.prisma.washEvent.findMany({
      where: {
        networkId: session.networkId,
        OR: [
          { tractorPlateManual: { contains: normalizedPlate } },
          { trailerPlateManual: { contains: normalizedPlate } },
        ],
        status: 'COMPLETED',
      },
      include: {
        partnerCompany: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        // Új multi-service rendszer
        services: {
          include: {
            servicePackage: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
        // Régi single-service mező (backward compatibility)
        servicePackage: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    if (recentWashes.length === 0) {
      return { found: false };
    }

    // Legutóbbi mosás adatai
    const lastWash = recentWashes[0];

    // Leggyakoribb partner (legtöbb mosás)
    const partnerCounts = new Map<string, { count: number; partner: any }>();
    for (const wash of recentWashes) {
      if (wash.partnerCompany) {
        const key = wash.partnerCompany.id;
        const current = partnerCounts.get(key) || { count: 0, partner: wash.partnerCompany };
        current.count++;
        partnerCounts.set(key, current);
      }
    }
    const mostFrequentPartner = Array.from(partnerCounts.values())
      .sort((a, b) => b.count - a.count)[0]?.partner || null;

    // Leggyakoribb szolgáltatások (új multi-service + régi single-service)
    const serviceCounts = new Map<string, { count: number; service: any }>();
    for (const wash of recentWashes) {
      // Új multi-service rendszer
      for (const svc of wash.services) {
        if (svc.servicePackage) {
          const key = svc.servicePackage.id;
          const current = serviceCounts.get(key) || { count: 0, service: svc.servicePackage };
          current.count++;
          serviceCounts.set(key, current);
        }
      }
      // Régi single-service mező (backward compatibility)
      if (wash.servicePackage && wash.services.length === 0) {
        const key = wash.servicePackage.id;
        const current = serviceCounts.get(key) || { count: 0, service: wash.servicePackage };
        current.count++;
        serviceCounts.set(key, current);
      }
    }
    const frequentServices = Array.from(serviceCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(s => s.service);

    // Járműtípus meghatározása (az első szolgáltatásból)
    const vehicleType = lastWash.services[0]?.vehicleType || null;

    // Pótkocsi rendszám (ha volt)
    const trailerPlate = recentWashes.find(w => w.trailerPlateManual)?.trailerPlateManual || null;

    // Sofőr név (legutóbbi)
    const driverName = recentWashes.find(w => w.driverNameManual)?.driverNameManual || null;

    return {
      found: true,
      suggestion: {
        partner: mostFrequentPartner,
        vehicleType,
        trailerPlate,
        driverName,
        frequentServices,
        lastWashDate: lastWash.createdAt,
        totalWashes: recentWashes.length,
      },
    };
  }

  // ==================== Mosás törlési kérelem ====================

  @Post('wash-events/:id/request-delete')
  @HttpCode(HttpStatus.OK)
  async requestDeleteWashEvent(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Headers('x-operator-session') sessionId: string,
    @Req() req: Request,
  ) {
    const session = await this.getSession(sessionId);

    if (!reason || reason.trim().length < 5) {
      throw new BadRequestException('A törlés indoklása kötelező (min. 5 karakter)');
    }

    // Verify event belongs to this location
    const event = await this.prisma.washEvent.findFirst({
      where: {
        id,
        networkId: session.networkId,
        locationId: session.locationId,
      },
    });

    if (!event) {
      throw new BadRequestException('Mosás nem található');
    }

    // Check if there's already a pending delete request
    const existingRequest = await this.prisma.washDeleteRequest.findFirst({
      where: {
        washEventId: id,
        status: 'PENDING',
      },
    });

    if (existingRequest) {
      throw new BadRequestException('Már van függőben lévő törlési kérelem ehhez a mosáshoz');
    }

    // Create delete request
    const operatorIdentifier = session.operatorId
      ? `operator:${session.locationCode}:${session.operatorName}`
      : `operator:${session.locationCode}`;

    const deleteRequest = await this.prisma.washDeleteRequest.create({
      data: {
        networkId: session.networkId,
        washEventId: id,
        requestedBy: operatorIdentifier,
        reason: reason.trim(),
        status: 'PENDING',
      },
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        networkId: session.networkId,
        washEventId: id,
        action: 'UPDATE',
        actorType: 'USER',
        actorId: operatorIdentifier,
        ipAddress: req.ip || req.socket?.remoteAddress,
        userAgent: req.get('user-agent'),
        newData: {
          deleteRequest: {
            id: deleteRequest.id,
            reason: reason.trim(),
            status: 'PENDING',
          },
        },
      },
    });

    // TODO: Send notification to Network Admin (email/push)

    return {
      success: true,
      message: 'Törlési kérelem elküldve. A hálózat adminisztrátora értesítést kapott.',
      deleteRequest: {
        id: deleteRequest.id,
        status: deleteRequest.status,
        createdAt: deleteRequest.createdAt,
      },
    };
  }

  @Get('wash-events/:id/delete-requests')
  async getDeleteRequests(
    @Param('id') id: string,
    @Headers('x-operator-session') sessionId: string,
  ) {
    const session = await this.getSession(sessionId);

    const requests = await this.prisma.washDeleteRequest.findMany({
      where: {
        washEventId: id,
        networkId: session.networkId,
      },
      orderBy: { createdAt: 'desc' },
    });

    return { data: requests };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Headers('x-operator-session') headerSessionId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Get session ID from cookie or header
    const sessionId = getSessionId(req, SESSION_COOKIES.OPERATOR, 'x-operator-session') || headerSessionId;

    if (sessionId) {
      await this.sessionService.deleteSession(sessionId);
    }

    // SECURITY: Clear the httpOnly cookie
    clearSessionCookie(res, SESSION_COOKIES.OPERATOR);

    return { success: true };
  }

  // ==================== Foglalások (Bookings) ====================

  @Get('bookings/today')
  async getTodaysBookings(
    @Headers('x-operator-session') sessionId: string,
    @Req() req: Request,
  ) {
    const session = await this.getSession(sessionId, req);
    return this.bookingService.getTodaysBookings(session.networkId, session.locationId);
  }

  @Get('bookings')
  async getBookings(
    @Headers('x-operator-session') sessionId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('status') status?: string,
    @Req() req?: Request,
  ) {
    const session = await this.getSession(sessionId, req);

    return this.bookingService.listBookings(session.networkId, {
      locationId: session.locationId,
      dateFrom,
      dateTo,
      status: status as any,
      limit: 50,
    });
  }

  @Get('bookings/:id')
  async getBookingDetails(
    @Param('id') id: string,
    @Headers('x-operator-session') sessionId: string,
    @Req() req: Request,
  ) {
    const session = await this.getSession(sessionId, req);
    const booking = await this.bookingService.getBooking(session.networkId, id);

    // Verify the booking belongs to this location
    if (booking.locationId !== session.locationId) {
      throw new BadRequestException('Ez a foglalás nem ehhez a helyszínhez tartozik');
    }

    return booking;
  }

  @Post('bookings/:id/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmBooking(
    @Param('id') id: string,
    @Headers('x-operator-session') sessionId: string,
    @Req() req: Request,
  ) {
    const session = await this.getSession(sessionId, req);

    // Verify the booking belongs to this location
    const booking = await this.bookingService.getBooking(session.networkId, id);
    if (booking.locationId !== session.locationId) {
      throw new BadRequestException('Ez a foglalás nem ehhez a helyszínhez tartozik');
    }

    return this.bookingService.confirmBooking(session.networkId, id);
  }

  @Post('bookings/:id/start')
  @HttpCode(HttpStatus.OK)
  async startBooking(
    @Param('id') id: string,
    @Headers('x-operator-session') sessionId: string,
    @Req() req: Request,
  ) {
    const session = await this.getSession(sessionId, req);

    // Verify the booking belongs to this location
    const booking = await this.bookingService.getBooking(session.networkId, id);
    if (booking.locationId !== session.locationId) {
      throw new BadRequestException('Ez a foglalás nem ehhez a helyszínhez tartozik');
    }

    return this.bookingService.startBooking(session.networkId, id);
  }

  @Post('bookings/:id/complete')
  @HttpCode(HttpStatus.OK)
  async completeBooking(
    @Param('id') id: string,
    @Body() body: { washEventId?: string },
    @Headers('x-operator-session') sessionId: string,
    @Req() req: Request,
  ) {
    const session = await this.getSession(sessionId, req);

    // Verify the booking belongs to this location
    const booking = await this.bookingService.getBooking(session.networkId, id);
    if (booking.locationId !== session.locationId) {
      throw new BadRequestException('Ez a foglalás nem ehhez a helyszínhez tartozik');
    }

    return this.bookingService.completeBooking(session.networkId, id, body.washEventId);
  }

  @Post('bookings/:id/no-show')
  @HttpCode(HttpStatus.OK)
  async markNoShow(
    @Param('id') id: string,
    @Headers('x-operator-session') sessionId: string,
    @Req() req: Request,
  ) {
    const session = await this.getSession(sessionId, req);

    // Verify the booking belongs to this location
    const booking = await this.bookingService.getBooking(session.networkId, id);
    if (booking.locationId !== session.locationId) {
      throw new BadRequestException('Ez a foglalás nem ehhez a helyszínhez tartozik');
    }

    return this.bookingService.markNoShow(session.networkId, id);
  }

  @Post('bookings/:id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelBooking(
    @Param('id') id: string,
    @Body() body: { reason: string },
    @Headers('x-operator-session') sessionId: string,
    @Req() req: Request,
  ) {
    const session = await this.getSession(sessionId, req);

    // Verify the booking belongs to this location
    const booking = await this.bookingService.getBooking(session.networkId, id);
    if (booking.locationId !== session.locationId) {
      throw new BadRequestException('Ez a foglalás nem ehhez a helyszínhez tartozik');
    }

    const operatorIdentifier = session.operatorId
      ? `operator:${session.locationCode}:${session.operatorName}`
      : `operator:${session.locationCode}`;

    return this.bookingService.cancelBooking(
      session.networkId,
      id,
      { reason: body.reason },
      operatorIdentifier,
    );
  }

  // ==================== Blokkolt időszakok (Walk-in fenntartás) ====================

  @Get('blocked-slots')
  async getBlockedSlots(
    @Headers('x-operator-session') sessionId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Req() req?: Request,
  ) {
    const session = await this.getSession(sessionId, req);
    return this.bookingService.listBlockedTimeSlots(
      session.networkId,
      session.locationId,
    );
  }

  @Post('blocked-slots')
  @HttpCode(HttpStatus.CREATED)
  async createBlockedSlot(
    @Headers('x-operator-session') sessionId: string,
    @Body() body: { startTime: string; endTime: string; reason?: string },
    @Req() req: Request,
  ) {
    const session = await this.getSession(sessionId, req);

    const operatorIdentifier = session.operatorId
      ? `operator:${session.locationCode}:${session.operatorName}`
      : `operator:${session.locationCode}`;

    return this.bookingService.createBlockedTimeSlot(session.networkId, {
      locationId: session.locationId,
      startTime: body.startTime,
      endTime: body.endTime,
      reason: body.reason || 'Walk-in ügyfeleknek fenntartva',
    }, operatorIdentifier);
  }

  @Post('blocked-slots/recurring')
  @HttpCode(HttpStatus.CREATED)
  async createRecurringBlockedSlot(
    @Headers('x-operator-session') sessionId: string,
    @Body() body: {
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      reason?: string;
    },
    @Req() req: Request,
  ) {
    const session = await this.getSession(sessionId, req);

    const operatorIdentifier = session.operatorId
      ? `operator:${session.locationCode}:${session.operatorName}`
      : `operator:${session.locationCode}`;

    const dayOfWeekMap = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

    return this.bookingService.createRecurringBlock(session.networkId, {
      locationId: session.locationId,
      dayOfWeek: dayOfWeekMap[body.dayOfWeek] as any,
      startTime: body.startTime,
      endTime: body.endTime,
      reason: body.reason || 'Walk-in ügyfeleknek fenntartva (ismétlődő)',
    }, operatorIdentifier);
  }

  @Delete('blocked-slots/:id')
  @HttpCode(HttpStatus.OK)
  async deleteBlockedSlot(
    @Param('id') id: string,
    @Headers('x-operator-session') sessionId: string,
    @Req() req: Request,
  ) {
    const session = await this.getSession(sessionId, req);
    return this.bookingService.deleteBlockedTimeSlot(session.networkId, id);
  }

  // ==================== Új foglalás létrehozása (ügyfél nevében) ====================

  @Get('available-slots')
  async getAvailableSlots(
    @Headers('x-operator-session') sessionId: string,
    @Query('date') date: string,
    @Query('vehicleType') vehicleType: string,
    @Req() req?: Request,
  ) {
    const session = await this.getSession(sessionId, req);
    return this.bookingService.getAvailableSlots(session.networkId, {
      locationId: session.locationId,
      date,
      vehicleType: vehicleType as any,
    });
  }

  @Post('bookings/create')
  @HttpCode(HttpStatus.CREATED)
  async createBookingForCustomer(
    @Headers('x-operator-session') sessionId: string,
    @Body() body: {
      // Ügyfél adatok
      customerName?: string;
      customerPhone?: string;
      customerEmail?: string;
      // Foglalás adatok
      servicePackageId: string;
      scheduledStart: string;
      vehicleType: string;
      plateNumber?: string;
      notes?: string;
    },
    @Req() req: Request,
  ) {
    const session = await this.getSession(sessionId, req);

    const operatorIdentifier = session.operatorId
      ? `operator:${session.locationCode}:${session.operatorName}`
      : `operator:${session.locationCode}`;

    return this.bookingService.createBooking(
      session.networkId,
      {
        locationId: session.locationId,
        servicePackageId: body.servicePackageId,
        scheduledStart: body.scheduledStart,
        vehicleType: body.vehicleType as any,
        plateNumber: body.plateNumber,
        customerName: body.customerName,
        customerPhone: body.customerPhone,
        customerEmail: body.customerEmail,
        notes: body.notes,
      },
      { type: 'OPERATOR', id: operatorIdentifier },
    );
  }

  @Get('customers/search')
  async searchCustomers(
    @Headers('x-operator-session') sessionId: string,
    @Query('q') query: string,
    @Req() req?: Request,
  ) {
    const session = await this.getSession(sessionId, req);

    if (!query || query.length < 2) {
      return { data: [] };
    }

    // Keresés sofőrök között
    const drivers = await this.prisma.driver.findMany({
      where: {
        networkId: session.networkId,
        deletedAt: null,
        OR: [
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 10,
      orderBy: { createdAt: 'desc' },
    });

    // Keresés korábbi foglalások alapján (customerEmail/customerPhone)
    const previousBookings = await this.prisma.booking.findMany({
      where: {
        networkId: session.networkId,
        driverId: null, // Csak walk-in foglalások
        OR: [
          { customerName: { contains: query, mode: 'insensitive' } },
          { customerPhone: { contains: query } },
          { customerEmail: { contains: query, mode: 'insensitive' } },
        ],
      },
      distinct: ['customerEmail'],
      take: 10,
      orderBy: { createdAt: 'desc' },
    });

    return {
      data: [
        ...drivers.map((d) => ({
          id: d.id,
          type: 'driver' as const,
          name: `${d.firstName} ${d.lastName}`,
          phone: d.phone,
          email: d.email,
        })),
        ...previousBookings
          .filter((b) => b.customerName)
          .map((b) => ({
            id: `prev-${b.id}`,
            type: 'previous' as const,
            name: b.customerName!,
            phone: b.customerPhone,
            email: b.customerEmail,
          })),
      ],
    };
  }
}
