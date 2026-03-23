import { Redis } from "@upstash/redis";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "",
});

interface LoginRequest {
  username: string;
  password: string;
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

  try {
    const { username, password } = req.body as LoginRequest;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    // Get user
    const user = await redis.get<any>(`user:${username.toLowerCase()}`);
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Verify password
    const hashedPassword = await hashPassword(password);
    if (user.password !== hashedPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Update last login
    const now = Date.now();
    await redis.set(`user:${username.toLowerCase()}`, {
      ...user,
      lastLogin: now,
    });

    // Create session
    const sessionToken = generateToken();
    await redis.set(
      `session:${sessionToken}`,
      {
        userId: user.id,
        username: user.username,
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

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "pokerogue_salt_2026");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}
