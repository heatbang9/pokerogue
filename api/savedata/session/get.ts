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

    // Get query parameters
    const { slot } = req.query;

    if (slot === undefined) {
      return res.status(400).json({ status: "error", error: "Missing slot parameter" });
    }

    const slotNum = Number.parseInt(slot as string, 10);
    if (Number.isNaN(slotNum)) {
      return res.status(400).json({ status: "error", error: "Invalid slot parameter" });
    }

    // Get session savedata for the slot
    const sessionSaveData = await redis.get(`session:${session.username}:${slotNum}`);

    if (!sessionSaveData) {
      return res.status(404).json({ status: "error", error: "Session data not found" });
    }

    // Return as raw JSON string (like the original API)
    const rawSessionData = typeof sessionSaveData === "string" ? sessionSaveData : JSON.stringify(sessionSaveData);

    return res.status(200).send(rawSessionData);
  } catch (error) {
    console.error("Get session savedata error:", error);
    return res.status(500).json({ status: "error", error: "Internal server error" });
  }
}
