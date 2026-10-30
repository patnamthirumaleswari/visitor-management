import { MAX_PIN_FAILURES, PIN_LOCK_MINUTES } from "./config";
import type { Host } from "./types";
import { verifyPassword } from "./password";

// Employee sign-in / sign-out at reception (FR-EMP-01): the PIN rule. Signing in and out is in
// lib/services/employees.ts.

export type EmployeeResult =
  | { ok: true; action: "signed_in" | "signed_out" | "already_signed_in"; firstName: string; at: string }
  | { ok: false; error: string; status: number };

/**
 * Checks the PIN and updates the host's failure count on `host`. Five wrong PINs in a row lock it for
 * five minutes, so a 4-digit PIN can't be guessed at the reception screen.
 */
export function checkPin(host: Host, pin: string): string | null {
  const now = Date.now();
  if (host.pinLockedUntil && new Date(host.pinLockedUntil).getTime() > now) {
    return `Too many wrong PINs. Try again in ${PIN_LOCK_MINUTES} minutes or ask reception.`;
  }
  if (host.pinHash && verifyPassword(pin, host.pinHash)) {
    host.pinFailures = 0;
    delete host.pinLockedUntil;
    return null;
  }

  host.pinFailures = (host.pinFailures ?? 0) + 1;
  if (host.pinFailures >= MAX_PIN_FAILURES) {
    host.pinFailures = 0;
    host.pinLockedUntil = new Date(now + PIN_LOCK_MINUTES * 60_000).toISOString();
    return `Too many wrong PINs. Try again in ${PIN_LOCK_MINUTES} minutes or ask reception.`;
  }
  const left = MAX_PIN_FAILURES - host.pinFailures;
  return `Wrong PIN. ${left} ${left === 1 ? "try" : "tries"} left.`;
}
