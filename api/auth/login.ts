import { Redis } from "@upstash/redis";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { generateSalt, generateToken, hashPassword, verifyPassword } from "./crypto-utils";
import { checkRateLimit, createRateLimitKey, getClientIp, LOGIN_RATE_LIMIT, resetRateLimit } from "./rate-limiter";

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "",
});

// Legacy hash function for backward compatibility
async function legacyHashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "pokerogue_salt_2026");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

interface LoginRequest {
  username: string;
  password: string;
}

interface UserData {
  id: string;
  username: string;
  password: string;
  salt?: string; // New field for per-user salt
  email?: string | null;
  createdAt: number;
  lastLogin: number;
  stats: {
    gamesPlayed: number;
    wins: number;
    highestWave: number;
    totalPokemonCaught?: number;
    totalTrainersDefeated?: number;
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Get client IP for rate limiting
  const clientIp = getClientIp(req);

  try {
    const { username, password } = req.body as LoginRequest;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    const normalizedUsername = username.toLowerCase();

    // Rate limiting check by IP + username
    const rateLimitKey = createRateLimitKey(clientIp, "login", normalizedUsername);
    const rateLimitResult = await checkRateLimit(rateLimitKey, LOGIN_RATE_LIMIT);

    if (!rateLimitResult.allowed) {
      const retryAfter = rateLimitResult.blockExpiresAt
        ? Math.ceil((rateLimitResult.blockExpiresAt - Date.now()) / 1000)
        : 900;
      res.setHeader("Retry-After", retryAfter.toString());
      return res.status(429).json({
        error: "Too many login attempts. Please try again later.",
        retryAfter,
      });
    }

    // Add rate limit headers
    res.setHeader("X-RateLimit-Remaining", rateLimitResult.remaining.toString());
    res.setHeader("X-RateLimit-Reset", rateLimitResult.resetAt?.toString() || "0");

    // Get user
    const user = (await redis.get(`user:${normalizedUsername}`)) as UserData | null;
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Verify password with backward compatibility
    let passwordValid = false;
    let needsMigration = false;

    if (user.salt) {
      // New format: per-user salt with PBKDF2
      passwordValid = await verifyPassword(password, user.salt, user.password);
    } else {
      // Legacy format: global salt with SHA-256
      const legacyHash = await legacyHashPassword(password);
      passwordValid = legacyHash === user.password;
      needsMigration = passwordValid; // Migrate on successful login
    }

    if (!passwordValid) {
      return res.status(401).json({
        error: "Invalid credentials",
        remaining: rateLimitResult.remaining - 1,
      });
    }

    // Reset rate limit on successful login
    await resetRateLimit(rateLimitKey);

    const now = Date.now();

    // Migrate password to new format if needed
    if (needsMigration) {
      const newSalt = generateSalt();
      const newHash = await hashPassword(password, newSalt);
      user.salt = newSalt;
      user.password = newHash;
    }

    // Update last login
    user.lastLogin = now;
    await redis.set(`user:${normalizedUsername}`, user);

    // Create session
    const sessionToken = generateToken();
    await redis.set(
      `session:${sessionToken}`,
      {
        userId: user.id,
        username: normalizedUsername,
        createdAt: now,
        expiresAt: now + 7 * 24 * 60 * 60 * 1000,
      },
      { ex: 7 * 24 * 60 * 60 },
    );

    // Set cookie
    res.setHeader(
      "Set-Cookie",
      `session=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}`,
    );

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        stats: user.stats,
      },
      session: sessionToken,
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
