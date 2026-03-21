import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSaveData, getSession } from "../../../src/lib/kv";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
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

    // Get save data
    const saveData = await getSaveData(username, "system", 0);

    if (!saveData) {
      return res.status(404).send("No save data found");
    }

    // Return raw string data (like original API)
    return res.status(200).send(saveData);
  } catch (error) {
    console.error("System savedata get error:", error);
    return res.status(500).send("Internal server error");
  }
}
