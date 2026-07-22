import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import fs from 'fs';
import { createRequire } from 'module';
import path from 'path';
import { SuiCliExecutor } from './cli/SuiCliExecutor';
import { addressRoutes } from './routes/address';
import { coinRoutes } from './routes/coin';
import { devtoolsRoutes } from './routes/devtools';
import { dynamicFieldsRoutes } from './routes/dynamic-fields';
import { environmentRoutes } from './routes/environment';
import { eventsRoutes } from './routes/events';
import { faucetRoutes } from './routes/faucet';
import { filesystemRoutes } from './routes/filesystem';
import { gasRoutes } from './routes/gas';
import { inspectorRoutes } from './routes/inspector';
import { keyManagementRoutes } from './routes/key-management';
import { keytoolRoutes } from './routes/keytool';
import { localNetworkRoutes } from './routes/local-network';
import { migrationRoutes } from './routes/migration';
import { moveRoutes } from './routes/move';
import { outputsRoutes } from './routes/outputs';
import { packageRoutes } from './routes/package';
import { payRoutes } from './routes/pay';
// New routes for enhanced features
import { ptbBuilderRoutes } from './routes/ptb-builder';
import { replayRoutes } from './routes/replay';
import { securityRoutes } from './routes/security';
import { transferRoutes } from './routes/transfer';
import { walrusMemoryRoutes } from './routes/walrusMemory';
import { createRateLimitHook } from './utils/rateLimiter';

const require = createRequire(import.meta.url);
const pkg = require('../package.json');
const CURRENT_VERSION = pkg.version;
const PACKAGE_NAME = pkg.name;

const PORT = parseInt(process.env.PORT || '3001', 10);
// Automatically bind to 0.0.0.0 in Railway/Cloud platforms or when HOST is set
const isCloud = !!(
  process.env.RAILWAY_STATIC_URL ||
  process.env.RAILWAY_SERVICE_ID ||
  process.env.PORT
);
const HOST = process.env.HOST || (isCloud ? '0.0.0.0' : '127.0.0.1');

// Check for updates from npm registry
async function checkForUpdates(): Promise<{ hasUpdate: boolean; latestVersion: string | null }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const response = await fetch(`https://registry.npmjs.org/${PACKAGE_NAME}/latest`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) return { hasUpdate: false, latestVersion: null };

    const data = (await response.json()) as { version: string };
    const latestVersion = data.version;

    // Compare versions (simple semver comparison)
    const current = CURRENT_VERSION.split('.').map(Number);
    const latest = latestVersion.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      if (latest[i] > current[i]) {
        return { hasUpdate: true, latestVersion };
      }
      if (latest[i] < current[i]) {
        return { hasUpdate: false, latestVersion };
      }
    }

    return { hasUpdate: false, latestVersion };
  } catch {
    // Network error or timeout - silently ignore
    return { hasUpdate: false, latestVersion: null };
  }
}

// ANSI color codes for terminal
const colors = {
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
  bgRed: '\x1b[41m',
  bgYellow: '\x1b[43m',
};

function printUpdateWarning(latestVersion: string) {
  const c = colors;
  console.log(`
${c.bgRed}${c.white}${c.bold}                                                                 ${c.reset}
${c.bgRed}${c.white}${c.bold}   🚨🚨🚨  NEW VERSION AVAILABLE - PLEASE UPDATE  🚨🚨🚨          ${c.reset}
${c.bgRed}${c.white}${c.bold}                                                                 ${c.reset}

${c.red}${c.bold}   ╔═══════════════════════════════════════════════════════════╗${c.reset}
${c.red}${c.bold}   ║                                                           ║${c.reset}
${c.red}${c.bold}   ║   ${c.yellow}⚠️  YOUR VERSION IS OUTDATED!${c.red}                           ║${c.reset}
${c.red}${c.bold}   ║                                                           ║${c.reset}
${c.red}${c.bold}   ║   ${c.white}Current: ${c.red}${CURRENT_VERSION.padEnd(12)}${c.white} ❌ OLD${c.red}                        ║${c.reset}
${c.red}${c.bold}   ║   ${c.white}Latest:  ${c.green}${latestVersion.padEnd(12)}${c.white} ✅ NEW${c.red}                        ║${c.reset}
${c.red}${c.bold}   ║                                                           ║${c.reset}
${c.red}${c.bold}   ║   ${c.yellow}Update now to get bug fixes & new features:${c.red}             ║${c.reset}
${c.red}${c.bold}   ║                                                           ║${c.reset}
${c.red}${c.bold}   ║   ${c.cyan}npm install -g ${PACKAGE_NAME}${c.red}               ║${c.reset}
${c.red}${c.bold}   ║                                                           ║${c.reset}
${c.red}${c.bold}   ║   ${c.dim}Or always use latest with npx:${c.red}                        ║${c.reset}
${c.red}${c.bold}   ║   ${c.cyan}npx ${PACKAGE_NAME}@latest${c.red}                   ║${c.reset}
${c.red}${c.bold}   ║                                                           ║${c.reset}
${c.red}${c.bold}   ╚═══════════════════════════════════════════════════════════╝${c.reset}

${c.yellow}${c.bold}   ⚡ Continuing with outdated version... Consider updating soon!${c.reset}
  `);
}

async function main() {
  const fastify = Fastify({
    logger: {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    },
  });

  // Register CORS - allow localhost and deployed UI domains only
  // Security: Only allow specific Vercel deployments, not all *.vercel.app
  await fastify.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (like mobile apps, curl, etc.)
      if (!origin) {
        cb(null, true);
        return;
      }

      // Allowed origins from environment (comma-separated) or defaults
      const envOrigins =
        process.env.ALLOWED_ORIGINS?.split(',')
          .map((o) => o.trim())
          .filter(Boolean) || [];

      // This server also serves the built UI, so requests can legitimately come
      // from its own public domain. The bundle is loaded via <script type="module"
      // crossorigin>, which makes the browser send an Origin header even for
      // same-origin requests - so without these entries the app rejects its own
      // asset requests and fails to boot. The platform hands us the hostname
      // (no protocol), and it changes per environment, so read it rather than
      // hardcoding it.
      const selfOrigins = [process.env.RAILWAY_PUBLIC_DOMAIN, process.env.RAILWAY_STATIC_URL]
        .filter((host): host is string => Boolean(host))
        .map((host) => (host.startsWith('http') ? host : `https://${host}`));

      const allowedOrigins = [
        // Production domains (defaults)
        'https://cli.firstmovers.io',
        'https://www.harriweb3.dev',
        'https://harriweb3.dev',
        // The deployment's own domain(s)
        ...selfOrigins,
        // Additional origins from environment
        ...envOrigins,
      ];

      // Regex patterns for dynamic origins
      const allowedPatterns = [
        // Local development (allow any localhost port)
        /^http:\/\/localhost(:\d+)?$/,
        /^http:\/\/127\.0\.0\.1(:\d+)?$/,
        // Specific Vercel preview deployments (project-specific patterns only)
        /^https:\/\/raycast-sui-cli(-[a-z0-9]+)*\.vercel\.app$/,
        /^https:\/\/sui-cli-web(-[a-z0-9]+)*\.vercel\.app$/,
      ];

      // Check exact match
      if (allowedOrigins.includes(origin)) {
        cb(null, true);
        return;
      }

      // Check pattern match
      for (const pattern of allowedPatterns) {
        if (pattern.test(origin)) {
          cb(null, true);
          return;
        }
      }

      // Log rejected origin for debugging
      console.log(`[CORS] Rejected origin: ${origin}`);
      // Deny by omitting the CORS headers, rather than throwing. Throwing here
      // turns every disallowed request into a 500 Internal Server Error, which
      // both misreports the cause and floods the logs - a refused origin is not
      // a server fault. The browser still blocks the response either way.
      cb(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // Rate limiting hooks
  const readRateLimit = createRateLimitHook('read');
  const writeRateLimit = createRateLimitHook('write');
  const keytoolRateLimit = createRateLimitHook('keytool');
  const faucetRateLimit = createRateLimitHook('faucet');

  // Health check endpoint (no rate limit)
  fastify.get('/api/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString(), port: PORT };
  });

  // Sui CLI status endpoint (read rate limit)
  fastify.get('/api/status', { preHandler: readRateLimit }, async () => {
    const executor = SuiCliExecutor.getInstance();
    const installation = await executor.checkInstallation();
    return {
      suiInstalled: installation.installed,
      suiVersion: installation.version,
      timestamp: new Date().toISOString(),
    };
  });

  // Register routes with rate limiting
  // Address routes - mixed read/write
  await fastify.register(
    async (instance) => {
      // Read endpoints
      instance.addHook('onRequest', async (request, reply) => {
        if (request.method === 'GET') {
          await readRateLimit(request, reply);
        } else {
          await writeRateLimit(request, reply);
        }
      });
      await instance.register(addressRoutes);
    },
    { prefix: '/api' }
  );

  // Environment routes - write operations
  await fastify.register(
    async (instance) => {
      instance.addHook('onRequest', async (request, reply) => {
        if (request.method === 'GET') {
          await readRateLimit(request, reply);
        } else {
          await writeRateLimit(request, reply);
        }
      });
      await instance.register(environmentRoutes);
    },
    { prefix: '/api' }
  );

  // Faucet routes - strict rate limit
  await fastify.register(
    async (instance) => {
      instance.addHook('onRequest', faucetRateLimit);
      await instance.register(faucetRoutes);
    },
    { prefix: '/api' }
  );

  // Transfer routes - write operations (sensitive)
  await fastify.register(
    async (instance) => {
      instance.addHook('onRequest', writeRateLimit);
      await instance.register(transferRoutes);
    },
    { prefix: '/api' }
  );

  // Key management routes - highly sensitive operations
  await fastify.register(
    async (instance) => {
      // Use write rate limit for all key operations
      instance.addHook('onRequest', async (request, reply) => {
        // More strict rate limiting for export operations
        if (request.url.includes('/export') && request.method === 'POST') {
          // Export uses its own rate limiting in the service layer
          await writeRateLimit(request, reply);
        } else {
          await writeRateLimit(request, reply);
        }
      });
      await instance.register(keyManagementRoutes);
    },
    { prefix: '/api' }
  );

  // Keytool routes - cryptographic operations (signing, multi-sig, etc.)
  // Uses dedicated keytool rate limit (more generous for local dev)
  await fastify.register(
    async (instance) => {
      instance.addHook('onRequest', keytoolRateLimit);
      await instance.register(keytoolRoutes);
    },
    { prefix: '/api/keytool' }
  );

  // Move routes - development operations
  await fastify.register(
    async (instance) => {
      instance.addHook('onRequest', writeRateLimit);
      await instance.register(moveRoutes);
    },
    { prefix: '/api' }
  );

  // Package routes - publish/upgrade operations (sensitive)
  await fastify.register(
    async (instance) => {
      instance.addHook('onRequest', writeRateLimit);
      await instance.register(packageRoutes);
    },
    { prefix: '/api' }
  );

  // Inspector routes - read operations (inspection, replay)
  await fastify.register(
    async (instance) => {
      instance.addHook('onRequest', readRateLimit);
      await instance.register(inspectorRoutes);
    },
    { prefix: '/api' }
  );

  // Filesystem routes - directory browsing (read operations)
  await fastify.register(
    async (instance) => {
      instance.addHook('onRequest', readRateLimit);
      await instance.register(filesystemRoutes);
    },
    { prefix: '/api' }
  );

  // Dynamic fields routes - read operations (query object dynamic fields)
  await fastify.register(
    async (instance) => {
      instance.addHook('onRequest', readRateLimit);
      await instance.register(dynamicFieldsRoutes);
    },
    { prefix: '/api/dynamic-fields' }
  );

  // DevTools routes - development operations (coverage, disassemble, summary)
  await fastify.register(
    async (instance) => {
      instance.addHook('onRequest', writeRateLimit);
      await instance.register(devtoolsRoutes);
    },
    { prefix: '/api' }
  );

  // Security routes - verification operations (source, bytecode, decode)
  await fastify.register(
    async (instance) => {
      instance.addHook('onRequest', writeRateLimit);
      await instance.register(securityRoutes);
    },
    { prefix: '/api' }
  );

  // Coin routes - generic coin management (split, merge for any coin type)
  await fastify.register(
    async (instance) => {
      instance.addHook('onRequest', async (request, reply) => {
        if (request.method === 'GET') {
          await readRateLimit(request, reply);
        } else {
          await writeRateLimit(request, reply);
        }
      });
      await instance.register(coinRoutes);
    },
    { prefix: '/api' }
  );

  // Game Demo routes - Dynamic Fields showcase with RPG inventory
  await fastify.register(
    async (instance) => {
      instance.addHook('onRequest', async (request, reply) => {
        if (request.method === 'GET') {
          await readRateLimit(request, reply);
        } else {
          await writeRateLimit(request, reply);
        }
      });
    },
    { prefix: '/api' }
  );

  // ============================================
  // NEW ENHANCED FEATURE ROUTES
  // ============================================

  // PTB Builder routes - Visual PTB construction
  await fastify.register(
    async (instance) => {
      instance.addHook('onRequest', async (request, reply) => {
        if (request.method === 'GET') {
          await readRateLimit(request, reply);
        } else {
          await writeRateLimit(request, reply);
        }
      });
      await instance.register(ptbBuilderRoutes);
    },
    { prefix: '/api' }
  );

  // Replay routes - Enhanced transaction replay with traces
  await fastify.register(
    async (instance) => {
      instance.addHook('onRequest', async (request, reply) => {
        if (request.method === 'GET') {
          await readRateLimit(request, reply);
        } else {
          await writeRateLimit(request, reply);
        }
      });
      await instance.register(replayRoutes);
    },
    { prefix: '/api' }
  );

  // Gas Analysis routes - Gas breakdown and optimization
  await fastify.register(
    async (instance) => {
      instance.addHook('onRequest', async (request, reply) => {
        if (request.method === 'GET') {
          await readRateLimit(request, reply);
        } else {
          await writeRateLimit(request, reply);
        }
      });
      await instance.register(gasRoutes);
    },
    { prefix: '/api' }
  );

  // Events routes - Event parsing and querying
  await fastify.register(
    async (instance) => {
      instance.addHook('onRequest', async (request, reply) => {
        if (request.method === 'GET') {
          await readRateLimit(request, reply);
        } else {
          await writeRateLimit(request, reply);
        }
      });
      await instance.register(eventsRoutes);
    },
    { prefix: '/api' }
  );

  // Migration routes - Move 2024 migration
  await fastify.register(
    async (instance) => {
      instance.addHook('onRequest', writeRateLimit);
      await instance.register(migrationRoutes);
    },
    { prefix: '/api' }
  );

  // Local Network routes - sui start management
  await fastify.register(
    async (instance) => {
      instance.addHook('onRequest', async (request, reply) => {
        // Allow SSE endpoints without rate limiting
        if (request.url.includes('/stream/')) {
          return;
        }
        if (request.method === 'GET') {
          await readRateLimit(request, reply);
        } else {
          await writeRateLimit(request, reply);
        }
      });
      await instance.register(localNetworkRoutes);
    },
    { prefix: '/api' }
  );

  // Pay routes - Multi-recipient payments
  await fastify.register(
    async (instance) => {
      instance.addHook('onRequest', writeRateLimit);
      await instance.register(payRoutes);
    },
    { prefix: '/api' }
  );

  // Outputs routes - Large output file management
  await fastify.register(
    async (instance) => {
      instance.addHook('onRequest', async (request, reply) => {
        if (request.method === 'GET') {
          await readRateLimit(request, reply);
        } else {
          await writeRateLimit(request, reply);
        }
      });
      await instance.register(outputsRoutes);
    },
    { prefix: '/api' }
  );

  // Walrus Memory routes - reads the local keystore in-process to sign SEAL
  // session keys, so treat like the other sensitive/key-touching routes.
  await fastify.register(
    async (instance) => {
      instance.addHook('onRequest', async (request, reply) => {
        if (request.method === 'GET') {
          await readRateLimit(request, reply);
        } else {
          await writeRateLimit(request, reply);
        }
      });
      await instance.register(walrusMemoryRoutes);
    },
    { prefix: '/api' }
  );

  // Health check endpoint for Railway & cloud deployments
  fastify.get('/health', async () => {
    return {
      status: 'ok',
      version: CURRENT_VERSION,
      service: PACKAGE_NAME,
      timestamp: new Date().toISOString(),
    };
  });

  // Serve static UI & blog assets if built (for deployment on Railway)
  const candidatePaths = [
    path.resolve(process.cwd(), 'apps/web/dist'),
    path.resolve(process.cwd(), '../web/dist'),
    path.resolve(process.cwd(), '../../apps/web/dist'),
    '/app/apps/web/dist',
  ];
  const webDistPath = candidatePaths.find((p) => fs.existsSync(p));

  if (webDistPath) {
    console.log(`[Static] Serving UI & Blog static files from: ${webDistPath}`);
    await fastify.register(fastifyStatic, {
      root: webDistPath,
      prefix: '/',
      wildcard: false,
    });

    fastify.setNotFoundHandler((request, reply) => {
      if (request.raw.url && request.raw.url.startsWith('/api')) {
        reply.status(404).send({ error: 'API route not found' });
      } else {
        reply.sendFile('index.html', webDistPath);
      }
    });
  } else {
    console.log('[Static] Warning: No static web dist folder found in candidates:', candidatePaths);
  }

  // Start server
  try {
    await fastify.listen({ port: PORT, host: HOST });

    // Check for updates in background (don't block server startup)
    checkForUpdates().then(({ hasUpdate, latestVersion }) => {
      if (hasUpdate && latestVersion) {
        printUpdateWarning(latestVersion);
      }
    });

    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🚀 Sui CLI Web - Local Server v${CURRENT_VERSION.padEnd(27)}║
║                                                               ║
║   Server running at: http://localhost:${PORT}                  ║
║                                                               ║
║   Now open the web UI:                                        ║
║   → https://cli.firstmovers.io                                ║
║                                                               ║
║   The UI will connect to this local server automatically.     ║
║   Keep this terminal open while using the app.                ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
    `);
  } catch (err: any) {
    if (err.code === 'EADDRINUSE') {
      console.error(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   ❌ ERROR: Port ${PORT} is already in use                       ║
║                                                               ║
║   Another server is running on this port.                     ║
║                                                               ║
║   To fix this, run one of these commands:                     ║
║                                                               ║
║   MacOS/Linux:                                                ║
║   → lsof -ti:${PORT} | xargs kill -9                             ║
║                                                               ║
║   Or change the port:                                         ║
║   → PORT=3002 sui-cli-web                                     ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
      `);
    } else {
      fastify.log.error(err);
    }
    process.exit(1);
  }
}

main();
