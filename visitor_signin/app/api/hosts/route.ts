import { NextResponse, type NextRequest } from "next/server";
import { read } from "@/lib/db";
import { getSignInSession } from "@/lib/session";

export const dynamic = "force-dynamic";

// Host type-ahead. Only phones holding a live sign-in session can search the directory,
// and only name + department are returned — never staff emails or phone numbers.
export async function GET(req: NextRequest) {
  if (!(await getSignInSession())) {
    return NextResponse.json({ error: "Please scan the QR code at reception again." }, { status: 401 });
  }

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
  const hosts = read((d) =>
    d.hosts
      .filter((h) => !q || h.name.toLowerCase().includes(q))
      .slice(0, 10)
      .map(({ id, name, department }) => ({ id, name, department })),
  );
  return NextResponse.json({ hosts });
}
