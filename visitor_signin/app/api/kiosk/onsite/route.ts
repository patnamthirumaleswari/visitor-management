import { NextResponse, type NextRequest } from "next/server";
import { sweepAutoSignOut } from "@/lib/autoSignout";
import { read } from "@/lib/db";

export const dynamic = "force-dynamic";

// Name search on the reception screen's "Signing out?" page (FR-KIO-10).
// The screen is in a public area, so it needs at least 2 letters and only returns a first name,
// last initial and the host's first name, e.g. "Ravi K. · visiting Priya". No phone, company or photo.
// TODO: only paired reception tablets should call this (FR-KIO-02).
export async function GET(req: NextRequest) {
  await sweepAutoSignOut();
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
  if (q.length < 2) return NextResponse.json({ visitors: [] });

  const visitors = read((d) =>
    d.visits
      .filter((v) => v.status === "signed_in")
      .map((v) => ({ visit: v, visitor: d.visitors.find((p) => p.id === v.visitorId), host: d.hosts.find((h) => h.id === v.hostId) }))
      .filter(({ visitor }) => visitor && visitor.name.toLowerCase().split(/\s+/).some((part) => part.startsWith(q)))
      .slice(0, 8)
      .map(({ visit, visitor, host }) => ({
        id: visit.id,
        name: shortName(visitor!.name),
        host: host?.name.split(" ")[0] ?? "",
      })),
  );
  return NextResponse.json({ visitors });
}

/** "Ravi Kumar Sharma" → "Ravi S." */
function shortName(full: string) {
  const parts = full.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.` : parts[0];
}
