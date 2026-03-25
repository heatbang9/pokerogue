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

    const sessionData = await redis.get(`session:${authHeader}`);
    if (!sessionData) {
      return res.status(401).send("Invalid or expired session");
    }

    const session = typeof sessionData === "string" ? JSON.parse(sessionData) : sessionData;

    // Get raw body data - client sends raw string
    let systemData: string;
    if (typeof req.body === "string") {
      systemData = req.body;
    } else if (typeof req.body === "object") {
      systemData = JSON.stringify(req.body);
    } else {
      return res.status(400).send("No system data provided");
    }

    if (!systemData) {
      return res.status(400).send("No system data provided");
    }

    // Save raw string to Redis
    await redis.set(`system:${session.username}`, systemData);

    return res.status(200).send("1"); // Client expects "1" on success
  } catch (error) {
    console.error("System update error:", error);
    return res.status(500).send("Internal server error");
  }
}
