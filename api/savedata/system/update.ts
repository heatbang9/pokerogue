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
      return res.status(401).json({ status: "error", error: "No authorization token" });
    }

    const sessionData = await redis.get(`session:${authHeader}`);
    if (!sessionData) {
      return res.status(401).json({ status: "error", error: "Invalid or expired session" });
    }

    const session = typeof sessionData === "string" ? JSON.parse(sessionData) : sessionData;

    let systemData: any = null;
    if (typeof req.body === "object" && req.body !== null) {
      systemData = req.body.system || req.body;
    } else if (typeof req.body === "string") {
      const params = new URLSearchParams(req.body);
      const system = params.get("system");
      if (system) {
        try {
          systemData = JSON.parse(system);
        } catch {
          systemData = req.body;
        }
      }
    }

    if (!systemData) {
      return res.status(400).json({ status: "error", error: "No system data provided" });
    }

    await redis.set(`system:${session.username}`, JSON.stringify(systemData));

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("System update error:", error);
    return res.status(500).json({ status: "error", error: "Internal server error" });
  }
}
