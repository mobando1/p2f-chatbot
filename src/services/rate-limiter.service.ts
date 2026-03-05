interface RateBucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, RateBucket>();

const MAX_TOKENS = 10; // max messages per window
const REFILL_RATE = 10; // tokens per minute

export function checkRateLimit(sessionId: string): boolean {
  const now = Date.now();
  let bucket = buckets.get(sessionId);

  if (!bucket) {
    bucket = { tokens: MAX_TOKENS, lastRefill: now };
    buckets.set(sessionId, bucket);
  }

  // Refill tokens based on elapsed time
  const elapsed = (now - bucket.lastRefill) / 60000; // minutes
  bucket.tokens = Math.min(MAX_TOKENS, bucket.tokens + elapsed * REFILL_RATE);
  bucket.lastRefill = now;

  if (bucket.tokens < 1) {
    return false; // rate limited
  }

  bucket.tokens -= 1;
  return true;
}

// Clean up stale buckets every 10 minutes
setInterval(() => {
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
  for (const [id, bucket] of buckets) {
    if (bucket.lastRefill < tenMinutesAgo) {
      buckets.delete(id);
    }
  }
}, 10 * 60 * 1000);
