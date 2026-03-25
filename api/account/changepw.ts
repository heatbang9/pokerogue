// SPDX-FileCopyrightText: 2025 The Pokerogue Team
// SPDX-License-Identifier: AGPL-3.0-only

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
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ status: "error", error: "No authorization token" });
    }

    // Get session from Redis
    const sessionData = await redis.get(`session:${authHeader}`);
    if (!sessionData) {
      return res.status(401).json({ status: "error", error: "Invalid or expired session" });
    }

    const session = typeof sessionData === "string" ? JSON.parse(sessionData) : sessionData;

    // Support both JSON and form-urlencoded
    let password: string | undefined;

    if (typeof req.body === "object" && req.body !== null) {
      // JSON body (already parsed by Vercel)
      password = req.body.password;
    } else if (typeof req.body === "string") {
      // form-urlencoded - parse manually
      const params = new URLSearchParams(req.body);
      password = params.get("password") ?? undefined;
    }

    if (!password || password.length < 8) {
      return res.status(400).json({ status: "error", error: "Password must be at least 8 characters" });
    }

    // Get user data
    const userData = await redis.get(`user:${session.username}`);
    if (!userData) {
      return res.status(404).json({ status: "error", error: "User not found" });
    }

    const user = typeof userData === "string" ? JSON.parse(userData) : userData;

    // Update password
    const newSalt = generateSalt();
    const newPasswordHash = await hashPassword(password, newSalt);

    user.salt = newSalt;
    user.passwordHash = newPasswordHash;

    await redis.set(`user:${session.username}`, JSON.stringify(user));

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({ status: "error", error: "Internal server error" });
  }
}
