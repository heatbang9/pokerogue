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

    // Support both JSON and form-urlencoded
    let bodyData: any = null;

    if (typeof req.body === "object" && req.body !== null) {
      bodyData = req.body;
    } else if (typeof req.body === "string") {
      try {
        bodyData = JSON.parse(req.body);
      } catch {
        const params = new URLSearchParams(req.body);
        bodyData = {
          system: params.get("system"),
          session: params.get("session"),
          sessionSlotId: params.get("sessionSlotId"),
          clientSessionId: params.get("clientSessionId"),
        };
      }
    }

    if (!bodyData || !bodyData.system || !bodyData.session || bodyData.sessionSlotId === undefined) {
      return res.status(400).json({ status: "error", error: "Missing required fields" });
    }

    const { system, session: sessionSave, sessionSlotId } = bodyData;

    // Save system data
    await redis.set(`system:${session.username}`, JSON.stringify(system));

    // Save session data for the specified slot
    await redis.set(`session:${session.username}:${sessionSlotId}`, JSON.stringify(sessionSave));

    return res.status(200).json({ status: "success" });
  } catch (error) {
    console.error("Update all savedata error:", error);
    return res.status(500).json({ status: "error", error: "Internal server error" });
  }
}
