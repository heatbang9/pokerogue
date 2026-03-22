/*
SPDX-FileCopyrightText: 2024-2026 Pagefault Games
SPDX-License-Identifier: AGPL-3.0-only
*/

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSession, getUser, setSaveData, setUser } from "../../../src/lib/kv";

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
    // Get session token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).send("No authorization header");
    }

    // Get session data
    const sessionData = await getSession(authHeader);
    if (!sessionData || typeof sessionData !== "object") {
      return res.status(401).send("Invalid session");
    }

    const username = (sessionData as any).username;
    if (!username) {
      return res.status(401).send("Invalid session data");
    }

    // Get slot from query
    const { slot } = req.query;
    const slotId = typeof slot === "string" ? Number.parseInt(slot, 10) : 0;

    // Get raw body data
    const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body);

    // Save data
    await setSaveData(username, "session", rawBody, slotId);

    // Update user's last session slot
    const userData = await getUser(username);
    if (userData && typeof userData === "object") {
      (userData as any).lastSessionSlot = slotId;
      await setUser(username, userData);
    }

    return res.status(200).send("Session data saved");
  } catch (error) {
    console.error("Session savedata update error:", error);
    return res.status(500).send("Internal server error");
  }
}
