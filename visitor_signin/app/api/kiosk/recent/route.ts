import { NextResponse } from "next/server";
import { read } from "@/lib/db";

export const dynamic = "force-dynamic";

// Lets the reception display greet people who just signed in on their phone.
// Only first names leave the server — the display is in a public area.
export async function GET() {
  const since = Date.now() - 15_000;
  const arrivals = read((d) =>
    d.visits
      // Greet people as soon as they check in, whether they're waiting for approval or already in.
      .filter((v) => {
        const at = v.checkedInAt ?? v.signedInAt;
        return (v.status === "pending" || v.status === "review" || v.status === "signed_in") && !!at && new Date(at).getTime() > since;
      })
      .map((v) => ({
        id: v.id,
        firstName: d.visitors.find((p) => p.id === v.visitorId)?.name.split(" ")[0] ?? "",
      })),
  );
  return NextResponse.json({ arrivals });
}
