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
    const category = Number(req.query.category) || 0; // 0 = DAILY, 1 = WEEKLY
    const page = Number(req.query.page) || 1;

    const key = category === 0 ? `daily:rankings:${getDailySeed()}` : `daily:rankings:weekly:${getWeeklyKey()}`;

    const start = (page - 1) * ENTRIES_PER_PAGE;
    const end = start + ENTRIES_PER_PAGE - 1;

    // Get ranked entries from ZSET (highest scores first)
    const entries = await redis.zrange(key, start, end, { rev: true, withScores: true });

    if (!entries || entries.length === 0) {
      return res.status(200).json([]);
    }

    // Parse entries into RankingEntry format
    const rankings = [];
    for (let i = 0; i < entries.length; i += 2) {
      const member = entries[i] as string;
      const score = entries[i + 1] as number;

      // Parse member format: "username:wave:timestamp"
      const colonIndex = member.indexOf(":");
      const secondColonIndex = member.indexOf(":", colonIndex + 1);
      const username = member.substring(0, colonIndex);
      const wave = parseInt(member.substring(colonIndex + 1, secondColonIndex), 10) || 0;

      rankings.push({
        rank: start + Math.floor(i / 2) + 1,
        username,
        score,
        wave,
      });
    }

    return res.status(200).json(rankings);
  } catch (error) {
    console.error("Rankings error:", error);
    return res.status(200).json([]);
  }
}
