/**
 * Simple request cache and deduplication layer with LRU eviction
 * Reduces redundant API calls and improves performance
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface PendingRequest<T> {
  promise: Promise<T>;
  timestamp: number;
}

class ApiCache {
  private cache = new Map<string, CacheEntry<any>>();
  private pendingRequests = new Map<string, PendingRequest<any>>();
  private readonly DEFAULT_TTL = 5000; // 5 seconds default cache
  private readonly MAX_CACHE_SIZE = 100; // Maximum cache entries (LRU eviction)
  private readonly MAX_PENDING_REQUESTS = 50; // Maximum concurrent pending requests

  /**
   * Get cached data if available and not expired
   * Updates access order for LRU
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // LRU: Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.data as T;
  }

  /**
   * Set cache entry with TTL and LRU eviction
   */
  set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    // LRU eviction: remove oldest entries if cache is full
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.evictOldest();
    }

    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttl,
    });
  }

  /**
   * Evict oldest (least recently used) entries
   */
  private evictOldest(): void {
    // Remove 10% of entries (oldest first since Map maintains insertion order)
    const entriesToRemove = Math.max(1, Math.floor(this.MAX_CACHE_SIZE * 0.1));
    let removed = 0;

    for (const key of this.cache.keys()) {
      if (removed >= entriesToRemove) break;
      this.cache.delete(key);
      removed++;
    }
  }

  /**
   * Clean up expired entries and stale pending requests
   */
  cleanup(): void {
    const now = Date.now();

    // Remove expired cache entries
    const expiredKeys: string[] = [];
    this.cache.forEach((entry, key) => {
      if (now > entry.expiresAt) {
        expiredKeys.push(key);
      }
    });
    expiredKeys.forEach((key) => this.cache.delete(key));

    // Remove stale pending requests (older than 30 seconds)
    const staleRequests: string[] = [];
    this.pendingRequests.forEach((request, key) => {
      if (now - request.timestamp > 30000) {
        staleRequests.push(key);
      }
    });
    staleRequests.forEach((key) => this.pendingRequests.delete(key));
  }

  /**
   * Invalidate cache entry
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidate all cache entries matching pattern
   */
  invalidatePattern(pattern: RegExp): void {
    const keysToDelete: string[] = [];
    this.cache.forEach((_, key) => {
      if (pattern.test(key)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach((key) => this.cache.delete(key));
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Deduplicate concurrent requests
   * If same request is in-flight, return the pending promise instead of making new request
   */
  async dedupe<T>(key: string, fetcher: () => Promise<T>, ttl?: number): Promise<T> {
    // Check cache first
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Check if request is already in-flight
    const pending = this.pendingRequests.get(key);
    if (pending) {
      // Dedup: Return existing promise instead of making new request
      return pending.promise;
    }

    // Limit pending requests to prevent memory issues
    if (this.pendingRequests.size >= this.MAX_PENDING_REQUESTS) {
      // Clean up stale requests before adding new one
      this.cleanup();
    }

    // Create new request
    const promise = fetcher()
      .then((data) => {
        // Cache the result
        this.set(key, data, ttl);
        return data;
      })
      .finally(() => {
        // Clean up pending request
        this.pendingRequests.delete(key);
      });

    // Track pending request
    this.pendingRequests.set(key, {
      promise,
      timestamp: Date.now(),
    });

    return promise;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      cacheSize: this.cache.size,
      maxCacheSize: this.MAX_CACHE_SIZE,
      pendingRequests: this.pendingRequests.size,
      maxPendingRequests: this.MAX_PENDING_REQUESTS,
    };
  }
}

export const apiCache = new ApiCache();

// Periodic cleanup every 60 seconds
setInterval(() => {
  apiCache.cleanup();
}, 60000);

// Cache key builders for consistency
export const cacheKeys = {
  addresses: () => 'addresses',
  environments: () => 'environments',
  gasCoins: (address: string) => `gas:${address}`,
  objects: (address: string) => `objects:${address}`,
  status: () => 'status',
} as const;
