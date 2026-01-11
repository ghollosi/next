import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Enable raw body for Stripe webhook signature verification
    rawBody: true,
    // Disable verbose logging in production
    logger: process.env.NODE_ENV === 'production'
      ? ['error', 'warn']
      : ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  // SECURITY: Cookie parser for httpOnly session cookies
  app.use(cookieParser());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // CORS configuration - SECURITY: No wildcard in production
  const corsOrigin = process.env.CORS_ORIGIN;
  if (!corsOrigin && process.env.NODE_ENV === 'production') {
    console.warn('WARNING: CORS_ORIGIN not set in production! Using restrictive default.');
  }
  app.enableCors({
    origin: corsOrigin
      ? corsOrigin.split(',').map(o => o.trim())
      : (process.env.NODE_ENV === 'production' ? false : '*'),
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Swagger API documentation - SECURITY: Disable in production
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('VSys Next API')
      .setDescription('VSys Next - Multi-tenant Wash Registration & Ledger System')
      .setVersion('0.2.0')
      .addTag('health', 'Health check endpoints')
      .addTag('pwa', 'PWA Driver endpoints')
      .addTag('operator', 'Operator endpoints')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
    console.log(`Swagger docs available at: http://localhost:${process.env.PORT || 3000}/api/docs`);
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`VSys Next API is running on: http://localhost:${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
}

bootstrap();
