import { NextResponse } from "next/server";
import { ACCESS, requireStaffApi } from "@/lib/auth";
import { inboxFor, markInboxRead } from "@/lib/services/inbox";

export const dynamic = "force-dynamic";

// Your inbox: approval requests and alerts sent to you (hosts, reception and admins).
export async function GET() {
  const staff = await requireStaffApi(ACCESS.inbox);
  if (staff instanceof NextResponse) return staff;
  return NextResponse.json({ items: await inboxFor(staff) });
}

// Mark items read: { ids: [...] } for some, or { all: true }.
export async function POST(req: Request) {
  const staff = await requireStaffApi(ACCESS.inbox);
  if (staff instanceof NextResponse) return staff;
  const body = (await req.json().catch(() => null)) as { ids?: unknown; all?: unknown } | null;
  const wanted = Array.isArray(body?.ids) ? new Set(body.ids.filter((x): x is string => typeof x === "string")) : null;
  if (!wanted && body?.all !== true) return NextResponse.json({ error: "Say which messages to mark read." }, { status: 400 });

  return NextResponse.json({ items: await markInboxRead(staff, wanted ?? "all") });
}
