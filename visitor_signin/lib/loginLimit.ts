// Login rate limit: after MAX_FAILURES wrong passwords for one username from one address, that
// pair waits LOCK_MINUTES. Kept in memory, so it resets when the server restarts; in production
// use a shared store (Redis) so every server instance sees the same count.

const MAX_FAILURES = 5;
const LOCK_MINUTES = 15;

const failures = new Map<string, { count: number; first: number; lockedUntil?: number }>();

/** Minutes left on the lock, or 0 if they may try. */
export function loginBlocked(key: string): number {
  const f = failures.get(key);
  if (!f?.lockedUntil) return 0;
  const left = f.lockedUntil - Date.now();
  if (left <= 0) {
    failures.delete(key);
    return 0;
  }
  return Math.ceil(left / 60_000);
}

/** Records a wrong password. Returns true if this one locked the pair. */
export function noteLoginFailure(key: string): boolean {
  const now = Date.now();
  const f = failures.get(key);
  // Failures more than LOCK_MINUTES apart don't add up.
  const entry = f && now - f.first < LOCK_MINUTES * 60_000 ? f : { count: 0, first: now };
  entry.count++;
  if (entry.count >= MAX_FAILURES) entry.lockedUntil = now + LOCK_MINUTES * 60_000;
  failures.set(key, entry);
  return !!entry.lockedUntil;
}

export function clearLoginFailures(key: string) {
  failures.delete(key);
}
