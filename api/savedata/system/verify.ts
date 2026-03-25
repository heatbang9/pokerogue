// SPDX-FileCopyrightText: 2025 The Pokerogue Team
// SPDX-License-Identifier: AGPL-3.0-only

import { Redis } from "@upstash/redis";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "",
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ status: "error", error: "Method not allowed" });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ valid: false });
    }

    const sessionData = await redis.get(`session:${authHeader}`);
    if (!sessionData) {
      return res.status(401).json({ valid: false });
    }

    const session = typeof sessionData === "string" ? JSON.parse(sessionData) : sessionData;
    const clientTimestamp = req.query.clientTimestamp;

    // Get system data
    const systemData = await redis.get(`system:${session.username}`);

    if (!systemData) {
      // No system data, return valid=true (new user)
      return res.status(200).json({ valid: true });
    }

    // If client has no timestamp, it's valid
    if (!clientTimestamp) {
      return res.status(200).json({ valid: true });
    }

    // Compare timestamps (simplified - always valid for now)
    return res.status(200).json({ valid: true });
  } catch (error) {
    console.error("System verify error:", error);
    return res.status(500).json({ valid: false });
  }
}
