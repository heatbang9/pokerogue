// SPDX-FileCopyrightText: 2025 The Pokerogue Team
// SPDX-License-Identifier: AGPL-3.0-only

import { Redis } from "@upstash/redis";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "",
});

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
    // Support both JSON and form-urlencoded
    let username: string | undefined;
    let password: string | undefined;

    if (typeof req.body === "object" && req.body !== null) {
      // JSON body (already parsed by Vercel)
      username = req.body.username;
      password = req.body.password;
    } else if (typeof req.body === "string") {
      // form-urlencoded - parse manually
      const params = new URLSearchParams(req.body);
      username = params.get("username") ?? undefined;
      password = params.get("password") ?? undefined;
    }

    if (!username || !password) {
      return res.status(400).json({ status: "error", error: "Username and password required" });
    }

    // Get user
    const userData = await redis.get(`user:${username.toLowerCase()}`);
    if (!userData) {
      return res.status(401).json({ status: "error", error: "Invalid username or password" });
    }

    const user = typeof userData === "string" ? JSON.parse(userData) : userData;

    // Verify password
    const passwordHash = await hashPassword(password, user.salt);
    if (passwordHash !== user.passwordHash) {
      return res.status(401).json({ status: "error", error: "Invalid username or password" });
    }

    // Create session
    const token = generateToken();
    const now = new Date().toISOString();

    await redis.set(`session:${token}`, JSON.stringify({ username: username.toLowerCase(), createdAt: now }), {
      ex: 60 * 60 * 24 * 7,
    }); // 7 days

    // Update last login
    user.lastLogin = now;
    await redis.set(`user:${username.toLowerCase()}`, JSON.stringify(user));

    return res.status(200).json({
      status: "success",
      token,
      user: {
        username: username.toLowerCase(),
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ status: "error", error: "Internal server error" });
  }
}
