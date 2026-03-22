/*
SPDX-FileCopyrightText: 2024-2026 Pagefault Games
SPDX-License-Identifier: AGPL-3.0-only
*/

import { createHash, randomBytes } from "crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Errors, sendSuccess } from "../../src/lib/errors";
import { getUser, setSession } from "../../src/lib/kv";
import { sanitizeString } from "../../src/lib/validation";

function hashPassword(password: string, salt: string): string {
  return createHash("sha256")
    .update(password + salt)
    .digest("hex");
}

function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return Errors.badRequest(res, "Method not allowed");
  }

  try {
    // Parse request body
    let username: string;
    let password: string;

    if (typeof req.body === "string") {
      const params = new URLSearchParams(req.body);
      username = params.get("username") || "";
      password = params.get("password") || "";
    } else if (req.body && typeof req.body === "object") {
      username = req.body.username || "";
      password = req.body.password || "";
    } else {
      return Errors.badRequest(res, "Missing request body");
    }

    // Sanitize username
    username = sanitizeString(username);

    if (!username || !password) {
      return Errors.badRequest(res, "Missing username or password");
    }

    // Get user data
    const userData = await getUser(username);

    if (!userData) {
      return Errors.unauthorized(res, "Invalid username or password");
    }

    // Verify password
    const user = userData as any;
    const hashedPassword = hashPassword(password, user.salt);

    if (hashedPassword !== user.password) {
      return Errors.unauthorized(res, "Invalid username or password");
    }

    // Create session
    const sessionToken = generateSessionToken();
    await setSession(sessionToken, {
      username,
      createdAt: Date.now(),
      lastLogin: Date.now(),
    });

    return sendSuccess(res, {
      token: sessionToken,
      username,
      message: "Login successful",
    });
  } catch (error) {
    console.error("Login error:", error);
    return Errors.internalError(res, "Failed to login");
  }
}
