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

    // Get query parameters (trainerId can be used for validation in the future)
    const { slot, trainerId } = req.query;
    void trainerId;

    if (slot === undefined) {
      return res.status(400).json({ error: "Missing slot parameter", success: false });
    }

    const slotNum = Number.parseInt(slot as string, 10);
    if (Number.isNaN(slotNum)) {
      return res.status(400).json({ error: "Invalid slot parameter", success: false });
    }

    // Support both JSON and raw string body
    let sessionSaveData: any = null;

    if (typeof req.body === "object" && req.body !== null) {
      sessionSaveData = req.body;
    } else if (typeof req.body === "string") {
      try {
        sessionSaveData = JSON.parse(req.body);
      } catch {
        return res.status(400).json({ error: "Invalid session data format", success: false });
      }
    }

    if (!sessionSaveData) {
      return res.status(400).json({ error: "Missing session data", success: false });
    }

    // Mark the session as cleared
    sessionSaveData.cleared = true;

    // Save the cleared session data
    await redis.set(`session:${session.username}:${slotNum}`, JSON.stringify(sessionSaveData));

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Clear session savedata error:", error);
    return res.status(500).json({ error: "Internal server error", success: false });
  }
}
