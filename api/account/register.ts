/*
 * SPDX-FileCopyrightText: 2025 Pokerogue <https://github.com/pagefaultgames/pokerogue>
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { Redis } from "@upstash/redis";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "",
});

function generateSalt(): string {
  const saltBytes = new Uint8Array(16);
  crypto.getRandomValues(saltBytes);
  return Array.from(saltBytes)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateToken(): string {
  const tokenBytes = new Uint8Array(32);
  crypto.getRandomValues(tokenBytes);
  return Array.from(tokenBytes)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), { name: "PBKDF2" }, false, [
    "deriveBits",
  ]);
  const hashBuffer = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: encoder.encode(salt), iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    256,
  );
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ status: "error", error: "Method not allowed" });
  }

  try {
    const { username, password, email } = req.body;

    // Validation
    if (!username || username.length < 3 || username.length > 20 || !/^[a-zA-Z0-9_]+$/.test(username)) {
      return res
        .status(400)
        .json({ status: "error", error: "Invalid username (3-20 chars, alphanumeric + underscore)" });
    }

    if (!password || password.length < 8) {
      return res.status(400).json({ status: "error", error: "Password must be at least 8 characters" });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ status: "error", error: "Invalid email format" });
    }

    // Check if user exists
    const existingUser = await redis.get(`user:${username.toLowerCase()}`);
    if (existingUser) {
      return res.status(409).json({ status: "error", error: "Username already exists" });
    }

    if (email) {
      const existingEmail = await redis.get(`email:${email.toLowerCase()}`);
      if (existingEmail) {
        return res.status(409).json({ status: "error", error: "Email already registered" });
      }
    }

    // Create user
    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);
    const token = generateToken();
    const now = new Date().toISOString();

    const userData = {
      username: username.toLowerCase(),
      passwordHash,
      salt,
      email: email?.toLowerCase() || null,
      createdAt: now,
      lastLogin: now,
      stats: { gamesPlayed: 0, highestWave: 0, totalPlayTime: 0 },
    };

    // Save to Redis
    await redis.set(`user:${username.toLowerCase()}`, JSON.stringify(userData));
    if (email) {
      await redis.set(`email:${email.toLowerCase()}`, username.toLowerCase());
    }
    await redis.set(`session:${token}`, JSON.stringify({ username: username.toLowerCase(), createdAt: now }), {
      ex: 60 * 60 * 24 * 7,
    }); // 7 days

    return res.status(200).json({
      status: "success",
      token,
      user: {
        username: username.toLowerCase(),
        email: email?.toLowerCase() || null,
        createdAt: now,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({ status: "error", error: "Internal server error" });
  }
}
