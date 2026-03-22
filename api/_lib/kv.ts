/*
SPDX-FileCopyrightText: 2024-2026 Pagefault Games
SPDX-License-Identifier: AGPL-3.0-only
*/

import { Redis } from "@upstash/redis";

// Initialize Redis client with Vercel KV environment variables
const redisUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

if (!redisUrl || !redisToken) {
  console.error("Missing Redis environment variables!");
  console.error("KV_REST_API_URL:", redisUrl ? "exists" : "missing");
  console.error("KV_REST_API_TOKEN:", redisToken ? "exists" : "missing");
}

export const kv = new Redis({
  url: redisUrl!,
  token: redisToken!,
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
