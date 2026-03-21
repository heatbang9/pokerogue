import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUser, setUser, setSession } from '../_lib/kv';
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
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Missing username or password' });
    }

    // Validate username
    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: 'Username must be 3-20 characters' });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores' });
    }

    // Check if user exists
    const existingUser = await getUser(username);

    if (existingUser) {
      // Login - verify password
      const userData = existingUser as any;
      const hashedPassword = hashPassword(password, userData.salt);
      
      if (hashedPassword !== userData.password) {
        return res.status(401).json({ error: 'Invalid password' });
      }
    } else {
      // Register - create new user
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
    }

    // Create session
    const sessionToken = generateSessionToken();
    await setSession(sessionToken, { username, createdAt: Date.now() });

    return res.status(200).json({ 
      success: true, 
      token: sessionToken,
      username 
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
