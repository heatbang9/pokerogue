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
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Cookie");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Get session from cookie or header
    const cookie = req.headers.cookie || "";
    const sessionMatch = cookie.match(/session=([^;]+)/);
    const sessionToken = sessionMatch ? sessionMatch[1] : req.headers.authorization?.replace("Bearer ", "");

    if (!sessionToken) {
      return res.status(401).json({ error: "No session" });
    }

    // Get session
    const session = await redis.get<any>(`session:${sessionToken}`);
    if (!session) {
      return res.status(401).json({ error: "Invalid session" });
    }

    // Check expiration
    const now = Date.now();
    if (now > session.expiresAt) {
      await redis.del(`session:${sessionToken}`);
      return res.status(401).json({ error: "Session expired" });
    }

    // Auto-refresh session if it's about to expire (within 24 hours)
    const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
    const REFRESH_THRESHOLD = 24 * 60 * 60 * 1000; // 24 hours before expiry
    const timeUntilExpiry = session.expiresAt - now;

    if (timeUntilExpiry < REFRESH_THRESHOLD) {
      const newExpiresAt = now + SESSION_DURATION;
      await redis.set(
        `session:${sessionToken}`,
        {
          ...session,
          expiresAt: newExpiresAt,
        },
        { ex: 7 * 24 * 60 * 60 },
      );
      // Update cookie with new expiry
      res.setHeader(
        "Set-Cookie",
        `session=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}`,
      );
    }

    // Get user data
    const user = await redis.get<any>(`user:${session.username}`);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt,
        stats: user.stats,
      },
    });
  } catch (error) {
    console.error("Me error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
