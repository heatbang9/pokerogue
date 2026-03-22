/*
SPDX-FileCopyrightText: 2024-2026 Pagefault Games
SPDX-License-Identifier: AGPL-3.0-only
*/

import { createHash, randomBytes } from "crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getUser, setUser } from "../../src/lib/kv";

function hashPassword(password: string, salt: string): string {
  return createHash("sha256")
    .update(password + salt)
    .digest("hex");
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
    return res.status(405).send("Method not allowed");
  }

  try {
    // Parse form-urlencoded body
    let currentPassword: string;
    let newPassword: string;

    if (typeof req.body === "string") {
      const params = new URLSearchParams(req.body);
      currentPassword = params.get("currentPassword") || "";
      newPassword = params.get("newPassword") || "";
    } else if (req.body && typeof req.body === "object") {
      currentPassword = req.body.currentPassword || "";
      newPassword = req.body.newPassword || "";
    } else {
      return res.status(400).send("Missing password data");
    }

    // Get session from auth header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).send("No authorization header");
    }

    // For now, we need to find username from session
    // This is a simplified version - in production you'd verify the session
    const { getSession } = await import("../../src/lib/kv");
    const sessionData = await getSession(authHeader);
    if (!sessionData || typeof sessionData !== "object") {
      return res.status(401).send("Invalid session");
    }

    const username = (sessionData as any).username;
    if (!username) {
      return res.status(401).send("Invalid session data");
    }

    // Get user data
    const userData = await getUser(username);
    if (!userData) {
      return res.status(404).send("User not found");
    }

    const user = userData as any;

    // Verify current password
    const hashedCurrentPassword = hashPassword(currentPassword, user.salt);
    if (hashedCurrentPassword !== user.password) {
      return res.status(401).send("Current password is incorrect");
    }

    // Update password
    const newSalt = randomBytes(16).toString("hex");
    const hashedNewPassword = hashPassword(newPassword, newSalt);

    user.password = hashedNewPassword;
    user.salt = newSalt;

    await setUser(username, user);

    return res.status(200).send("Password changed successfully");
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).send("Internal server error");
  }
}
