// SPDX-FileCopyrightText: 2025 The Pokerogue Team
// SPDX-License-Identifier: AGPL-3.0-only

import { Redis } from "@upstash/redis";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "",
});

function getDailySeed(): string {
  return new Date().toISOString().split("T")[0].replace(/-/g, "");
}

function getWeeklyKey(): string {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().split("T")[0].replace(/-/g, "");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
    // Authenticate user
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ status: "error", error: "Authentication required" });
    }

    const sessionData = await redis.get(`session:${authHeader}`);
    if (!sessionData) {
      return res.status(401).json({ status: "error", error: "Invalid or expired session" });
    }

    const session = typeof sessionData === "string" ? JSON.parse(sessionData) : sessionData;
    const username = session.username;

    // Parse request body
    const { score, wave, isDaily = true } = req.body;

    if (typeof score !== "number" || typeof wave !== "number") {
      return res.status(400).json({ status: "error", error: "Score and wave are required" });
    }

    const timestamp = Date.now();
    const member = `${username}:${wave}:${timestamp}`;

    // Determine which ranking to update
    const dailyKey = `daily:rankings:${getDailySeed()}`;
    const weeklyKey = `daily:rankings:weekly:${getWeeklyKey()}`;

    // Use a pipeline for atomicity
    const pipeline = redis.pipeline();

    // Add to daily rankings (always)
    pipeline.zadd(dailyKey, { score, member });
    // Set expiry for daily key (48 hours to allow for timezone differences)
    pipeline.expire(dailyKey, 60 * 60 * 48);

    // Add to weekly rankings if applicable
    if (isDaily) {
      pipeline.zadd(weeklyKey, { score, member });
      // Set expiry for weekly key (14 days to allow for timezone differences)
      pipeline.expire(weeklyKey, 60 * 60 * 24 * 14);
    }

    await pipeline.exec();

    return res.status(200).json({ status: "success" });
  } catch (error) {
    console.error("Score submission error:", error);
    return res.status(500).json({ status: "error", error: "Internal server error" });
  }
}
