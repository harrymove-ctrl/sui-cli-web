// Simple in-memory rate limiter for local server
// No external dependencies needed

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

// Different limits for different endpoint types
// Local server limits are generous since it's running on user's own machine
export const RATE_LIMITS = {
  // Read operations - very generous for local dev
  read: { windowMs: 60_000, maxRequests: 1000 }, // 1000 req/min
  // Write operations - generous for local
  write: { windowMs: 60_000, maxRequests: 300 }, // 300 req/min
  // Keytool operations - generous for local key management
  keytool: { windowMs: 60_000, maxRequests: 200 }, // 200 req/min
  // Faucet - restrictive (external API has its own limits)
  faucet: { windowMs: 60_000, maxRequests: 5 }, // 5 req/min
} as const;

class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Check if request is allowed
   * @returns { allowed: boolean, remaining: number, resetTime: number }
   */
  check(
    key: string,
    config: RateLimitConfig
  ): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now > entry.resetTime) {
      // First request or window expired
      this.store.set(key, {
        count: 1,
        resetTime: now + config.windowMs,
      });
      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetTime: now + config.windowMs,
      };
    }

    if (entry.count >= config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
      };
    }

    entry.count++;
    return {
      allowed: true,
      remaining: config.maxRequests - entry.count,
      resetTime: entry.resetTime,
    };
  }

  /**
   * Generate a rate limit key based on endpoint type
   * Since this is a local server, we use a simple key
   */
  getKey(type: keyof typeof RATE_LIMITS): string {
    return `local:${type}`;
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Singleton instance
export const rateLimiter = new RateLimiter();

// Fastify hook helper
export function createRateLimitHook(type: keyof typeof RATE_LIMITS) {
  return async (request: any, reply: any) => {
    const key = rateLimiter.getKey(type);
    const config = RATE_LIMITS[type];
    const result = rateLimiter.check(key, config);

    // Add rate limit headers
    reply.header('X-RateLimit-Limit', config.maxRequests);
    reply.header('X-RateLimit-Remaining', result.remaining);
    reply.header('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000));

    if (!result.allowed) {
      reply.status(429);
      return reply.send({
        success: false,
        error: `Rate limit exceeded. Try again in ${Math.ceil((result.resetTime - Date.now()) / 1000)} seconds.`,
      });
    }
  };
}
