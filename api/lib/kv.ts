import { Redis } from "@upstash/redis";

export const kv = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Helper functions for common operations
export async function getUser(username: string) {
  return await kv.get(`user:${username}`);
}

export async function setUser(username: string, data: any) {
  return await kv.set(`user:${username}`, data);
}

export async function deleteUser(username: string) {
  return await kv.del(`user:${username}`);
}

export async function getSession(sessionId: string) {
  return await kv.get(`session:${sessionId}`);
}

export async function setSession(sessionId: string, data: any, ttlSeconds = 86400 * 30) {
  return await kv.set(`session:${sessionId}`, data, { ex: ttlSeconds });
}

export async function deleteSession(sessionId: string) {
  return await kv.del(`session:${sessionId}`);
}

export async function getSaveData(username: string, dataType: string, slotId = 0) {
  const key = `savedata:${username}:${dataType}:${slotId}`;
  return await kv.get(key);
}

export async function setSaveData(username: string, dataType: string, data: any, slotId = 0) {
  const key = `savedata:${username}:${dataType}:${slotId}`;
  return await kv.set(key, data);
}

export async function deleteSaveData(username: string, dataType: string, slotId = 0) {
  const key = `savedata:${username}:${dataType}:${slotId}`;
  return await kv.del(key);
}
