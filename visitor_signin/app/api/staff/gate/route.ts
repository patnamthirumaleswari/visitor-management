import { NextResponse } from "next/server";
import { ACCESS, requireStaffApi } from "@/lib/auth";
import { read } from "@/lib/db";
import { checkEscalations, toRow } from "@/lib/requests";
import { listVisitorTypes } from "@/lib/services/visitorTypes";

export const dynamic = "force-dynamic";

// Main gate (Visitor Connect): visitors cleared to leave or held, oldest first, plus how many are
// still inside. Security, reception and admins only. The gate screen polls this.
export async function GET() {
  const staff = await requireStaffApi(ACCESS.gate);
  if (staff instanceof NextResponse) return staff;

  await checkEscalations();
  const types = await listVisitorTypes();
  const data = read((d) => {
    const queue = d.visits
      .filter((v) => v.status === "gate" || v.status === "hold")
      .sort((a, b) => (a.checkoutRequestedAt ?? "").localeCompare(b.checkoutRequestedAt ?? ""))
      .map((v) => {
        const cleared = [...(v.timeline ?? [])].reverse().find((t) => t.event.startsWith("Checkout approved") || t.event.startsWith("Cleared for exit") || t.event.startsWith("Hold cleared"));
        return { ...toRow(d, v, types), hold: v.hold ?? null, clearedBy: cleared?.by ?? null, clearedAt: cleared?.at ?? null };
      });
    const inside = d.visits.filter((v) => v.status === "signed_in" || v.status === "checkout").length;
    return { queue, inside };
  });
  return NextResponse.json(data);
}
