import type { VercelRequest, VercelResponse } from '@vercel/node';
import { deleteSession } from '../lib/kv';

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
    if (authHeader) {
      // Delete session
      await deleteSession(authHeader);
    }

    return res.status(200).send('Logged out successfully');
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).send('Internal server error');
  }
}
