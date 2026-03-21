/*
SPDX-FileCopyrightText: 2024-2026 Pagefault Games
SPDX-License-Identifier: AGPL-3.0-only
*/

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Errors, sendSuccess } from "../lib/errors";
import { kv } from "../lib/kv";

/**
 * Get leaderboard
 * Public endpoint - no authentication required
 * Query params: type (wins|streak|time), limit (default 10)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return Errors.badRequest(res, "Method not allowed");
  }

  try {
    const { type = "wins", limit = "10" } = req.query;

    // Validate type
    const validTypes = ["wins", "streak", "time"];
    if (!validTypes.includes(type as string)) {
      return Errors.badRequest(res, "Invalid leaderboard type");
    }

    // Validate limit
    const limitNum = Number.parseInt(limit as string, 10);
    if (Number.isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return Errors.badRequest(res, "Invalid limit (must be 1-100)");
    }

    // Get leaderboard from Redis
    const leaderboardKey = `leaderboard:${type}`;
    let leaderboard = (await kv.get(leaderboardKey)) as any;

    if (!leaderboard) {
      // Initialize empty leaderboard
      leaderboard = {
        type,
        entries: [],
        lastUpdated: Date.now(),
      };
      await kv.set(leaderboardKey, leaderboard);
    }

    // Return limited entries
    const result = {
      type,
      entries: leaderboard.entries.slice(0, limitNum),
      total: leaderboard.entries.length,
      lastUpdated: leaderboard.lastUpdated,
    };

    return sendSuccess(res, result);
  } catch (error) {
    console.error("Leaderboard error:", error);
    return Errors.internalError(res, "Failed to get leaderboard");
  }
}
