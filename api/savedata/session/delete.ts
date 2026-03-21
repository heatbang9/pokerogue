import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSession, deleteSaveData } from '../../lib/kv';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
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

    // Get slot from query
    const { slot } = req.query;
    const slotId = typeof slot === 'string' ? parseInt(slot, 10) : 0;

    // Delete save data
    await deleteSaveData(username, 'session', slotId);

    return res.status(200).send('Session data deleted');
  } catch (error) {
    console.error('Session savedata delete error:', error);
    return res.status(500).send('Internal server error');
  }
}
