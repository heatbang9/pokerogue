import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSession, deleteSaveData } from '../_lib/kv';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get session token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header' });
    }

    // Get session data
    const sessionData = await getSession(authHeader);
    if (!sessionData || typeof sessionData !== 'object') {
      return res.status(401).json({ error: 'Invalid session' });
    }

    const username = (sessionData as any).username;
    if (!username) {
      return res.status(401).json({ error: 'Invalid session data' });
    }

    // Get request body
    const { dataType, slotId } = req.body;
    
    if (!dataType) {
      return res.status(400).json({ error: 'Missing dataType' });
    }

    const slot = slotId ?? 0;

    // Delete save data
    await deleteSaveData(username, dataType, slot);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Savedata delete error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
