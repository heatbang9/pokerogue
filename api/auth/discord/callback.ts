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

  const { code } = req.query;

  if (!code || typeof code !== "string") {
    return res.status(400).json({ error: "Authorization code required" });
  }

  try {
    // Exchange code for access token
    const clientId = process.env.VITE_DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;
    const redirectUri = `${process.env.VITE_SERVER_URL}/auth/discord/callback`;

    if (!clientId || !clientSecret) {
      return res.status(500).json({ error: "Discord OAuth not configured" });
    }

    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      console.error("Discord token exchange failed:", await tokenResponse.text());
      return res.status(400).json({ error: "Failed to exchange authorization code" });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Get user info from Discord
    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userResponse.ok) {
      return res.status(400).json({ error: "Failed to fetch user info" });
    }

    const discordUser = await userResponse.json();
    const discordId = discordUser.id;
    const username = discordUser.username;

    // Check if user exists, if not create one
    let user = await redis.get<any>(`discord:${discordId}`);

    if (user) {
      // Update last login
      const now = Date.now();
      user.lastLogin = now;
      await redis.set(`discord:${discordId}`, user);
      await redis.set(`user:${user.username.toLowerCase()}`, user);
    } else {
      // Create new user from Discord
      const userId = generateUserId();
      const now = Date.now();

      user = {
        id: userId,
        username,
        discordId,
        createdAt: now,
        lastLogin: now,
        stats: {
          gamesPlayed: 0,
          wins: 0,
          highestWave: 0,
        },
      };

      await redis.set(`discord:${discordId}`, user);
      await redis.set(`user:${username.toLowerCase()}`, user);
    }

    // Create session
    const sessionToken = generateToken();
    await redis.set(
      `session:${sessionToken}`,
      {
        userId: user.id,
        username: user.username,
        createdAt: Date.now(),
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      },
      { ex: 7 * 24 * 60 * 60 },
    );

    // Set cookie and redirect to home
    res.setHeader(
      "Set-Cookie",
      `session=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}`,
    );

    // Redirect to home page
    return res.redirect(302, "/");
  } catch (error) {
    console.error("Discord OAuth error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateUserId(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}
