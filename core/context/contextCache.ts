import crypto from "crypto";

const cache = new Map<string, { data: unknown; ts: number }>();
const TTL_MS = 5 * 60 * 1000; // 5 minutes

export function createKey(input: string, hash: string): string {
  return crypto.createHash("md5").update(`${input}::${hash}`).digest("hex");
}

export function getCache(key: string): unknown | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCache(key: string, data: unknown): void {
  cache.set(key, { data, ts: Date.now() });
}
