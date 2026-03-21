import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSession, setSaveData, getUser, setUser } from '../_lib/kv';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  try {
    // Get session token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).send('No authorization header');
    }

    // Get session data
    const sessionData = await getSession(authHeader);
    if (!sessionData || typeof sessionData !== 'object') {
      return res.status(401).send('Invalid session');
    }

    const username = (sessionData as any).username;
    if (!username) {
      return res.status(401).send('Invalid session data');
    }

    // Get request body
    const { systemData, sessionData: sessionSlots, clientSessionId } = req.body;

    // Save system data
    if (systemData) {
      await setSaveData(username, 'system', systemData, 0);
    }

    // Save all session slots
    if (sessionSlots && typeof sessionSlots === 'object') {
      for (const [slotId, data] of Object.entries(sessionSlots)) {
        await setSaveData(username, 'session', data, parseInt(slotId, 10));
      }
    }

    // Update user's last session slot
    const userData = await getUser(username);
    if (userData && typeof userData === 'object') {
      (userData as any).lastSessionSlot = 0;
      await setUser(username, userData);
    }

    return res.status(200).send('All data saved');
  } catch (error) {
    console.error('Update all savedata error:', error);
    return res.status(500).send('Internal server error');
  }
}
