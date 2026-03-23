import { Redis } from "@upstash/redis";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "",
});

interface UpdateStatsRequest {
  wave?: number;
  win?: boolean;
  pokemonCaught?: number;
  trainersDefeated?: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Cookie");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Get session from cookie
  const cookies = req.headers.cookie || "";
  const sessionMatch = cookies.match(/session=([^;]+)/);
  const sessionToken = sessionMatch ? sessionMatch[1] : null;

  if (!sessionToken) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  // Get session data
  const session = await redis.get<any>(`session:${sessionToken}`);
  if (!session) {
    return res.status(401).json({ error: "Invalid session" });
  }

  try {
    const { wave, win, pokemonCaught, trainersDefeated } = req.body as UpdateStatsRequest;

    const user = await redis.get<any>(`user:${session.username.toLowerCase()}`);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Initialize stats if not present
    if (!user.stats) {
      user.stats = {
        gamesPlayed: 0,
        wins: 0,
        highestWave: 0,
        totalPokemonCaught: 0,
        totalTrainersDefeated: 0,
      };
    }

    // Update stats
    user.stats.gamesPlayed += 1;

    if (win) {
      user.stats.wins += 1;
    }

    if (wave && wave > user.stats.highestWave) {
      user.stats.highestWave = wave;
    }

    if (pokemonCaught) {
      user.stats.totalPokemonCaught = (user.stats.totalPokemonCaught || 0) + pokemonCaught;
    }

    if (trainersDefeated) {
      user.stats.totalTrainersDefeated = (user.stats.totalTrainersDefeated || 0) + trainersDefeated;
    }

    // Save updated user
    await redis.set(`user:${user.username.toLowerCase()}`, user);

    // Also update OAuth-specific keys if they exist
    if (user.discordId) {
      await redis.set(`discord:${user.discordId}`, user);
    }
    if (user.googleId) {
      await redis.set(`google:${user.googleId}`, user);
    }

    // Update leaderboard if applicable
    if (wave && wave > 0) {
      await updateLeaderboard(user.username, wave, win);
    }

    return res.status(200).json({
      success: true,
      stats: user.stats,
    });
  } catch (error) {
    console.error("Stats update error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function updateLeaderboard(username: string, wave: number, win: boolean): Promise<void> {
  const now = new Date();
  const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  // Daily leaderboard
  await redis.zadd(`leaderboard:daily:${dateKey}`, { score: wave, member: username });

  // All-time leaderboard
  const existingScore = await redis.zscore("leaderboard:alltime", username);
  if (!existingScore || wave > existingScore) {
    await redis.zadd("leaderboard:alltime", { score: wave, member: username });
  }

  // Wins leaderboard
  if (win) {
    const currentWins = (await redis.zscore("leaderboard:wins", username)) || 0;
    await redis.zadd("leaderboard:wins", { score: currentWins + 1, member: username });
  }
}
