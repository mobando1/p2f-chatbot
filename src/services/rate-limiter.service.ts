interface RateBucket {
  tokens: number;
  lastRefill: number;
}

const sessionBuckets = new Map<string, RateBucket>();
const ipBuckets = new Map<string, RateBucket>();

const SESSION_MAX_TOKENS = 10; // max messages per window per session
const SESSION_REFILL_RATE = 10; // tokens per minute

const IP_MAX_TOKENS = 30; // max messages per window per IP (higher to allow multiple sessions)
const IP_REFILL_RATE = 30; // tokens per minute

function checkBucket(
  buckets: Map<string, RateBucket>,
  key: string,
  maxTokens: number,
  refillRate: number,
): boolean {
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket) {
    bucket = { tokens: maxTokens, lastRefill: now };
    buckets.set(key, bucket);
  }

  // Refill tokens based on elapsed time
  const elapsed = (now - bucket.lastRefill) / 60000; // minutes
  bucket.tokens = Math.min(maxTokens, bucket.tokens + elapsed * refillRate);
  bucket.lastRefill = now;

  if (bucket.tokens < 1) {
    return false; // rate limited
  }

  bucket.tokens -= 1;
  return true;
}

/** Check both session-based and IP-based rate limits */
export function checkRateLimit(sessionId: string, ip?: string): boolean {
  const sessionOk = checkBucket(sessionBuckets, sessionId, SESSION_MAX_TOKENS, SESSION_REFILL_RATE);
  if (!sessionOk) return false;

  // IP-based rate limiting as a second layer (prevents sessionId cycling)
  if (ip) {
    const ipOk = checkBucket(ipBuckets, ip, IP_MAX_TOKENS, IP_REFILL_RATE);
    if (!ipOk) return false;
  }

  return true;
}

// Clean up stale buckets every 10 minutes
setInterval(() => {
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
  for (const [id, bucket] of sessionBuckets) {
    if (bucket.lastRefill < tenMinutesAgo) sessionBuckets.delete(id);
  }
  for (const [id, bucket] of ipBuckets) {
    if (bucket.lastRefill < tenMinutesAgo) ipBuckets.delete(id);
  }
}, 10 * 60 * 1000);
