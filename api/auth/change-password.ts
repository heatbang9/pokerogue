// SPDX-FileCopyrightText: 2025 PokéRogue Authors
// SPDX-License-Identifier: MIT

import { Redis } from "@upstash/redis";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { generateSalt, hashPassword, verifyPassword } from "./crypto-utils";
import { checkRateLimit, createRateLimitKey, getClientIp, LOGIN_RATE_LIMIT } from "./rate-limiter";

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

interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

interface UserData {
  id: string;
  username: string;
  password: string;
  salt?: string;
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
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Cookie");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Get client IP for rate limiting
  const clientIp = getClientIp(req);

  try {
    // Get session from cookie or header
    const cookie = req.headers.cookie || "";
    const sessionMatch = cookie.match(/session=([^;]+)/);
    const sessionToken = sessionMatch ? sessionMatch[1] : req.headers.authorization?.replace("Bearer ", "");

    if (!sessionToken) {
      return res.status(401).json({ error: "No session" });
    }

    // Get session
    const session = await redis.get<{ userId: string; username: string; expiresAt: number }>(`session:${sessionToken}`);
    if (!session) {
      return res.status(401).json({ error: "Invalid session" });
    }

    // Check expiration
    if (Date.now() > session.expiresAt) {
      await redis.del(`session:${sessionToken}`);
      return res.status(401).json({ error: "Session expired" });
    }

    const { currentPassword, newPassword } = req.body as ChangePasswordRequest;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current password and new password are required" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: "New password must be at least 8 characters" });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({ error: "New password must be different from current password" });
    }

    // Rate limiting
    const rateLimitKey = createRateLimitKey(clientIp, "password-change", session.username);
    const rateLimitResult = await checkRateLimit(rateLimitKey, LOGIN_RATE_LIMIT);

    if (!rateLimitResult.allowed) {
      return res.status(429).json({
        error: "Too many password change attempts. Please try again later.",
      });
    }

    // Get user
    const user = (await redis.get(`user:${session.username}`)) as UserData | null;
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Verify current password
    let passwordValid = false;
    if (user.salt) {
      passwordValid = await verifyPassword(currentPassword, user.salt, user.password);
    } else {
      const legacyHash = await legacyHashPassword(currentPassword);
      passwordValid = legacyHash === user.password;
    }

    if (!passwordValid) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    // Hash new password with new salt
    const newSalt = generateSalt();
    const newHash = await hashPassword(newPassword, newSalt);

    // Update user
    user.salt = newSalt;
    user.password = newHash;
    await redis.set(`user:${session.username}`, user);

    // Invalidate all other sessions for this user (optional security measure)
    // This would require tracking all sessions per user, which we're not doing currently
    // For now, we just update the password

    return res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
