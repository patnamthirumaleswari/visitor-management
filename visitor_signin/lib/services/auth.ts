import type { StaffUser } from "../db";
import { hashPassword, verifyPassword } from "../password";
import { clearAttempt, getAttempt, saveAttempt } from "../repos/loginAttempts";
import { findStaffById, findStaffByUsername, updateStaff } from "../repos/staff";

// Staff sign-in (NFR-SEC-02/03): password check, the login lock, and changing your own password.

// After MAX_FAILURES wrong passwords for one username from one address, that pair waits LOCK_MINUTES.
const MAX_FAILURES = 5;
const LOCK_MINUTES = 15;
const MIN_PASSWORD = 8;

export type SignInResult =
  | { ok: true; user: StaffUser }
  | { ok: false; status: 401 | 403 | 429; error: string; failure?: string }; // failure = what the audit log records

/** Checks a username and password. `ip` is the caller's address, for the lock. */
export async function signIn(username: string, password: string, ip: string): Promise<SignInResult> {
  const key = `${username}|${ip}`;
  const attempt = await getAttempt(key);
  if (attempt?.lockedUntil && attempt.lockedUntil.getTime() > Date.now()) {
    const wait = Math.ceil((attempt.lockedUntil.getTime() - Date.now()) / 60_000);
    return { ok: false, status: 429, error: `Too many attempts. Try again in ${wait} minute${wait === 1 ? "" : "s"}.` };
  }

  const user = await findStaffByUsername(username);
  // Same message for unknown user and wrong password, so it doesn't reveal which usernames exist.
  if (!user || !verifyPassword(password, user.passwordHash)) {
    const now = new Date();
    // Failures more than LOCK_MINUTES apart don't add up; an expired lock starts over.
    const fresh = !attempt || now.getTime() - attempt.firstAt.getTime() >= LOCK_MINUTES * 60_000 || !!attempt.lockedUntil;
    const count = (fresh ? 0 : attempt!.count) + 1;
    const lockedUntil = count >= MAX_FAILURES ? new Date(now.getTime() + LOCK_MINUTES * 60_000) : null;
    await saveAttempt(key, { count, firstAt: fresh ? now : attempt!.firstAt, lockedUntil });
    return {
      ok: false,
      status: 401,
      error: "Invalid username or password.",
      failure: lockedUntil ? `Wrong username or password; locked for ${LOCK_MINUTES} min` : "Wrong username or password",
    };
  }

  await clearAttempt(key);
  if (user.active === false) return { ok: false, status: 403, error: "This account is switched off. Ask an admin.", failure: "Account switched off" };
  return { ok: true, user };
}

/** Changes a staff member's own password. Returns an error message, or null when saved. */
export async function changePassword(staffId: string, current: string, next: string): Promise<string | null> {
  if (next.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  if (next.length > 200) return "That password is too long.";
  const user = await findStaffById(staffId);
  if (!user) return "Account not found.";
  if (!verifyPassword(current, user.passwordHash)) return "Your current password isn't right.";
  if (verifyPassword(next, user.passwordHash)) return "Choose a different password from the current one.";
  await updateStaff(staffId, { passwordHash: hashPassword(next), mustChangePassword: false });
  return null;
}
