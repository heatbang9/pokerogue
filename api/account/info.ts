import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSession, getUser } from '../lib/kv';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
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

    // Get user data
    const userData = await getUser(username);
    
    if (!userData) {
      // Return default user info for new users
      return res.status(200).json({
        username,
        lastSessionSlot: -1,
        discordId: '',
        googleId: '',
        hasAdminRole: false,
      });
    }

    return res.status(200).json(userData);
  } catch (error) {
    console.error('Account info error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
