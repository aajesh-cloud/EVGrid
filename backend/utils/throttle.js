/**
 * In-process rate limiting for endpoints that trigger an outbound email.
 *
 * Deliberately keeps its state in memory instead of adding columns to the
 * `users` table: the schema is already applied on existing installations and a
 * migration must not be a prerequisite for the OTP flow to keep working.
 *
 * Trade-off: the counters reset when the process restarts and are not shared
 * between multiple instances. That is acceptable for a single-instance
 * deployment, which is the supported topology.
 */

/** key -> { hits: number[], windowMs: number } — `hits` holds send timestamps. */
const buckets = new Map();

function prune(bucket, now) {
  bucket.hits = bucket.hits.filter((at) => now - at < bucket.windowMs);
  return bucket.hits.length > 0;
}

/**
 * Records an attempt and reports whether it may proceed.
 *
 * @param {string} key               Identity being limited (e.g. "otp:someone@example.com").
 * @param {object} options
 * @param {number} options.windowMs      Sliding window length.
 * @param {number} options.max           Maximum attempts allowed inside the window.
 * @param {number} [options.minIntervalMs=0] Minimum delay between two attempts.
 * @returns {{ allowed: boolean, reason?: 'cooldown'|'window', retryAfterSeconds?: number, remaining?: number }}
 */
export function consume(key, { windowMs, max, minIntervalMs = 0 }) {
  const now = Date.now();
  const existing = buckets.get(key);
  const bucket = existing ?? { hits: [], windowMs };
  if (existing) prune(bucket, now);

  const lastHit = bucket.hits.length ? bucket.hits[bucket.hits.length - 1] : 0;

  if (minIntervalMs > 0 && lastHit && now - lastHit < minIntervalMs) {
    return {
      allowed: false,
      reason: 'cooldown',
      retryAfterSeconds: Math.ceil((minIntervalMs - (now - lastHit)) / 1000),
    };
  }

  if (bucket.hits.length >= max) {
    return {
      allowed: false,
      reason: 'window',
      retryAfterSeconds: Math.ceil((windowMs - (now - bucket.hits[0])) / 1000),
    };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);
  return { allowed: true, remaining: Math.max(max - bucket.hits.length, 0) };
}

/** Drops buckets whose entries have all expired so the map cannot grow forever. */
function sweep() {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (!prune(bucket, now)) buckets.delete(key);
  }
}

const sweeper = setInterval(sweep, 10 * 60 * 1000);
// Never hold the event loop open just for cleanup.
sweeper.unref();
