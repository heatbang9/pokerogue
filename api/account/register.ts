import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUser, setUser } from '../lib/kv';
import { randomBytes, createHash } from 'crypto';

function hashPassword(password: string, salt: string): string {
  return createHash('sha256').update(password + salt).digest('hex');
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

    // Validate username
    if (username.length < 3 || username.length > 20) {
      return res.status(400).send('Username must be 3-20 characters');
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).send('Username can only contain letters, numbers, and underscores');
    }

    // Check if user exists
    const existingUser = await getUser(username);

    if (existingUser) {
      return res.status(400).send('Username already exists');
    }

    // Create new user
    const salt = randomBytes(16).toString('hex');
    const hashedPassword = hashPassword(password, salt);
    
    const userData = {
      username,
      password: hashedPassword,
      salt,
      lastSessionSlot: -1,
      discordId: '',
      googleId: '',
      hasAdminRole: false,
      createdAt: Date.now(),
    };
    
    await setUser(username, userData);

    return res.status(200).send('Account created successfully');
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).send('Internal server error');
  }
}
