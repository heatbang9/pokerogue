// SPDX-FileCopyrightText: 2025 PokéRogue Authors
// SPDX-License-Identifier: MIT

import { Redis } from "@upstash/redis";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "",
});

interface SessionInfo {
  token: string;
  createdAt: number;
  expiresAt: number;
  lastAccessed?: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Cookie");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // Get session from cookie or header
    const cookie = req.headers.cookie || "";
    const sessionMatch = cookie.match(/session=([^;]+)/);
    const currentSessionToken = sessionMatch ? sessionMatch[1] : req.headers.authorization?.replace("Bearer ", "");

    if (!currentSessionToken) {
      return res.status(401).json({ error: "No session" });
    }

    // Get current session
    const currentSession = await redis.get<{ userId: string; username: string; expiresAt: number }>(
      `session:${currentSessionToken}`,
    );
    if (!currentSession) {
      return res.status(401).json({ error: "Invalid session" });
    }

    // Check expiration
    if (Date.now() > currentSession.expiresAt) {
      await redis.del(`session:${currentSessionToken}`);
      return res.status(401).json({ error: "Session expired" });
    }

    // GET - List all sessions for the user
    if (req.method === "GET") {
      // Get user's session list
      const sessionTokens = (await redis.get<string[]>(`user-sessions:${currentSession.username}`)) || [];

      const sessions: SessionInfo[] = [];
      for (const token of sessionTokens) {
        const session = await redis.get<{ createdAt: number; expiresAt: number }>(`session:${token}`);
        if (session) {
          sessions.push({
            token: token.substring(0, 8) + "...", // Only show first 8 chars for security
            createdAt: session.createdAt,
            expiresAt: session.expiresAt,
          });
        }
      }

      return res.status(200).json({
        success: true,
        currentSession: currentSessionToken.substring(0, 8) + "...",
        sessions,
      });
    }

    // DELETE - Revoke sessions
    if (req.method === "DELETE") {
      const { revokeAll, sessionToken } = req.body as { revokeAll?: boolean; sessionToken?: string };

      if (revokeAll) {
        // Revoke all sessions except current
        const sessionTokens = (await redis.get<string[]>(`user-sessions:${currentSession.username}`)) || [];

        for (const token of sessionTokens) {
          if (token !== currentSessionToken) {
            await redis.del(`session:${token}`);
          }
        }

        // Update user's session list to only contain current session
        await redis.set(`user-sessions:${currentSession.username}`, [currentSessionToken]);

        return res.status(200).json({
          success: true,
          message: "All other sessions have been revoked",
        });
      }
      if (sessionToken) {
        // Revoke specific session
        // Find the full token from partial
        const sessionTokens = (await redis.get<string[]>(`user-sessions:${currentSession.username}`)) || [];
        const fullToken = sessionTokens.find(t => t.startsWith(sessionToken));

        if (!fullToken) {
          return res.status(404).json({ error: "Session not found" });
        }

        if (fullToken === currentSessionToken) {
          return res.status(400).json({ error: "Cannot revoke current session. Use logout instead." });
        }

        await redis.del(`session:${fullToken}`);

        // Update user's session list
        const updatedTokens = sessionTokens.filter(t => t !== fullToken);
        await redis.set(`user-sessions:${currentSession.username}`, updatedTokens);

        return res.status(200).json({
          success: true,
          message: "Session revoked successfully",
        });
      }
      return res.status(400).json({ error: "Specify revokeAll or sessionToken" });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Sessions error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
