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
      return res.status(401).send("No authorization token");
    }

    const sessionDataAuth = await redis.get(`session:${authHeader}`);
    if (!sessionDataAuth) {
      return res.status(401).send("Invalid or expired session");
    }

    const session = typeof sessionDataAuth === "string" ? JSON.parse(sessionDataAuth) : sessionDataAuth;

    let body;
    if (typeof req.body === "string") {
      try {
        body = JSON.parse(req.body);
      } catch (e) {
        return res.status(400).send("Invalid JSON payload");
      }
    } else {
      body = req.body;
    }

    if (!body || !body.system || !body.session || body.sessionSlotId === undefined) {
      return res.status(400).send("Invalid request payload");
    }

    const { system, session: gameSession, sessionSlotId } = body;

    const systemString = typeof system === "string" ? system : JSON.stringify(system);
    const sessionString = typeof gameSession === "string" ? gameSession : JSON.stringify(gameSession);

    await Promise.all([
      redis.set(`system:${session.username}`, systemString),
      redis.set(`savedata:${session.username}:${sessionSlotId}`, sessionString)
    ]);

    return res.status(200).send("1"); // Client expects "1" on success
  } catch (error) {
    console.error("UpdateAll error:", error);
    return res.status(500).send("Internal server error");
  }
}
