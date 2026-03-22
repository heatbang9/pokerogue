/*
SPDX-FileCopyrightText: 2024-2026 Pagefault Games
SPDX-License-Identifier: AGPL-3.0-only
*/

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Errors, sendSuccess } from "../../src/lib/errors";
import { getSession, getUser } from "../../src/lib/kv";

/**
 * Get user profile information
 * Requires valid session token in Authorization header
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return Errors.badRequest(res, "Method not allowed");
  }

  try {
    // Get session token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return Errors.unauthorized(res, "No authorization header");
    }

    // Get session data
    const sessionData = await getSession(authHeader);
    if (!sessionData || typeof sessionData !== "object") {
      return Errors.unauthorized(res, "Invalid or expired session");
    }

    const username = (sessionData as any).username;
    if (!username) {
      return Errors.unauthorized(res, "Invalid session data");
    }

    // Get user data
    const userData = await getUser(username);
    if (!userData) {
      return Errors.notFound(res, "User not found");
    }

    const user = userData as any;

    // Return public profile data (exclude sensitive information)
    const profile = {
      username: user.username,
      createdAt: user.createdAt,
      lastSessionSlot: user.lastSessionSlot,
      hasAdminRole: user.hasAdminRole || false,
      // Don't expose: password, salt, discordId, googleId
    };

    return sendSuccess(res, profile);
  } catch (error) {
    console.error("Profile error:", error);
    return Errors.internalError(res, "Failed to get profile");
  }
}
