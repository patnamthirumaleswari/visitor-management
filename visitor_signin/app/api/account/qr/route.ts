import QRCode from "qrcode";
import { NextResponse } from "next/server";
import { ACCESS, requireStaffApi } from "@/lib/auth";
import { EMPLOYEE_QR_PREFIX } from "@/lib/config";
import { write } from "@/lib/db";
import { randomToken } from "@/lib/token";

export const dynamic = "force-dynamic";

// Makes a new personal sign-in QR for the logged-in employee (FR-EMP-01), e.g. after losing
// a printout. The old code stops working at once.
export async function POST() {
  const staff = await requireStaffApi(ACCESS.account);
  if (staff instanceof NextResponse) return staff;
  if (!staff.hostId) return NextResponse.json({ error: "Your account isn't linked to an employee record." }, { status: 400 });

  const token = write((d) => {
    const host = d.hosts.find((h) => h.id === staff.hostId);
    if (!host) return null;
    host.qrToken = randomToken();
    return host.qrToken;
  });
  if (!token) return NextResponse.json({ error: "Employee record not found." }, { status: 404 });

  const qr = await QRCode.toDataURL(EMPLOYEE_QR_PREFIX + token, { margin: 1, width: 400, errorCorrectionLevel: "M" });
  return NextResponse.json({ qr });
}
