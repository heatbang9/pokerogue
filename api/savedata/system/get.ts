// SPDX-FileCopyrightText: 2025 The Pokerogue Team
// SPDX-License-Identifier: AGPL-3.0-only

import { Redis } from "@upstash/redis";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "",
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
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

    // Get system savedata
    const systemData = await redis.get(`system:${session.username}`);
    if (!systemData) {
      return res.status(404).json({ status: "error", error: "System data not found" });
    }

    // Return as raw JSON string (like the original API)
    const rawSystemData = typeof systemData === "string" ? systemData : JSON.stringify(systemData);

    return res.status(200).send(rawSystemData);
  } catch (error) {
    console.error("Get system savedata error:", error);
    return res.status(500).json({ status: "error", error: "Internal server error" });
  }
}
