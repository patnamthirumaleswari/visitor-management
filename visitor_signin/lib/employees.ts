import { LOCATION, MAX_PIN_FAILURES, PIN_LOCK_MINUTES, REPEAT_SCAN_SECONDS } from "./config";
import { newId, type Data, type EmployeeVisit, type Host } from "./db";
import { verifyPassword } from "./password";

// Employee sign-in / sign-out at reception (FR-EMP-01). These run inside write(), so a check
// and the change it leads to happen together.

export type EmployeeResult =
  | { ok: true; action: "signed_in" | "signed_out" | "already_signed_in"; firstName: string; at: string }
  | { ok: false; error: string; status: number };

/** The employee's open visit today (signed in, not out yet), if any. */
export function openEmployeeVisit(d: Data, hostId: string): EmployeeVisit | undefined {
  return d.employeeVisits.find((v) => v.hostId === hostId && !v.signedOutAt);
}

/**
 * Checks the PIN. Five wrong PINs in a row lock it for five minutes, so a 4-digit PIN
 * can't be guessed at the reception screen.
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

/** Signs the employee in if they're out, or out if they're in. */
export function toggleEmployee(d: Data, host: Host, method: "pin" | "qr"): EmployeeResult {
  const now = new Date();
  const firstName = host.name.split(" ")[0];
  const open = openEmployeeVisit(d, host.id);

  if (open) {
    // A second scan right after signing in is almost always a double scan, not leaving.
    if (method === "qr" && now.getTime() - new Date(open.signedInAt).getTime() < REPEAT_SCAN_SECONDS * 1000) {
      return { ok: true, action: "already_signed_in", firstName, at: open.signedInAt };
    }
    open.signedOutAt = now.toISOString();
    open.signedOutBy = method;
    return { ok: true, action: "signed_out", firstName, at: open.signedOutAt };
  }

  const visit: EmployeeVisit = {
    id: newId(),
    hostId: host.id,
    locationId: LOCATION.id,
    method,
    signedInAt: now.toISOString(),
  };
  d.employeeVisits.push(visit);
  return { ok: true, action: "signed_in", firstName, at: visit.signedInAt };
}
