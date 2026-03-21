import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '../lib/kv';

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
    // Get or initialize game stats
    let stats = await kv.get('game:stats');
    
    if (!stats) {
      stats = {
        totalPlayers: 0,
        totalRuns: 0,
        activePlayers: 0,
      };
    }

    return res.status(200).json(stats);
  } catch (error) {
    console.error('Title stats error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
