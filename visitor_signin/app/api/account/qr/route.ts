import QRCode from "qrcode";
import { NextResponse } from "next/server";
import { ACCESS, requireStaffApi } from "@/lib/auth";
import { EMPLOYEE_QR_PREFIX } from "@/lib/config";
import { newOwnQrToken } from "@/lib/services/account";
import { audit } from "@/lib/services/audit";

export const dynamic = "force-dynamic";

// Makes a new personal sign-in QR for the logged-in employee (FR-EMP-01), e.g. after losing
// a printout. The old code stops working at once.
export async function POST(req: Request) {
  const staff = await requireStaffApi(ACCESS.account);
  if (staff instanceof NextResponse) return staff;
  if (!staff.hostId) return NextResponse.json({ error: "Your account isn't linked to an employee record." }, { status: 400 });

  const token = await newOwnQrToken(staff.hostId);
  if (!token) return NextResponse.json({ error: "Employee record not found." }, { status: 404 });

  const qr = await QRCode.toDataURL(EMPLOYEE_QR_PREFIX + token, { margin: 1, width: 400, errorCorrectionLevel: "M" });
  await audit(req, staff, "Made a new personal sign-in QR");
  return NextResponse.json({ qr });
}
