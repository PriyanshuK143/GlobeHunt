/** Simple sliding-window rate limiter keyed by socket/IP action. */

interface Bucket {
  timestamps: number[]
}

const buckets = new Map<string, Bucket>()

export function allowAction(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now()
  let bucket = buckets.get(key)
  if (!bucket) {
    bucket = { timestamps: [] }
    buckets.set(key, bucket)
  }
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs)
  if (bucket.timestamps.length >= limit) return false
  bucket.timestamps.push(now)
  return true
}

/** Drop idle buckets so the limiter's memory stays bounded. */
export function pruneRateLimits(maxAgeMs = 5 * 60_000): void {
  const now = Date.now()
  for (const [key, bucket] of buckets) {
    const last = bucket.timestamps[bucket.timestamps.length - 1] ?? 0
    if (now - last > maxAgeMs) buckets.delete(key)
  }
}

export function clearRateLimit(keyPrefix: string): void {
  for (const key of buckets.keys()) {
    if (key.startsWith(keyPrefix)) buckets.delete(key)
  }
}
