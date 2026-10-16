import { NextResponse, type NextRequest } from "next/server";
import { normalizePhone, read } from "@/lib/db";
import { getSignInSession } from "@/lib/session";

export const dynamic = "force-dynamic";

// Returning-visitor pre-fill (FR-KIO-08). Because this runs on the visitor's own phone,
// it returns only name and company — not email or photo — to limit what a stranger
// could learn by typing someone else's number.
export async function GET(req: NextRequest) {
  if (!(await getSignInSession())) {
    return NextResponse.json({ error: "Session expired" }, { status: 401 });
  }

  const phone = normalizePhone(req.nextUrl.searchParams.get("phone") ?? "");
  if (phone.replace(/\D/g, "").length < 8) return NextResponse.json({ visitor: null });

  const visitor = read((d) => d.visitors.find((v) => v.phone === phone));
  return NextResponse.json({ visitor: visitor ? { name: visitor.name, company: visitor.company } : null });
}
