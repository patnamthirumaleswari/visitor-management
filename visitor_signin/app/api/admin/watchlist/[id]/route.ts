import { NextResponse } from "next/server";
import { audit } from "@/lib/services/audit";
import { ACCESS, requireStaffApi } from "@/lib/auth";
import { deleteWatchEntry, setWatchEntryActive } from "@/lib/repos/watchlist";

export const dynamic = "force-dynamic";

// Pause or resume a watchlist entry ({ active }). Admins only.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaffApi(ACCESS.watchlist);
  if (staff instanceof NextResponse) return staff;
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { active?: unknown } | null;
  if (typeof body?.active !== "boolean") return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const active = body.active;

  const entry = await setWatchEntryActive(id, active);
  if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  await audit(req, staff, active ? "Watchlist entry resumed" : "Watchlist entry paused", entry.name || entry.phone);
  return NextResponse.json({ entry });
}

// Remove an entry. Visits that already matched keep their note. Admins only.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaffApi(ACCESS.watchlist);
  if (staff instanceof NextResponse) return staff;
  const { id } = await params;

  const removed = await deleteWatchEntry(id);
  if (!removed) return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  await audit(req, staff, "Watchlist entry removed", removed.name || removed.phone);
  return NextResponse.json({ ok: true });
}
