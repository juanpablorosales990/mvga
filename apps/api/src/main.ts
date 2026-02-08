import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import * as express from 'express';
import * as Sentry from '@sentry/node';
import { PublicKey } from '@solana/web3.js';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';

// Initialize Sentry if DSN is configured
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.2,
  });
}

function validateEnv(logger: Logger) {
  const isProd = process.env.NODE_ENV === 'production';

  // JWT secret validation
  const jwtSecret = process.env.JWT_SECRET || '';
  if (isProd && jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production');
  }

  // Required env vars
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
  }
  if (isProd && !process.env.SOLANA_RPC_URL) {
    throw new Error('SOLANA_RPC_URL environment variable is required in production');
  }

  // Validate Solana addresses if set
  const addressVars = ['TREASURY_WALLET', 'HUMANITARIAN_FUND_WALLET', 'STAKING_VAULT_WALLET'];
  for (const varName of addressVars) {
    const value = process.env[varName];
    if (value) {
      try {
        new PublicKey(value);
      } catch {
        throw new Error(`${varName} is not a valid Solana address: ${value}`);
      }
    }
  }

  // In production, warn about missing critical wallet keypairs
  if (isProd) {
    const requiredKeypairs = ['ESCROW_WALLET_KEYPAIR', 'STAKING_VAULT_KEYPAIR', 'TREASURY_KEYPAIR'];
    for (const varName of requiredKeypairs) {
      if (!process.env[varName]) {
        logger.warn(`${varName} not set — related operations will be unavailable`);
      }
    }
  }

  logger.log('Environment validation passed');
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  validateEnv(logger);

  const app = await NestFactory.create(AppModule);

  // Graceful shutdown hooks
  app.enableShutdownHooks();

  // Cookie parser (httpOnly auth cookies)
  app.use(cookieParser());

  // Request body size limit
  app.use(express.json({ limit: '10kb' }));

  // Security headers (CSP off in dev for Swagger)
  app.use(
    helmet({
      contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
    })
  );

  // Sentry is initialized at module level (above) and auto-instruments

  // Global exception filter (hides stack traces)
  app.useGlobalFilters(new HttpExceptionFilter());

  // Trust Railway's reverse proxy for rate limiting
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', 1);

  // Enable CORS — production origins only; localhost allowed in dev
  const corsOrigins: string[] = ['https://mvga.io', 'https://www.mvga.io', 'https://app.mvga.io'];
  if (process.env.NODE_ENV !== 'production') {
    corsOrigins.push('http://localhost:3000', 'http://localhost:3001');
  }
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400, // Cache preflight for 24h
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  // API prefix
  app.setGlobalPrefix('api');

  // Swagger documentation (disabled in production)
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('MVGA API')
      .setDescription('API for MVGA Wallet and Platform')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
    logger.log('Swagger docs enabled at /docs');
  }

  const port = process.env.PORT || 4000;
  await app.listen(port);
  logger.log(`MVGA API running on port ${port}`);
}
bootstrap();
