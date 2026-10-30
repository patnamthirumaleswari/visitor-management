import { NextResponse } from "next/server";
import { sweepAutoSignOut } from "@/lib/autoSignout";
import { EMPLOYEE_QR_PREFIX } from "@/lib/config";
import { toggleByPin, toggleByQr } from "@/lib/services/employees";

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

  // Close yesterday's visit first if they forgot to sign out, so this tap signs them in, not out.
  await sweepAutoSignOut();

  const result = typeof body.qr === "string"
    ? await toggleByQr(body.qr.startsWith(EMPLOYEE_QR_PREFIX) ? body.qr.slice(EMPLOYEE_QR_PREFIX.length) : "")
    : typeof body.hostId === "string"
      ? await toggleByPin(body.hostId, typeof body.pin === "string" ? body.pin : "")
      : ({ ok: false, error: "Choose your name first.", status: 400 } as const);

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ action: result.action, firstName: result.firstName, at: result.at });
}
