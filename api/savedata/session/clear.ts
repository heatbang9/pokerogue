import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSession, setSaveData } from "../../../src/lib/kv";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Get session token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "No authorization header", success: false });
    }

    // Get session data
    const sessionData = await getSession(authHeader);
    if (!sessionData || typeof sessionData !== "object") {
      return res.status(401).json({ error: "Invalid session", success: false });
    }

    const username = (sessionData as any).username;
    if (!username) {
      return res.status(401).json({ error: "Invalid session data", success: false });
    }

    // Get slot from query
    const { slot } = req.query;
    const slotId = typeof slot === "string" ? Number.parseInt(slot, 10) : 0;

    // Get body data (session data to save after clearing)
    const bodyData = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    // Mark as cleared and save
    if (bodyData) {
      bodyData.gameMode = bodyData.gameMode || {};
      bodyData.gameMode.isCleared = true;
      await setSaveData(username, "session", JSON.stringify(bodyData), slotId);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Session clear error:", error);
    return res.status(500).json({ error: "Internal server error", success: false });
  }
}
