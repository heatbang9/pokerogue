/*
SPDX-FileCopyrightText: 2024-2026 Pagefault Games
SPDX-License-Identifier: AGPL-3.0-only
*/

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Errors, sendSuccess } from "../lib/errors";
import { kv } from "../lib/kv";

/**
 * Get game statistics
 * Public endpoint - no authentication required
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
    // Get or initialize stats from Redis
    let stats = (await kv.get("game:stats")) as any;

    if (!stats) {
      // Initialize default stats
      stats = {
        totalPlayers: 0,
        totalBattles: 0,
        totalPlayTime: 0,
        lastUpdated: Date.now(),
      };
      await kv.set("game:stats", stats);
    }

    return sendSuccess(res, stats);
  } catch (error) {
    console.error("Stats error:", error);
    return Errors.internalError(res, "Failed to get game stats");
  }
}
