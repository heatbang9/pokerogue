/*
SPDX-FileCopyrightText: 2024-2026 Pagefault Games
SPDX-License-Identifier: AGPL-3.0-only
*/

import { createHash } from "crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Errors, sendSuccess } from "../../src/lib/errors";
import { deleteSaveData, deleteSession, deleteUser, getSession, getUser } from "../../src/lib/kv";

function hashPassword(password: string, salt: string): string {
  return createHash("sha256")
    .update(password + salt)
    .digest("hex");
}

/**
 * Delete user account and all associated data
 * Requires valid session token and password confirmation
 */
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

    // Parse request body to get password confirmation
    let password: string;

    if (typeof req.body === "string") {
      const params = new URLSearchParams(req.body);
      password = params.get("password") || "";
    } else if (req.body && typeof req.body === "object") {
      password = req.body.password || "";
    } else {
      return Errors.badRequest(res, "Missing password confirmation");
    }

    if (!password) {
      return Errors.badRequest(res, "Password confirmation required");
    }

    // Get user data and verify password
    const userData = await getUser(username);
    if (!userData) {
      return Errors.notFound(res, "User not found");
    }

    const user = userData as any;
    const hashedPassword = hashPassword(password, user.salt);

    if (hashedPassword !== user.password) {
      return Errors.unauthorized(res, "Invalid password");
    }

    // Delete all save data (system and all session slots)
    await deleteSaveData(username, "system", 0);
    for (let slotId = 0; slotId < 5; slotId++) {
      await deleteSaveData(username, "session", slotId);
    }

    // Delete session
    await deleteSession(authHeader);

    // Delete user account
    await deleteUser(username);

    return sendSuccess(res, {
      message: "Account deleted successfully",
      username,
    });
  } catch (error) {
    console.error("Delete account error:", error);
    return Errors.internalError(res, "Failed to delete account");
  }
}
