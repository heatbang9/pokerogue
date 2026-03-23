import { Redis } from "@upstash/redis";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "",
});

interface UpdateProfileRequest {
  username?: string;
  email?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Cookie");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
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

  // Check if session is expired
  if (session.expiresAt && Date.now() > session.expiresAt) {
    await redis.del(`session:${sessionToken}`);
    return res.status(401).json({ error: "Session expired" });
  }

  try {
    if (req.method === "GET") {
      // Get user profile
      const user = await redis.get<any>(`user:${session.username.toLowerCase()}`);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      return res.status(200).json({
        user: {
          id: user.id,
          username: user.username,
          email: user.email || null,
          discordId: user.discordId || null,
          googleId: user.googleId || null,
          createdAt: user.createdAt,
          lastLogin: user.lastLogin,
          stats: user.stats || {
            gamesPlayed: 0,
            wins: 0,
            highestWave: 0,
          },
        },
      });
    }

    if (req.method === "PUT") {
      // Update user profile
      const { username, email } = req.body as UpdateProfileRequest;

      const user = await redis.get<any>(`user:${session.username.toLowerCase()}`);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // If username is being changed, check if new username is available
      if (username && username.toLowerCase() !== user.username.toLowerCase()) {
        const existingUser = await redis.get(`user:${username.toLowerCase()}`);
        if (existingUser) {
          return res.status(409).json({ error: "Username already taken" });
        }

        // Delete old username key
        await redis.del(`user:${user.username.toLowerCase()}`);

        // Update username
        user.username = username;

        // Update session
        session.username = username;
        await redis.set(`session:${sessionToken}`, session, { ex: 7 * 24 * 60 * 60 });
      }

      // Update email if provided
      if (email !== undefined) {
        user.email = email || null;
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

      return res.status(200).json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email || null,
          stats: user.stats,
        },
      });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Profile error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
