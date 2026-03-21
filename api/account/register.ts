/*
SPDX-FileCopyrightText: 2024-2026 Pagefault Games
SPDX-License-Identifier: AGPL-3.0-only
*/

import { createHash, randomBytes } from "crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Errors, sendSuccess } from "../../src/lib/errors";
import { getUser, setUser } from "../../src/lib/kv";
import { sanitizeString, validatePassword, validateUsername } from "../../src/lib/validation";

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

    // Sanitize inputs
    username = sanitizeString(username);

    // Validate username
    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid) {
      return Errors.validationError(res, usernameValidation.error!);
    }

    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return Errors.validationError(res, passwordValidation.error!);
    }

    // Check if user already exists
    const existingUser = await getUser(username);
    if (existingUser) {
      return Errors.conflict(res, "Username already exists");
    }

    // Create new user
    const salt = randomBytes(16).toString("hex");
    const hashedPassword = hashPassword(password, salt);

    const userData = {
      username,
      password: hashedPassword,
      salt,
      lastSessionSlot: -1,
      discordId: "",
      googleId: "",
      hasAdminRole: false,
      createdAt: Date.now(),
    };

    await setUser(username, userData);

    return sendSuccess(res, {
      message: "Account created successfully",
      username,
    });
  } catch (error) {
    console.error("Register error:", error);
    return Errors.internalError(res, "Failed to create account");
  }
}
