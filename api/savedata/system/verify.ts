import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSession, getSaveData } from '../../_lib/kv';

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
      return res.status(401).json({ valid: false });
    }

    // Get session data
    const sessionData = await getSession(authHeader);
    if (!sessionData || typeof sessionData !== 'object') {
      return res.status(200).json({ valid: false });
    }

    const username = (sessionData as any).username;
    if (!username) {
      return res.status(200).json({ valid: false });
    }

    // Get query parameters
    const { slot } = req.query;
    const slotId = typeof slot === 'string' ? parseInt(slot, 10) : 0;

    // Get save data to verify
    const saveData = await getSaveData(username, 'system', slotId);
    
    if (!saveData) {
      return res.status(200).json({ 
        valid: false, 
        systemData: null 
      });
    }

    return res.status(200).json({ 
      valid: true, 
      systemData: saveData 
    });
  } catch (error) {
    console.error('System savedata verify error:', error);
    return res.status(200).json({ valid: false });
  }
}
