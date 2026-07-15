type CacheEntry<T> = { value: T; expiresAt: number };
type RateState = { calls: number[]; blockedUntil: number };

const globalCache: Map<string, CacheEntry<unknown>> =
  (globalThis as any).__seller_ai_cache || new Map();
const globalInFlight: Map<string, Promise<unknown>> =
  (globalThis as any).__seller_ai_inflight || new Map();
const globalRate: Map<string, RateState> =
  (globalThis as any).__seller_ai_rate || new Map();

(globalThis as any).__seller_ai_cache = globalCache;
(globalThis as any).__seller_ai_inflight = globalInFlight;
(globalThis as any).__seller_ai_rate = globalRate;

export class RateLimitError extends Error {
  retryAfterMs: number;
  constructor(message: string, retryAfterMs: number) {
    super(message);
    this.retryAfterMs = retryAfterMs;
  }
}

export function getClientId(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for") || "";
  const realIp = req.headers.get("x-real-ip") || "";
  const ip = forwarded.split(",")[0]?.trim() || realIp || "unknown";
  return ip;
}

export function guardRateLimit(opts: {
  bucket: string;
  id: string;
  maxCalls: number;
  windowMs: number;
  blockMs: number;
}): void {
  const key = `${opts.bucket}:${opts.id}`;
  const now = Date.now();
  const entry: RateState = globalRate.get(key) || { calls: [], blockedUntil: 0 };

  if (entry.blockedUntil && now < entry.blockedUntil) {
    throw new RateLimitError("Rate limit active. Please wait before retrying.", entry.blockedUntil - now);
  }

  entry.calls = entry.calls.filter((ts) => now - ts < opts.windowMs);

  if (entry.calls.length >= opts.maxCalls) {
    entry.blockedUntil = now + opts.blockMs;
    globalRate.set(key, entry);
    throw new RateLimitError("Rate limit exceeded. Please wait before retrying.", opts.blockMs);
  }

  entry.calls.push(now);
  globalRate.set(key, entry);
}

export function rateLimitResponse(error: RateLimitError) {
  const retryAfterSeconds = Math.max(1, Math.ceil(error.retryAfterMs / 1000));
  return {
    retryAfterSeconds,
    headers: { "Retry-After": String(retryAfterSeconds) }
  };
}

export function getCache<T>(key: string): T | null {
  const entry = globalCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    globalCache.delete(key);
    return null;
  }
  return entry.value as T;
}

export function setCache<T>(key: string, value: T, ttlMs: number): void {
  globalCache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export async function withInFlight<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = globalInFlight.get(key);
  if (existing) return (await existing) as T;
  const promise = fn();
  globalInFlight.set(key, promise);
  try {
    return await promise;
  } finally {
    globalInFlight.delete(key);
  }
}

export function hashString(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16);
}
