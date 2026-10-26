import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { ACCESS, requireStaffApi } from "@/lib/auth";
import { newId, normalizePhone, read, write, type WatchEntry } from "@/lib/db";

export const dynamic = "force-dynamic";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// Watchlist (FR-SEC-01): list and add entries. Admins only.
export async function GET() {
  const staff = await requireStaffApi(ACCESS.watchlist);
  if (staff instanceof NextResponse) return staff;
  return NextResponse.json({ entries: read((d) => d.watchlist ?? []) });
}

export async function POST(req: Request) {
  const staff = await requireStaffApi(ACCESS.watchlist);
  if (staff instanceof NextResponse) return staff;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const name = str(body?.name, 80);
  const phone = str(body?.phone, 30);
  const company = str(body?.company, 80);
  const reason = str(body?.reason, 200);
  if (name.length < 2 && normalizePhone(phone).length < 6) return bad("Enter a name or a mobile number to match on.");
  if (reason.length < 3) return bad("Say why they're on the watchlist (admins see this at check-in).");

  const entry: WatchEntry = { id: newId(), name, phone, company, reason, active: true, by: staff.name, at: new Date().toISOString() };
  write((d) => {
    (d.watchlist ??= []).unshift(entry);
  });
  audit(req, staff, "Watchlist entry added", `${name || phone}: ${reason}`);
  return NextResponse.json({ entry });
}

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}
