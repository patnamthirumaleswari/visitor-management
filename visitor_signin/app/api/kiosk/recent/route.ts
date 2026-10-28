import { NextResponse } from "next/server";
import { findVisitsWithPeople } from "@/lib/repos/visits";

export const dynamic = "force-dynamic";

// Lets the reception display greet people who just signed in on their phone.
// Only first names leave the server — the display is in a public area.
export async function GET() {
  const since = new Date(Date.now() - 15_000);
  // Greet people as soon as they check in, whether they're waiting for approval or already in.
  const recent = await findVisitsWithPeople({
    status: { in: ["pending", "review", "signed_in"] },
    OR: [{ checkedInAt: { gt: since } }, { checkedInAt: null, signedInAt: { gt: since } }],
  });
  const arrivals = recent.map(({ visit, visitor }) => ({ id: visit.id, firstName: visitor.name.split(" ")[0] ?? "" }));
  return NextResponse.json({ arrivals });
}
