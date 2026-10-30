import { NextResponse, type NextRequest } from "next/server";
import { listHosts } from "@/lib/repos/hosts";
import { isActiveHost } from "@/lib/services/people";

export const dynamic = "force-dynamic";

// Name search on the reception screen's "Employee sign in" page (FR-EMP-01).
// Only name and department are returned, never contact details or who is in the building:
// the screen is in a public area. The PIN is what proves who someone is.
// TODO: only paired reception tablets should call this (FR-KIO-02).
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
  if (q.length < 2) return NextResponse.json({ employees: [] });

  const employees = (await listHosts())
      .filter((h) => isActiveHost(h))
      .filter((h) => h.name.toLowerCase().split(/\s+/).some((part) => part.startsWith(q)) || h.name.toLowerCase().startsWith(q))
      .slice(0, 8)
      .map(({ id, name, department }) => ({ id, name, department }));
  return NextResponse.json({ employees });
}
