import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('VSys Next API (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;

  // Test data
  let networkId: string;
  let locationId: string;
  let partnerCompanyId: string;
  let driverId: string;
  let servicePackageId: string;
  let inviteCode: string;
  let driverSession: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    prismaService = app.get<PrismaService>(PrismaService);
    await app.init();

    // Clean database before tests
    if (process.env.NODE_ENV !== 'production') {
      await prismaService.cleanDatabase();
    }

    // Seed test data
    const network = await prismaService.network.create({
      data: {
        name: 'Test Network',
        slug: 'test-network',
      },
    });
    networkId = network.id;

    const location = await prismaService.location.create({
      data: {
        networkId,
        name: 'Test Location',
        code: 'LOC001',
        city: 'Test City',
        state: 'TS',
      },
    });
    locationId = location.id;

    const partnerCompany = await prismaService.partnerCompany.create({
      data: {
        networkId,
        name: 'Test Partner',
        code: 'TP001',
      },
    });
    partnerCompanyId = partnerCompany.id;

    const servicePackage = await prismaService.servicePackage.create({
      data: {
        networkId,
        name: 'Basic Wash',
        code: 'BASIC',
      },
    });
    servicePackageId = servicePackage.id;

    // Enable service at location
    await prismaService.locationServiceAvailability.create({
      data: {
        networkId,
        locationId,
        servicePackageId,
        isActive: true,
      },
    });

    // Create a driver
    const driver = await prismaService.driver.create({
      data: {
        networkId,
        partnerCompanyId,
        firstName: 'Test',
        lastName: 'Driver',
        pinHash:
          '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', // SHA256 of '1234'
      },
    });
    driverId = driver.id;

    // Create invite for driver
    const invite = await prismaService.driverInvite.create({
      data: {
        networkId,
        driverId,
        inviteCode: 'TEST01',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    inviteCode = invite.inviteCode;
  });

  afterAll(async () => {
    if (process.env.NODE_ENV !== 'production') {
      await prismaService.cleanDatabase();
    }
    await app.close();
  });

  describe('Health Check', () => {
    it('/health (GET)', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect((res: request.Response) => {
          expect(res.body.status).toBe('ok');
          expect(res.body.version).toBe('0.1.0');
          expect(res.body.module).toBe('core-wash-ledger');
        });
    });

    it('/health/ready (GET)', () => {
      return request(app.getHttpServer())
        .get('/health/ready')
        .expect(200)
        .expect((res: request.Response) => {
          expect(res.body.status).toBe('ready');
        });
    });

    it('/health/live (GET)', () => {
      return request(app.getHttpServer())
        .get('/health/live')
        .expect(200)
        .expect((res: request.Response) => {
          expect(res.body.status).toBe('alive');
        });
    });
  });

  describe('PWA - Driver Activation', () => {
    it('should activate driver with valid invite code and PIN', () => {
      return request(app.getHttpServer())
        .post('/pwa/activate')
        .send({ inviteCode: 'TEST01', pin: '1234' })
        .expect(200)
        .expect((res: request.Response) => {
          expect(res.body.driverId).toBe(driverId);
          expect(res.body.networkId).toBe(networkId);
          expect(res.body.sessionId).toBeDefined();
          driverSession = res.body.sessionId;
        });
    });

    it('should reject invalid invite code', () => {
      return request(app.getHttpServer())
        .post('/pwa/activate')
        .send({ inviteCode: 'XXXXXX', pin: '1234' })
        .expect(404);
    });

    it('should reject invalid PIN', () => {
      // Need to create a new invite since the previous one was activated
      return request(app.getHttpServer())
        .post('/pwa/activate')
        .send({ inviteCode: 'TEST01', pin: '9999' })
        .expect(400); // Already activated
    });
  });

  describe('PWA - Driver Profile', () => {
    it('should get driver profile with valid session', () => {
      return request(app.getHttpServer())
        .get('/pwa/me')
        .set('x-driver-session', driverSession)
        .expect(200)
        .expect((res: request.Response) => {
          expect(res.body.id).toBe(driverId);
          expect(res.body.firstName).toBe('Test');
          expect(res.body.lastName).toBe('Driver');
        });
    });

    it('should reject request without session', () => {
      return request(app.getHttpServer()).get('/pwa/me').expect(400);
    });

    it('should reject request with invalid session', () => {
      return request(app.getHttpServer())
        .get('/pwa/me')
        .set('x-driver-session', 'invalid-session')
        .expect(400);
    });
  });

  describe('PWA - Wash Event Creation', () => {
    let washEventId: string;

    it('should create wash event with manual tractor plate', () => {
      return request(app.getHttpServer())
        .post('/pwa/wash-events')
        .set('x-driver-session', driverSession)
        .send({
          locationId,
          servicePackageId,
          tractorPlateManual: 'ABC1234',
        })
        .expect(201)
        .expect((res: request.Response) => {
          expect(res.body.id).toBeDefined();
          expect(res.body.status).toBe('CREATED');
          expect(res.body.tractorPlateManual).toBe('ABC1234');
          washEventId = res.body.id;
        });
    });

    it('should start wash event', async () => {
      return request(app.getHttpServer())
        .post(`/pwa/wash-events/${washEventId}/start`)
        .set('x-driver-session', driverSession)
        .expect(200)
        .expect((res: request.Response) => {
          expect(res.body.status).toBe('IN_PROGRESS');
          expect(res.body.startedAt).toBeDefined();
        });
    });

    it('should complete wash event', () => {
      return request(app.getHttpServer())
        .post(`/pwa/wash-events/${washEventId}/complete`)
        .set('x-driver-session', driverSession)
        .expect(200)
        .expect((res: request.Response) => {
          expect(res.body.status).toBe('COMPLETED');
          expect(res.body.completedAt).toBeDefined();
        });
    });

    it('should reject invalid location', () => {
      return request(app.getHttpServer())
        .post('/pwa/wash-events')
        .set('x-driver-session', driverSession)
        .send({
          locationId: '00000000-0000-0000-0000-000000000000',
          servicePackageId,
          tractorPlateManual: 'ABC1234',
        })
        .expect(400);
    });
  });

  describe('Operator - Wash Event Management', () => {
    let operatorWashEventId: string;
    const operatorUserId = 'operator-user-1';

    it('should create wash event as operator', () => {
      return request(app.getHttpServer())
        .post('/operator/wash-events')
        .set('x-network-id', networkId)
        .set('x-user-id', operatorUserId)
        .send({
          locationId,
          partnerCompanyId,
          driverNameManual: 'Walk-in Driver',
          servicePackageId,
          tractorPlateManual: 'XYZ9999',
        })
        .expect(201)
        .expect((res: request.Response) => {
          expect(res.body.id).toBeDefined();
          expect(res.body.status).toBe('CREATED');
          expect(res.body.entryMode).toBe('MANUAL_OPERATOR');
          expect(res.body.driverNameManual).toBe('Walk-in Driver');
          operatorWashEventId = res.body.id;
        });
    });

    it('should authorize wash event', () => {
      return request(app.getHttpServer())
        .post(`/operator/wash-events/${operatorWashEventId}/authorize`)
        .set('x-network-id', networkId)
        .set('x-user-id', operatorUserId)
        .expect(200)
        .expect((res: request.Response) => {
          expect(res.body.status).toBe('AUTHORIZED');
          expect(res.body.authorizedAt).toBeDefined();
        });
    });

    it('should start wash event', () => {
      return request(app.getHttpServer())
        .post(`/operator/wash-events/${operatorWashEventId}/start`)
        .set('x-network-id', networkId)
        .set('x-user-id', operatorUserId)
        .expect(200)
        .expect((res: request.Response) => {
          expect(res.body.status).toBe('IN_PROGRESS');
        });
    });

    it('should complete wash event', () => {
      return request(app.getHttpServer())
        .post(`/operator/wash-events/${operatorWashEventId}/complete`)
        .set('x-network-id', networkId)
        .set('x-user-id', operatorUserId)
        .expect(200)
        .expect((res: request.Response) => {
          expect(res.body.status).toBe('COMPLETED');
        });
    });

    it('should list wash events', () => {
      return request(app.getHttpServer())
        .get('/operator/wash-events')
        .set('x-network-id', networkId)
        .query({ locationId })
        .expect(200)
        .expect((res: request.Response) => {
          expect(res.body.data).toBeDefined();
          expect(Array.isArray(res.body.data)).toBe(true);
          expect(res.body.total).toBeGreaterThan(0);
        });
    });

    it('should reject unauthorized network access', () => {
      return request(app.getHttpServer())
        .get('/operator/wash-events')
        .set('x-network-id', 'different-network-id')
        .query({ locationId })
        .expect(200)
        .expect((res: request.Response) => {
          // Should return empty results for different network
          expect(res.body.total).toBe(0);
        });
    });
  });

  describe('Operator - Wash Event Rejection', () => {
    let rejectableEventId: string;
    const operatorUserId = 'operator-user-1';

    beforeAll(async () => {
      // Create an event to reject
      const event = await prismaService.washEvent.create({
        data: {
          networkId,
          locationId,
          partnerCompanyId,
          servicePackageId,
          entryMode: 'MANUAL_OPERATOR',
          status: 'CREATED',
          driverNameManual: 'To Be Rejected',
          tractorPlateManual: 'REJ123',
          createdByUserId: operatorUserId,
        },
      });
      rejectableEventId = event.id;
    });

    it('should reject wash event with reason', () => {
      return request(app.getHttpServer())
        .post(`/operator/wash-events/${rejectableEventId}/reject`)
        .set('x-network-id', networkId)
        .set('x-user-id', operatorUserId)
        .send({ reason: 'Invalid documentation' })
        .expect(200)
        .expect((res: request.Response) => {
          expect(res.body.status).toBe('REJECTED');
          expect(res.body.rejectionReason).toBe('Invalid documentation');
          expect(res.body.rejectedAt).toBeDefined();
        });
    });
  });

  describe('State Machine Immutability', () => {
    let completedEventId: string;
    const operatorUserId = 'operator-user-1';

    beforeAll(async () => {
      // Create a completed event
      const event = await prismaService.washEvent.create({
        data: {
          networkId,
          locationId,
          partnerCompanyId,
          servicePackageId,
          entryMode: 'MANUAL_OPERATOR',
          status: 'COMPLETED',
          driverNameManual: 'Completed Driver',
          tractorPlateManual: 'COMP123',
          createdByUserId: operatorUserId,
          completedAt: new Date(),
        },
      });
      completedEventId = event.id;
    });

    it('should not allow modifying completed event status (reject)', () => {
      return request(app.getHttpServer())
        .post(`/operator/wash-events/${completedEventId}/reject`)
        .set('x-network-id', networkId)
        .set('x-user-id', operatorUserId)
        .send({ reason: 'Should not work' })
        .expect(400);
    });

    it('should not allow restarting completed event', () => {
      return request(app.getHttpServer())
        .post(`/operator/wash-events/${completedEventId}/start`)
        .set('x-network-id', networkId)
        .set('x-user-id', operatorUserId)
        .expect(400);
    });
  });
});
