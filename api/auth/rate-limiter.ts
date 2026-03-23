import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "",
});

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxAttempts: number; // Max attempts per window
  blockDurationMs: number; // Block duration after max attempts
}

// Default configs for different scenarios
export const LOGIN_RATE_LIMIT: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxAttempts: 5,
  blockDurationMs: 15 * 60 * 1000, // 15 minutes
};

export const REGISTER_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60 * 60 * 1000, // 1 hour
  maxAttempts: 3,
  blockDurationMs: 60 * 60 * 1000, // 1 hour
};

export const API_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxAttempts: 60,
  blockDurationMs: 5 * 60 * 1000, // 5 minutes
};

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number | null;
  blocked: boolean;
  blockExpiresAt?: number;
}

/**
 * Check and increment rate limit for a key
 * @param key - Unique identifier (e.g., IP address, username)
 * @param config - Rate limit configuration
 * @returns Rate limit result
 */
export async function checkRateLimit(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
  const now = Date.now();
  const attemptsKey = `ratelimit:attempts:${key}`;
  const blockKey = `ratelimit:block:${key}`;

  // Check if currently blocked
  const blockData = await redis.get<{ expiresAt: number }>(blockKey);
  if (blockData && blockData.expiresAt > now) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: blockData.expiresAt,
      blocked: true,
      blockExpiresAt: blockData.expiresAt,
    };
  }

  // Get current attempts in window
  const attemptData = await redis.get<{ count: number; windowStart: number }>(attemptsKey);

  let count = 1;
  let windowStart = now;

  if (attemptData && now - attemptData.windowStart < config.windowMs) {
    count = attemptData.count + 1;
    windowStart = attemptData.windowStart;
  }

  // Check if limit exceeded
  if (count > config.maxAttempts) {
    // Block the key
    const blockExpiresAt = now + config.blockDurationMs;
    await redis.set(blockKey, { expiresAt: blockExpiresAt }, { ex: Math.ceil(config.blockDurationMs / 1000) });

    return {
      allowed: false,
      remaining: 0,
      resetAt: blockExpiresAt,
      blocked: true,
      blockExpiresAt,
    };
  }

  // Update attempts
  const ttl = Math.ceil(config.windowMs / 1000);
  await redis.set(attemptsKey, { count, windowStart }, { ex: ttl });

  return {
    allowed: true,
    remaining: config.maxAttempts - count,
    resetAt: windowStart + config.windowMs,
    blocked: false,
  };
}

/**
 * Reset rate limit for a key (e.g., after successful login)
 * @param key - Unique identifier
 */
export async function resetRateLimit(key: string): Promise<void> {
  const attemptsKey = `ratelimit:attempts:${key}`;
  await redis.del(attemptsKey);
}

/**
 * Get client IP from request
 */
export function getClientIp(req: any): string {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim()
    || req.headers["x-real-ip"]
    || req.connection?.remoteAddress
    || "unknown"
  );
}

/**
 * Create a combined key for rate limiting (IP + action)
 */
export function createRateLimitKey(ip: string, action: string, identifier?: string): string {
  if (identifier) {
    return `${ip}:${action}:${identifier}`;
  }
  return `${ip}:${action}`;
}
