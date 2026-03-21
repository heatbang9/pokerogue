import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUser, setSession } from '../lib/kv';
import { randomBytes, createHash } from 'crypto';

function hashPassword(password: string, salt: string): string {
  return createHash('sha256').update(password + salt).digest('hex');
}

function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

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
    // Parse form-urlencoded body
    let username: string, password: string;
    
    if (typeof req.body === 'string') {
      const params = new URLSearchParams(req.body);
      username = params.get('username') || '';
      password = params.get('password') || '';
    } else if (req.body && typeof req.body === 'object') {
      username = req.body.username || '';
      password = req.body.password || '';
    } else {
      return res.status(400).send('Missing username or password');
    }

    if (!username || !password) {
      return res.status(400).send('Missing username or password');
    }

    // Check if user exists
    const userData = await getUser(username);

    if (!userData) {
      return res.status(401).send('Invalid username or password');
    }

    // Verify password
    const user = userData as any;
    const hashedPassword = hashPassword(password, user.salt);
    
    if (hashedPassword !== user.password) {
      return res.status(401).send('Invalid username or password');
    }

    // Create session
    const sessionToken = generateSessionToken();
    await setSession(sessionToken, { username, createdAt: Date.now() });

    return res.status(200).json({ 
      token: sessionToken,
      username 
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).send('Internal server error');
  }
}
