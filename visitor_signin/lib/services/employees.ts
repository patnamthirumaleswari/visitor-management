import { LOCATION, REPEAT_SCAN_SECONDS } from "../config";
import { newId, type EmployeeVisit, type Host } from "../types";
import { checkPin, type EmployeeResult } from "../employees";
import { employeeVisitExists, findOpenEmployeeVisit, insertEmployeeVisit, signOutEmployeeVisit } from "../repos/employeeVisits";
import { findHostById, findHostByQrToken, updateHost } from "../repos/hosts";
import { transaction } from "../repos/visits";
import { isActiveHost } from "./people";

// Employees sign in and out at reception (FR-EMP-01), with their personal QR or their name and PIN.
// The same action signs them in if they're out, or out if they're in.

/** Signs the employee in if they're out, or out if they're in. */
async function toggle(host: Host, method: "pin" | "qr"): Promise<EmployeeResult> {
  return transaction(async (tx) => {
    // Lock this employee's rows so a double tap can't sign them in twice.
    await tx.$queryRaw`SELECT id FROM "Host" WHERE id = ${host.id} FOR UPDATE`;
    const now = new Date();
    const firstName = host.name.split(" ")[0];
    const open = await findOpenEmployeeVisit(host.id, tx);

    if (open) {
      // A second scan right after signing in is almost always a double scan, not leaving.
      if (method === "qr" && now.getTime() - new Date(open.signedInAt).getTime() < REPEAT_SCAN_SECONDS * 1000) {
        return { ok: true, action: "already_signed_in", firstName, at: open.signedInAt };
      }
      await signOutEmployeeVisit(open.id, now, method, tx);
      return { ok: true, action: "signed_out", firstName, at: now.toISOString() };
    }

    const visit: EmployeeVisit = { id: newId(), hostId: host.id, locationId: LOCATION.id, method, signedInAt: now.toISOString() };
    await insertEmployeeVisit(tx, visit);
    return { ok: true, action: "signed_in", firstName, at: visit.signedInAt };
  });
}

/** With the personal QR shown to the reception camera. */
export async function toggleByQr(token: string): Promise<EmployeeResult> {
  const host = token ? await findHostByQrToken(token) : null;
  if (!host || !isActiveHost(host)) return { ok: false, error: "This isn't a valid employee QR code. Use your name and PIN instead.", status: 404 };
  return toggle(host, "qr");
}

/** With their name and PIN. Wrong PINs count towards the lock. */
export async function toggleByPin(hostId: string, pin: string): Promise<EmployeeResult> {
  const host = await findHostById(hostId);
  if (!host || !isActiveHost(host)) return { ok: false, error: "Choose your name first.", status: 400 };
  const problem = checkPin(host, pin);
  await updateHost(host.id, { pinFailures: host.pinFailures ?? 0, pinLockedUntil: host.pinLockedUntil ? new Date(host.pinLockedUntil) : null });
  if (problem) return { ok: false, error: problem, status: 401 };
  return toggle(host, "pin");
}

/** Reception signs an employee out from the portal. Returns false if there's no such sign-in. */
export async function signOutEmployeeByStaff(id: string): Promise<boolean> {
  return (await signOutEmployeeVisit(id, new Date(), "portal")) || (await employeeVisitExists(id));
}
