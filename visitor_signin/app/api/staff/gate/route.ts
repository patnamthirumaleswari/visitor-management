import { NextResponse } from "next/server";
import { ACCESS, requireStaffApi } from "@/lib/auth";
import { countVisits, findVisitsWithPeople } from "@/lib/repos/visits";
import { checkEscalations, rowsFor } from "@/lib/services/requests";

export const dynamic = "force-dynamic";

// Main gate (Visitor Connect): visitors cleared to leave or held, oldest first, plus how many are
// still inside. Security, reception and admins only. The gate screen polls this.
export async function GET() {
  const staff = await requireStaffApi(ACCESS.gate);
  if (staff instanceof NextResponse) return staff;

  await checkEscalations();
  const items = await findVisitsWithPeople({ status: { in: ["gate", "hold"] } }, { checkoutRequestedAt: "asc" });
  const rows = await rowsFor(items);
  const queue = items.map(({ visit: v }, i) => {
    const cleared = [...(v.timeline ?? [])].reverse().find((t) => t.event.startsWith("Checkout approved") || t.event.startsWith("Cleared for exit") || t.event.startsWith("Hold cleared"));
    return { ...rows[i], hold: v.hold ?? null, clearedBy: cleared?.by ?? null, clearedAt: cleared?.at ?? null };
  });
  const inside = await countVisits({ status: { in: ["signed_in", "checkout"] } });
  return NextResponse.json({ queue, inside });
}
