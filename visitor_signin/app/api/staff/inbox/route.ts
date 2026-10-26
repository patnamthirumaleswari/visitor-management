import { NextResponse } from "next/server";
import { ACCESS, requireStaffApi } from "@/lib/auth";
import { read, write } from "@/lib/db";
import { inboxFor } from "@/lib/inbox";

export const dynamic = "force-dynamic";

// Your inbox: approval requests and alerts sent to you (hosts, reception and admins).
export async function GET() {
  const staff = await requireStaffApi(ACCESS.inbox);
  if (staff instanceof NextResponse) return staff;
  return NextResponse.json({ items: read((d) => inboxFor(d, staff)) });
}

// Mark items read: { ids: [...] } for some, or { all: true }.
export async function POST(req: Request) {
  const staff = await requireStaffApi(ACCESS.inbox);
  if (staff instanceof NextResponse) return staff;
  const body = (await req.json().catch(() => null)) as { ids?: unknown; all?: unknown } | null;
  const wanted = Array.isArray(body?.ids) ? new Set(body.ids.filter((x): x is string => typeof x === "string")) : null;
  if (!wanted && body?.all !== true) return NextResponse.json({ error: "Say which messages to mark read." }, { status: 400 });

  const items = write((d) => {
    // Only messages in this person's own inbox can be marked.
    const mine = new Set(inboxFor(d, staff).flatMap((i) => i.ids));
    for (const n of d.notifications) {
      if (!mine.has(n.id) || (wanted && !wanted.has(n.id))) continue;
      if (!n.readBy?.includes(staff.id)) (n.readBy ??= []).push(staff.id);
    }
    return inboxFor(d, staff);
  });
  return NextResponse.json({ items });
}
