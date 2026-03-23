import { Redis } from "@upstash/redis";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  generateSalt,
  generateToken,
  hashPassword,
  validateEmail,
  validatePassword,
  validateUsername,
} from "./crypto-utils";

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "",
});

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
    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid) {
      return res.status(400).json({ error: usernameValidation.error });
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.error });
    }

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return res.status(400).json({ error: emailValidation.error });
    }

    const normalizedUsername = username.toLowerCase();

    // Check if user exists
    const existingUser = await redis.get(`user:${normalizedUsername}`);
    if (existingUser) {
      return res.status(409).json({ error: "Username already exists" });
    }

    // Create user with secure password hash
    const userId = crypto.randomUUID();
    const salt = generateSalt();
    const hashedPassword = await hashPassword(password, salt);
    const now = Date.now();

    const userData = {
      id: userId,
      username: normalizedUsername,
      password: hashedPassword,
      salt, // Store salt for verification
      email: email?.toLowerCase() || null,
      createdAt: now,
      lastLogin: now,
      stats: {
        gamesPlayed: 0,
        wins: 0,
        highestWave: 0,
      },
    };

    // Save user
    await redis.set(`user:${normalizedUsername}`, userData);
    await redis.set(`user:id:${userId}`, normalizedUsername);

    // Create session
    const sessionToken = generateToken();
    await redis.set(
      `session:${sessionToken}`,
      {
        userId,
        username: normalizedUsername,
        createdAt: now,
        expiresAt: now + 7 * 24 * 60 * 60 * 1000, // 7 days
      },
      { ex: 7 * 24 * 60 * 60 }, // 7 days TTL
    );

    // Set cookie
    res.setHeader(
      "Set-Cookie",
      `session=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}`,
    );

    return res.status(201).json({
      success: true,
      user: {
        id: userId,
        username: normalizedUsername,
        createdAt: now,
      },
      session: sessionToken,
    });
  } catch (error) {
    console.error("Register error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
