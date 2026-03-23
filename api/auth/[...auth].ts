import { Redis } from "@upstash/redis";
import type { VercelRequest, VercelResponse } from "@vercel/node";

// ============================================================================
// Crypto Utilities
// ============================================================================

function generateSalt(): string {
  const saltBytes = new Uint8Array(16);
  crypto.getRandomValues(saltBytes);
  return Array.from(saltBytes)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateToken(): string {
  const tokenBytes = new Uint8Array(32);
  crypto.getRandomValues(tokenBytes);
  return Array.from(tokenBytes)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), { name: "PBKDF2" }, false, [
    "deriveBits",
  ]);
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: encoder.encode(salt),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  );
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

async function verifyPassword(password: string, salt: string, hash: string): Promise<boolean> {
  const newHash = await hashPassword(password, salt);
  return newHash === hash;
}

async function legacyHashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "pokerogue_salt_2026");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

function validateUsername(username: string | undefined): { valid: boolean; error?: string } {
  if (!username) {
    return { valid: false, error: "Username is required" };
  }
  if (username.length < 3) {
    return { valid: false, error: "Username must be at least 3 characters" };
  }
  if (username.length > 20) {
    return { valid: false, error: "Username must be at most 20 characters" };
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return { valid: false, error: "Username can only contain letters, numbers, and underscores" };
  }
  return { valid: true };
}

function validatePassword(password: string | undefined): { valid: boolean; error?: string } {
  if (!password) {
    return { valid: false, error: "Password is required" };
  }
  if (password.length < 8) {
    return { valid: false, error: "Password must be at least 8 characters" };
  }
  return { valid: true };
}

function validateEmail(email: string | undefined): { valid: boolean; error?: string } {
  if (!email) {
    return { valid: true }; // Optional
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, error: "Invalid email format" };
  }
  return { valid: true };
}

// ============================================================================
// Rate Limiter
// ============================================================================

interface RateLimitConfig {
  windowMs: number;
  maxAttempts: number;
  blockDurationMs: number;
}

const LOGIN_RATE_LIMIT: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxAttempts: 5,
  blockDurationMs: 15 * 60 * 1000, // 15 minutes
};

const REGISTER_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60 * 60 * 1000, // 1 hour
  maxAttempts: 3,
  blockDurationMs: 60 * 60 * 1000, // 1 hour
};

function getClientIp(req: VercelRequest): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return "unknown";
}

function createRateLimitKey(ip: string, action: string, identifier?: string): string {
  return `ratelimit:${action}:${ip}${identifier ? `:${identifier}` : ""}`;
}

async function checkRateLimit(
  redis: Redis,
  key: string,
  config: RateLimitConfig,
): Promise<{ allowed: boolean; remaining: number; resetAt?: number; blockExpiresAt?: number }> {
  const now = Date.now();
  const blockKey = `${key}:blocked`;

  // Check if currently blocked
  const blockExpires = await redis.get<number>(blockKey);
  if (blockExpires && blockExpires > now) {
    return {
      allowed: false,
      remaining: 0,
      blockExpiresAt: blockExpires,
    };
  }

  // Get current attempt count
  const attempts = ((await redis.get<number>(key)) || 0) + 1;
  const windowStart = now - config.windowMs;

  if (attempts >= config.maxAttempts) {
    // Block the client
    const blockExpiresAt = now + config.blockDurationMs;
    await redis.set(blockKey, blockExpiresAt, { ex: Math.ceil(config.blockDurationMs / 1000) });
    return {
      allowed: false,
      remaining: 0,
      blockExpiresAt,
    };
  }

  // Increment attempts
  await redis.set(key, attempts, { ex: Math.ceil(config.windowMs / 1000) });

  return {
    allowed: true,
    remaining: config.maxAttempts - attempts,
    resetAt: windowStart + config.windowMs,
  };
}

async function resetRateLimit(redis: Redis, key: string): Promise<void> {
  await redis.del(key);
  await redis.del(`${key}:blocked`);
}

// ============================================================================
// Types
// ============================================================================

interface UserData {
  id: string;
  username: string;
  password: string;
  salt?: string;
  email?: string | null;
  createdAt: number;
  lastLogin: number;
  stats: {
    gamesPlayed: number;
    wins: number;
    highestWave: number;
    totalPokemonCaught?: number;
    totalTrainersDefeated?: number;
  };
}

interface SessionData {
  userId: string;
  username: string;
  createdAt: number;
  expiresAt: number;
}

// ============================================================================
// Redis Client
// ============================================================================

function getRedis(): Redis {
  return new Redis({
    url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "",
    token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "",
  });
}

// ============================================================================
// Auth Handlers
// ============================================================================

async function handleLogin(req: VercelRequest, res: VercelResponse, redis: Redis): Promise<void> {
  const clientIp = getClientIp(req);
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: "Username and password required" });
    return;
  }

  const normalizedUsername = username.toLowerCase();

  // Rate limiting
  const rateLimitKey = createRateLimitKey(clientIp, "login", normalizedUsername);
  const rateLimitResult = await checkRateLimit(redis, rateLimitKey, LOGIN_RATE_LIMIT);

  if (!rateLimitResult.allowed) {
    const retryAfter = rateLimitResult.blockExpiresAt
      ? Math.ceil((rateLimitResult.blockExpiresAt - Date.now()) / 1000)
      : 900;
    res.setHeader("Retry-After", retryAfter.toString());
    res.status(429).json({ error: "Too many login attempts", retryAfter });
    return;
  }

  const user = (await redis.get(`user:${normalizedUsername}`)) as UserData | null;
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  // Verify password
  let passwordValid = false;
  let needsMigration = false;

  if (user.salt) {
    passwordValid = await verifyPassword(password, user.salt, user.password);
  } else {
    const legacyHash = await legacyHashPassword(password);
    passwordValid = legacyHash === user.password;
    needsMigration = passwordValid;
  }

  if (!passwordValid) {
    res.status(401).json({ error: "Invalid credentials", remaining: rateLimitResult.remaining - 1 });
    return;
  }

  await resetRateLimit(redis, rateLimitKey);

  const now = Date.now();

  // Migrate password if needed
  if (needsMigration) {
    const newSalt = generateSalt();
    user.salt = newSalt;
    user.password = await hashPassword(password, newSalt);
  }

  user.lastLogin = now;
  await redis.set(`user:${normalizedUsername}`, user);

  // Create session
  const sessionToken = generateToken();
  await redis.set(
    `session:${sessionToken}`,
    { userId: user.id, username: normalizedUsername, createdAt: now, expiresAt: now + 7 * 24 * 60 * 60 * 1000 },
    { ex: 7 * 24 * 60 * 60 },
  );

  const existingSessions = ((await redis.get<string[]>(`user-sessions:${normalizedUsername}`)) || []) as string[];
  const updatedSessions = [...existingSessions, sessionToken].slice(-10);
  await redis.set(`user-sessions:${normalizedUsername}`, updatedSessions);

  res.setHeader(
    "Set-Cookie",
    `session=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}`,
  );

  res.status(200).json({
    success: true,
    user: { id: user.id, username: user.username, stats: user.stats },
    session: sessionToken,
  });
}

async function handleRegister(req: VercelRequest, res: VercelResponse, redis: Redis): Promise<void> {
  const clientIp = getClientIp(req);
  const { username, password, email } = req.body;

  // Validation
  const usernameValidation = validateUsername(username);
  if (!usernameValidation.valid) {
    res.status(400).json({ error: usernameValidation.error });
    return;
  }

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    res.status(400).json({ error: passwordValidation.error });
    return;
  }

  const emailValidation = validateEmail(email);
  if (!emailValidation.valid) {
    res.status(400).json({ error: emailValidation.error });
    return;
  }

  // Rate limiting
  const rateLimitKey = createRateLimitKey(clientIp, "register");
  const rateLimitResult = await checkRateLimit(redis, rateLimitKey, REGISTER_RATE_LIMIT);

  if (!rateLimitResult.allowed) {
    const retryAfter = rateLimitResult.blockExpiresAt
      ? Math.ceil((rateLimitResult.blockExpiresAt - Date.now()) / 1000)
      : 3600;
    res.setHeader("Retry-After", retryAfter.toString());
    res.status(429).json({ error: "Too many registration attempts", retryAfter });
    return;
  }

  const normalizedUsername = username.toLowerCase();

  const existingUser = await redis.get(`user:${normalizedUsername}`);
  if (existingUser) {
    res.status(409).json({ error: "Username already exists" });
    return;
  }

  // Create user
  const userId = crypto.randomUUID();
  const salt = generateSalt();
  const hashedPassword = await hashPassword(password, salt);
  const now = Date.now();

  const userData: UserData = {
    id: userId,
    username: normalizedUsername,
    password: hashedPassword,
    salt,
    email: email?.toLowerCase() || null,
    createdAt: now,
    lastLogin: now,
    stats: { gamesPlayed: 0, wins: 0, highestWave: 0 },
  };

  await redis.set(`user:${normalizedUsername}`, userData);
  await redis.set(`user:id:${userId}`, normalizedUsername);

  // Create session
  const sessionToken = generateToken();
  await redis.set(
    `session:${sessionToken}`,
    { userId, username: normalizedUsername, createdAt: now, expiresAt: now + 7 * 24 * 60 * 60 * 1000 },
    { ex: 7 * 24 * 60 * 60 },
  );

  res.setHeader(
    "Set-Cookie",
    `session=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}`,
  );

  res.status(201).json({
    success: true,
    user: { id: userId, username: normalizedUsername, createdAt: now },
    session: sessionToken,
  });
}

async function handleLogout(req: VercelRequest, res: VercelResponse, redis: Redis): Promise<void> {
  const sessionToken = req.cookies?.session || req.headers.authorization?.replace("Bearer ", "");

  if (sessionToken) {
    const session = (await redis.get(`session:${sessionToken}`)) as SessionData | null;
    if (session) {
      await redis.del(`session:${sessionToken}`);
      const sessions = ((await redis.get<string[]>(`user-sessions:${session.username}`)) || []) as string[];
      const updatedSessions = sessions.filter(s => s !== sessionToken);
      await redis.set(`user-sessions:${session.username}`, updatedSessions);
    }
  }

  res.setHeader("Set-Cookie", "session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0");
  res.status(200).json({ success: true, message: "Logged out successfully" });
}

async function handleMe(req: VercelRequest, res: VercelResponse, redis: Redis): Promise<void> {
  const sessionToken = req.cookies?.session || req.headers.authorization?.replace("Bearer ", "");

  if (!sessionToken) {
    res.status(401).json({ error: "No session provided" });
    return;
  }

  const session = (await redis.get(`session:${sessionToken}`)) as SessionData | null;

  if (!session || session.expiresAt < Date.now()) {
    res.status(401).json({ error: "Invalid or expired session" });
    return;
  }

  const user = (await redis.get(`user:${session.username}`)) as UserData | null;

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.status(200).json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      stats: user.stats,
    },
  });
}

async function handleProfile(req: VercelRequest, res: VercelResponse, redis: Redis): Promise<void> {
  const sessionToken = req.cookies?.session || req.headers.authorization?.replace("Bearer ", "");

  if (!sessionToken) {
    res.status(401).json({ error: "No session provided" });
    return;
  }

  const session = (await redis.get(`session:${sessionToken}`)) as SessionData | null;

  if (!session || session.expiresAt < Date.now()) {
    res.status(401).json({ error: "Invalid or expired session" });
    return;
  }

  if (req.method === "GET") {
    const user = (await redis.get(`user:${session.username}`)) as UserData | null;
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.status(200).json({ user: { id: user.id, username: user.username, email: user.email, stats: user.stats } });
    return;
  }

  if (req.method === "PUT") {
    const user = (await redis.get(`user:${session.username}`)) as UserData | null;
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const { email } = req.body;
    if (email !== undefined) {
      const emailValidation = validateEmail(email);
      if (!emailValidation.valid) {
        res.status(400).json({ error: emailValidation.error });
        return;
      }
      user.email = email?.toLowerCase() || null;
    }

    await redis.set(`user:${session.username}`, user);
    res.status(200).json({ success: true, user: { id: user.id, username: user.username, email: user.email } });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}

async function handleSessions(req: VercelRequest, res: VercelResponse, redis: Redis): Promise<void> {
  const sessionToken = req.cookies?.session || req.headers.authorization?.replace("Bearer ", "");

  if (!sessionToken) {
    res.status(401).json({ error: "No session provided" });
    return;
  }

  const currentSession = (await redis.get(`session:${sessionToken}`)) as SessionData | null;

  if (!currentSession || currentSession.expiresAt < Date.now()) {
    res.status(401).json({ error: "Invalid or expired session" });
    return;
  }

  if (req.method === "GET") {
    const sessionTokens = ((await redis.get<string[]>(`user-sessions:${currentSession.username}`)) || []) as string[];
    const sessions: Array<{ id: string; createdAt: number; expiresAt: number; current: boolean }> = [];

    for (const token of sessionTokens) {
      const session = (await redis.get(`session:${token}`)) as SessionData | null;
      if (session && session.expiresAt > Date.now()) {
        sessions.push({
          id: token.substring(0, 8),
          createdAt: session.createdAt,
          expiresAt: session.expiresAt,
          current: token === sessionToken,
        });
      }
    }

    res.status(200).json({ sessions });
    return;
  }

  if (req.method === "DELETE") {
    const { sessionId } = req.body;

    if (!sessionId) {
      res.status(400).json({ error: "Session ID required" });
      return;
    }

    const sessionTokens = ((await redis.get<string[]>(`user-sessions:${currentSession.username}`)) || []) as string[];
    const targetToken = sessionTokens.find(t => t.startsWith(sessionId));

    if (!targetToken) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    if (targetToken === sessionToken) {
      res.status(400).json({ error: "Cannot revoke current session. Use logout instead." });
      return;
    }

    await redis.del(`session:${targetToken}`);
    const updatedSessions = sessionTokens.filter(t => t !== targetToken);
    await redis.set(`user-sessions:${currentSession.username}`, updatedSessions);

    res.status(200).json({ success: true, message: "Session revoked" });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}

async function handleChangePassword(req: VercelRequest, res: VercelResponse, redis: Redis): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const sessionToken = req.cookies?.session || req.headers.authorization?.replace("Bearer ", "");

  if (!sessionToken) {
    res.status(401).json({ error: "No session provided" });
    return;
  }

  const session = (await redis.get(`session:${sessionToken}`)) as SessionData | null;

  if (!session || session.expiresAt < Date.now()) {
    res.status(401).json({ error: "Invalid or expired session" });
    return;
  }

  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "Current and new password required" });
    return;
  }

  const passwordValidation = validatePassword(newPassword);
  if (!passwordValidation.valid) {
    res.status(400).json({ error: passwordValidation.error });
    return;
  }

  const user = (await redis.get(`user:${session.username}`)) as UserData | null;
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  // Verify current password
  let passwordValid = false;
  if (user.salt) {
    passwordValid = await verifyPassword(currentPassword, user.salt, user.password);
  } else {
    const legacyHash = await legacyHashPassword(currentPassword);
    passwordValid = legacyHash === user.password;
  }

  if (!passwordValid) {
    res.status(401).json({ error: "Current password is incorrect" });
    return;
  }

  // Update password
  const newSalt = generateSalt();
  user.salt = newSalt;
  user.password = await hashPassword(newPassword, newSalt);
  await redis.set(`user:${session.username}`, user);

  res.status(200).json({ success: true, message: "Password changed successfully" });
}

async function handleStats(req: VercelRequest, res: VercelResponse, redis: Redis): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const sessionToken = req.cookies?.session || req.headers.authorization?.replace("Bearer ", "");

  if (!sessionToken) {
    res.status(401).json({ error: "No session provided" });
    return;
  }

  const session = (await redis.get(`session:${sessionToken}`)) as SessionData | null;

  if (!session || session.expiresAt < Date.now()) {
    res.status(401).json({ error: "Invalid or expired session" });
    return;
  }

  const user = (await redis.get(`user:${session.username}`)) as UserData | null;
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const { gamesPlayed, wins, highestWave, totalPokemonCaught, totalTrainersDefeated } = req.body;

  if (gamesPlayed !== undefined) {
    user.stats.gamesPlayed += gamesPlayed;
  }
  if (wins !== undefined) {
    user.stats.wins += wins;
  }
  if (highestWave !== undefined && highestWave > user.stats.highestWave) {
    user.stats.highestWave = highestWave;
  }
  if (totalPokemonCaught !== undefined) {
    user.stats.totalPokemonCaught = (user.stats.totalPokemonCaught || 0) + totalPokemonCaught;
  }
  if (totalTrainersDefeated !== undefined) {
    user.stats.totalTrainersDefeated = (user.stats.totalTrainersDefeated || 0) + totalTrainersDefeated;
  }

  await redis.set(`user:${session.username}`, user);

  res.status(200).json({ success: true, stats: user.stats });
}

async function handleLeaderboard(req: VercelRequest, res: VercelResponse, redis: Redis): Promise<void> {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const limit = Math.min(Number.parseInt(req.query.limit as string) || 10, 100);
  const offset = Number.parseInt(req.query.offset as string) || 0;

  // Get all user keys
  const userKeys = await redis.keys("user:*");
  const users: Array<{ username: string; stats: UserData["stats"] }> = [];

  for (const key of userKeys) {
    if (key.includes(":id:")) {
      continue;
    }
    const user = (await redis.get(key)) as UserData | null;
    if (user) {
      users.push({ username: user.username, stats: user.stats });
    }
  }

  // Sort by highest wave
  users.sort((a, b) => b.stats.highestWave - a.stats.highestWave);
  const leaderboard = users.slice(offset, offset + limit);

  res.status(200).json({
    leaderboard: leaderboard.map((u, i) => ({
      rank: offset + i + 1,
      username: u.username,
      highestWave: u.stats.highestWave,
      wins: u.stats.wins,
      gamesPlayed: u.stats.gamesPlayed,
    })),
    total: users.length,
  });
}

async function handleOAuthCallback(
  req: VercelRequest,
  res: VercelResponse,
  redis: Redis,
  provider: string,
): Promise<void> {
  const { code } = req.query;

  if (!code || typeof code !== "string") {
    res.status(400).json({ error: "Authorization code required" });
    return;
  }

  try {
    let userInfo: { id: string; username: string; email?: string };

    if (provider === "discord") {
      // Exchange code for access token
      const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.DISCORD_CLIENT_ID || "",
          client_secret: process.env.DISCORD_CLIENT_SECRET || "",
          code,
          grant_type: "authorization_code",
          redirect_uri: `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:8000"}/api/auth/discord/callback`,
        }),
      });

      if (!tokenResponse.ok) {
        throw new Error("Failed to exchange Discord code");
      }

      const tokenData = await tokenResponse.json();

      // Get user info
      const userResponse = await fetch("https://discord.com/api/users/@me", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });

      if (!userResponse.ok) {
        throw new Error("Failed to fetch Discord user info");
      }

      const userData = await userResponse.json();
      userInfo = {
        id: userData.id,
        username: userData.username,
        email: userData.email,
      };
    } else if (provider === "google") {
      // Exchange code for access token
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID || "",
          client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
          code,
          grant_type: "authorization_code",
          redirect_uri: `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:8000"}/api/auth/google/callback`,
        }),
      });

      if (!tokenResponse.ok) {
        throw new Error("Failed to exchange Google code");
      }

      const tokenData = await tokenResponse.json();

      // Get user info
      const userResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });

      if (!userResponse.ok) {
        throw new Error("Failed to fetch Google user info");
      }

      const userData = await userResponse.json();
      userInfo = {
        id: userData.id,
        username: userData.name || userData.email.split("@")[0],
        email: userData.email,
      };
    } else {
      res.status(400).json({ error: "Invalid OAuth provider" });
      return;
    }

    // Check if user exists with this OAuth ID
    const oauthKey = `oauth:${provider}:${userInfo.id}`;
    let existingUserId = await redis.get(oauthKey);
    let user: UserData;

    if (existingUserId) {
      // User exists, fetch their data
      user = (await redis.get(`user:${existingUserId}`)) as UserData;
      if (!user) {
        // User data missing, create new
        existingUserId = null;
      }
    }

    if (!existingUserId) {
      // Check if username is taken
      const normalizedUsername = userInfo.username.toLowerCase();
      let finalUsername = normalizedUsername;
      let counter = 1;

      while (await redis.get(`user:${finalUsername}`)) {
        finalUsername = `${normalizedUsername}${counter}`;
        counter++;
      }

      // Create new user
      const now = Date.now();
      user = {
        id: generateToken(),
        username: finalUsername,
        password: "", // No password for OAuth users
        salt: "",
        email: userInfo.email?.toLowerCase() || null,
        createdAt: now,
        lastLogin: now,
        stats: {
          gamesPlayed: 0,
          wins: 0,
          highestWave: 0,
          totalPokemonCaught: 0,
          totalTrainersDefeated: 0,
        },
      };

      await redis.set(`user:${finalUsername}`, user);
      await redis.set(oauthKey, finalUsername);
    }

    // Update last login
    user.lastLogin = Date.now();
    await redis.set(`user:${user.username}`, user);

    // Create session
    const sessionToken = generateToken();
    const now = Date.now();
    await redis.set(
      `session:${sessionToken}`,
      { userId: user.id, username: user.username, createdAt: now, expiresAt: now + 7 * 24 * 60 * 60 * 1000 },
      { ex: 7 * 24 * 60 * 60 },
    );

    const existingSessions = ((await redis.get<string[]>(`user-sessions:${user.username}`)) || []) as string[];
    const updatedSessions = [...existingSessions, sessionToken].slice(-10);
    await redis.set(`user-sessions:${user.username}`, updatedSessions);

    // Set session cookie
    res.setHeader(
      "Set-Cookie",
      `session=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}`,
    );

    // Redirect to main app
    const redirectUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:8000";
    res.redirect(302, redirectUrl);
  } catch (error) {
    console.error(`${provider} OAuth error:`, error);
    res.status(500).json({ error: `${provider} authentication failed` });
  }
}

// ============================================================================
// Main Handler
// ============================================================================

// biome-ignore lint/style/noDefaultExport: Vercel serverless functions require default export
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const redis = getRedis();

  // Parse the path to determine the action
  const auth = req.query.auth as string[] | undefined;
  const action = Array.isArray(auth) ? auth[0] : auth || "me";

  try {
    switch (action) {
      case "login":
        return await handleLogin(req, res, redis);
      case "register":
        return await handleRegister(req, res, redis);
      case "logout":
        return await handleLogout(req, res, redis);
      case "me":
        return await handleMe(req, res, redis);
      case "profile":
        return await handleProfile(req, res, redis);
      case "sessions":
        return await handleSessions(req, res, redis);
      case "change-password":
        return await handleChangePassword(req, res, redis);
      case "stats":
        return await handleStats(req, res, redis);
      case "leaderboard":
        return await handleLeaderboard(req, res, redis);
      case "discord":
        if (auth?.[1] === "callback") {
          return await handleOAuthCallback(req, res, redis, "discord");
        }
        break;
      case "google":
        if (auth?.[1] === "callback") {
          return await handleOAuthCallback(req, res, redis, "google");
        }
        break;
    }

    res.status(404).json({ error: "Not found" });
  } catch (error) {
    console.error("Auth API error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
