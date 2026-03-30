// SPDX-FileCopyrightText: 2025 The Pokerogue Team
// SPDX-License-Identifier: AGPL-3.0-only

import { Redis } from "@upstash/redis";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "",
});

const ENTRIES_PER_PAGE = 10;

function getDailySeed(): string {
  return new Date().toISOString().split("T")[0].replace(/-/g, "");
}

function getWeeklyKey(): string {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().split("T")[0].replace(/-/g, "");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const category = Number(req.query.category) || 0;

    const key = category === 0 ? `daily:rankings:${getDailySeed()}` : `daily:rankings:weekly:${getWeeklyKey()}`;

    const totalCount = await redis.zcard(key);
    const pageCount = Math.max(1, Math.ceil(totalCount / ENTRIES_PER_PAGE));

    return res.status(200).send(pageCount.toString());
  } catch (error) {
    console.error("Ranking page count error:", error);
    return res.status(200).send("1");
  }
}
