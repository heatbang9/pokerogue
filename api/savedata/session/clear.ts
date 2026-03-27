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
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ status: "error", error: "Method not allowed" });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "No authorization token", success: false });
    }

    const sessionData = await redis.get(`session:${authHeader}`);
    if (!sessionData) {
      return res.status(401).json({ error: "Invalid or expired session", success: false });
    }

    const session = typeof sessionData === "string" ? JSON.parse(sessionData) : sessionData;
    const slot = req.query.slot || "0";

    let sessionSaveData: string;
    if (typeof req.body === "string") {
      sessionSaveData = req.body;
    } else if (typeof req.body === "object") {
      sessionSaveData = JSON.stringify(req.body);
    } else {
      return res.status(400).json({ error: "No session data provided", success: false });
    }

    if (!sessionSaveData) {
      return res.status(400).json({ error: "No session data provided", success: false });
    }

    // Usually when a run is cleared (win/loss), we delete the active session.
    // However, some implementations prefer to just overwrite it or mark it.
    // For Vercel KV, we can store it under a specific clear key or overwrite the savedata.
    // Storing under `cleared:` preserves it if needed for stats, while freeing `savedata:`
    await redis.set(`cleared:${session.username}:${slot}`, sessionSaveData);
    await redis.del(`savedata:${session.username}:${slot}`);
    
    // Set a "newclear" flag so the client knows it has a newly cleared session
    await redis.set(`newclear:${session.username}:${slot}`, "1");

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Session clear error:", error);
    return res.status(500).json({ error: "Internal server error", success: false });
  }
}
