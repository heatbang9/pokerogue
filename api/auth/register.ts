import { Redis } from "@upstash/redis";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const redis = Redis.fromEnv();

interface RegisterRequest {
  username: string;
  password: string;
  email?: string;
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
    const { username, password, email } = req.body as RegisterRequest;

    // Validation
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: "Username must be 3-20 characters" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    // Check if user exists
    const existingUser = await redis.get(`user:${username.toLowerCase()}`);
    if (existingUser) {
      return res.status(409).json({ error: "Username already exists" });
    }

    // Create user
    const userId = crypto.randomUUID();
    const hashedPassword = await hashPassword(password);
    const now = Date.now();

    const userData = {
      id: userId,
      username: username.toLowerCase(),
      password: hashedPassword,
      email: email || null,
      createdAt: now,
      lastLogin: now,
      stats: {
        gamesPlayed: 0,
        wins: 0,
        highestWave: 0,
      },
    };

    // Save user
    await redis.set(`user:${username.toLowerCase()}`, userData);
    await redis.set(`user:id:${userId}`, username.toLowerCase());

    // Create session
    const sessionToken = generateToken();
    await redis.set(
      `session:${sessionToken}`,
      {
        userId,
        username: username.toLowerCase(),
        createdAt: now,
        expiresAt: now + 7 * 24 * 60 * 60 * 1000, // 7 days
      },
      { ex: 7 * 24 * 60 * 60 },
    ); // 7 days TTL

    // Set cookie
    res.setHeader(
      "Set-Cookie",
      `session=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}`,
    );

    return res.status(201).json({
      success: true,
      user: {
        id: userId,
        username: username.toLowerCase(),
        createdAt: now,
      },
      session: sessionToken,
    });
  } catch (error) {
    console.error("Register error:", error);
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
