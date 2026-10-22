import { NextResponse } from "next/server";
import { EMPLOYEE_QR_PREFIX } from "@/lib/config";
import { write } from "@/lib/db";
import { checkPin, toggleEmployee, type EmployeeResult } from "@/lib/employees";

export const dynamic = "force-dynamic";

type Body = { hostId?: unknown; pin?: unknown; qr?: unknown };

// Employee signs in or out at reception (FR-EMP-01), either by choosing their name and typing
// their PIN, or by showing their personal QR code to the reception camera.
// TODO: only paired reception tablets should call this (FR-KIO-02).
export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const result: EmployeeResult = write((d) => {
    if (typeof body.qr === "string") {
      const token = body.qr.startsWith(EMPLOYEE_QR_PREFIX) ? body.qr.slice(EMPLOYEE_QR_PREFIX.length) : "";
      const host = token ? d.hosts.find((h) => h.qrToken === token) : undefined;
      if (!host) return { ok: false, error: "This isn't a valid employee QR code. Use your name and PIN instead.", status: 404 };
      return toggleEmployee(d, host, "qr");
    }

    const host = typeof body.hostId === "string" ? d.hosts.find((h) => h.id === body.hostId) : undefined;
    if (!host) return { ok: false, error: "Choose your name first.", status: 400 };
    const pin = typeof body.pin === "string" ? body.pin : "";
    const problem = checkPin(host, pin);
    if (problem) return { ok: false, error: problem, status: 401 };
    return toggleEmployee(d, host, "pin");
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ action: result.action, firstName: result.firstName, at: result.at });
}
