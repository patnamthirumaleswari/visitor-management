import { NextResponse } from "next/server";
import { read } from "@/lib/db";

export const dynamic = "force-dynamic";

// Lets the reception display greet people who just signed in on their phone.
// Only first names leave the server — the display is in a public area.
export async function GET() {
  const since = Date.now() - 15_000;
  const arrivals = read((d) =>
    d.visits
      .filter((v) => v.status === "signed_in" && v.signedInAt && new Date(v.signedInAt).getTime() > since)
      .map((v) => ({
        id: v.id,
        firstName: d.visitors.find((p) => p.id === v.visitorId)?.name.split(" ")[0] ?? "",
      })),
  );
  return NextResponse.json({ arrivals });
}
