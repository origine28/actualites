import cors from 'cors';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { env, IS_PRODUCTION } from './config/env.ts';
import { createAdminController } from './controllers/admin.controller.ts';
import { createAuthController } from './controllers/auth.controller.ts';
import { createContentController } from './controllers/content.controller.ts';
import { createMediaController } from './controllers/media.controller.ts';
import { createDownloadController } from './controllers/download.controller.ts';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.ts';
import { clientInfoMiddleware } from './middleware/clientInfo.ts';
import { createLoginRateLimiter } from './middleware/rateLimit.ts';
import { createContactRateLimiter } from './middleware/rateLimit.ts';
import { createGlobalRateLimiter } from './middleware/rateLimit.ts';
import { createAdminRouter } from './routes/admin.routes.ts';
import { createAuthRouter } from './routes/auth.routes.ts';
import { createContentRouter } from './routes/content.routes.ts';
import { createMediaAdminRouter, createMediaPublicRouter } from './routes/media.routes.ts';
import { createDownloadAdminRouter, createDownloadPublicRouter } from './routes/download.routes.ts';
import { createContactAdminRouter, createContactPublicRouter } from './routes/contact.routes.ts';
import { healthRouter } from './routes/health.routes.ts';
import { testRouter } from './routes/test.routes.ts';
import { adminService } from './services/admin.service.ts';
import { articleService } from './services/article.service.ts';
import { createAuthService } from './services/auth.service.ts';
import { categoryService } from './services/category.service.ts';
import { imageService } from './services/image.service.ts';
import { tagService } from './services/tag.service.ts';
import { videoService } from './services/video.service.ts';
import { downloadService } from './services/download.service.ts';
import { contactService } from './services/contact.service.ts';
import { createContactController } from './controllers/contact.controller.ts';

export interface AppOptions {
  /** null = désactive le rate limiting login (tests). */
  loginRateLimit?: { windowMs: number; max: number } | null;
  contactRateLimit?: { windowMs: number; max: number } | null;
  globalRateLimit?: { windowMs: number; max: number } | null;
  lockout?: { maxAttempts: number; lockoutMinutes: number } | null;
  sessionTtlHours?: number;
  cookieSecure?: boolean;
  /** Monte la route technique /api/test (tests middleware role). */
  exposeTestRoutes?: boolean;
}

export function createApp(options: AppOptions = {}): express.Express {
  const app = express();

  const sessionTtlHours = options.sessionTtlHours ?? env.SESSION_TTL_HOURS;
  const sessionTtlMs = sessionTtlHours * 3600 * 1000;
  const lockoutCfg = options.lockout ?? {
    maxAttempts: env.LOGIN_MAX_ATTEMPTS,
    lockoutMinutes: env.LOGIN_LOCKOUT_MINUTES,
  };
  const cookieSecure = options.cookieSecure ?? (env.COOKIE_SECURE ?? IS_PRODUCTION);

  // Chaîne de confiance : seule une connexion locale (cloudflared local) est
  // autorisée à fournir des en-têtes de proxy (X-Forwarded-For).
  app.set('trust proxy', 'loopback');
  app.set('sessionTtlMs', sessionTtlMs);
  app.disable('x-powered-by');

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        mediaSrc: ["'self'"],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        frameSrc: ['https://www.youtube.com', 'https://player.vimeo.com'],
        frameAncestors: ["'self'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        objectSrc: ["'none'"],
      },
    },
  }));
  // 10mb : un article peut contenir jusqu'à 1 Mo de contenu (JSON + échappements).
  app.use(express.json({ limit: '10mb' }));
  app.use(cookieParser());
  app.use(clientInfoMiddleware);

  // CORS : origin configuré via CORS_ORIGIN (same-origin par défaut = pas de CORS nécessaire).
  if (env.CORS_ORIGIN) {
    app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  }

  const authService = createAuthService({
    lockoutMaxAttempts: lockoutCfg.maxAttempts,
    lockoutMinutes: lockoutCfg.lockoutMinutes,
    sessionTtlMs,
  });
  const loginRateLimiter =
    options.loginRateLimit === null
      ? createLoginRateLimiter(60 * 1000, Number.MAX_SAFE_INTEGER)
      : createLoginRateLimiter(
          options.loginRateLimit?.windowMs ?? env.LOGIN_RATE_LIMIT_WINDOW_MS,
          options.loginRateLimit?.max ?? env.LOGIN_RATE_LIMIT_MAX,
        );
  const controller = createAuthController({ authService, sessionTtlMs, cookieSecure });
  const adminController = createAdminController({ adminService });
  const contentController = createContentController({ articleService, categoryService, tagService });
  const mediaController = createMediaController({ imageService, videoService });
  const downloadController = createDownloadController({ downloadService });
  const contactController = createContactController({ contactService });

  const contactRateLimiter =
    options.loginRateLimit === null || options.contactRateLimit === null
      ? undefined
      : createContactRateLimiter(
          options.contactRateLimit?.windowMs ?? 15 * 60 * 1000,
          options.contactRateLimit?.max ?? 5,
        );

  // Rate limiting global sur /api/* (anti-DDoS basique).
  const globalRateLimiter =
    options.globalRateLimit === null
      ? undefined
      : createGlobalRateLimiter(
          options.globalRateLimit?.windowMs ?? 15 * 60 * 1000,
          options.globalRateLimit?.max ?? 200,
        );
  if (globalRateLimiter) {
    app.use('/api', globalRateLimiter);
  }

  app.use('/api/health', healthRouter);
  app.use('/api/auth', createAuthRouter({ controller, loginRateLimiter }));
  app.use('/api/admin', createAdminRouter({ controller: adminController }));
  app.use('/api/admin', createMediaAdminRouter({ controller: mediaController }));
  app.use('/api/admin', createDownloadAdminRouter({ controller: downloadController }));
  app.use('/api/admin', createContactAdminRouter({ controller: contactController, contactRateLimiter }));
  app.use('/api', createContentRouter({ controller: contentController }));
  app.use('/api', createMediaPublicRouter({ controller: mediaController }));
  app.use('/api', createDownloadPublicRouter({ controller: downloadController }));
  app.use('/api', createContactPublicRouter({ controller: contactController, contactRateLimiter }));

  if (options.exposeTestRoutes) {
    app.use('/api/test', testRouter);
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
