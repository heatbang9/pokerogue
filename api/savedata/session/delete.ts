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
      return res.status(401).send("No authorization token");
    }

    const sessionData = await redis.get(`session:${authHeader}`);
    if (!sessionData) {
      return res.status(401).send("Invalid or expired session");
    }

    const session = typeof sessionData === "string" ? JSON.parse(sessionData) : sessionData;
    const slot = req.query.slot || "0";

    // Delete session data
    await redis.del(`savedata:${session.username}:${slot}`);

    return res.status(200).send("1"); // Client expects "1" on success
  } catch (error) {
    console.error("Session delete error:", error);
    return res.status(500).send("Internal server error");
  }
}
