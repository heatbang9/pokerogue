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

    // Get raw body data
    const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body);

    // Save data
    await setSaveData(username, "system", rawBody, 0);

    return res.status(200).send("System data saved");
  } catch (error) {
    console.error("System savedata update error:", error);
    return res.status(500).send("Internal server error");
  }
}
