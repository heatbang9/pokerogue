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
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      type = "alltime",
      limit = 10,
      date,
    } = req.query as {
      type?: "alltime" | "daily" | "wins";
      limit?: string;
      date?: string;
    };

    const limitNum = Math.min(Math.max(Number.parseInt(limit as string) || 10, 1), 100);

    let leaderboardKey: string;

    if (type === "daily") {
      // Use provided date or today's date
      const dateKey = date || getDateKey();
      leaderboardKey = `leaderboard:daily:${dateKey}`;
    } else if (type === "wins") {
      leaderboardKey = "leaderboard:wins";
    } else {
      leaderboardKey = "leaderboard:alltime";
    }

    // Get leaderboard entries (highest scores first)
    const entries = await redis.zrange(leaderboardKey, 0, limitNum - 1, {
      rev: true,
      withScores: true,
    });

    // Format response
    const leaderboard: { rank: number; username: string; score: number }[] = [];
    for (let i = 0; i < entries.length; i += 2) {
      const member = entries[i] as string;
      const score = entries[i + 1] as number;

      leaderboard.push({
        rank: Math.floor(i / 2) + 1,
        username: member,
        score,
      });
    }

    return res.status(200).json({
      type,
      date: type === "daily" ? date || getDateKey() : undefined,
      leaderboard,
    });
  } catch (error) {
    console.error("Leaderboard error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

function getDateKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
