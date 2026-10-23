import { NextResponse } from "next/server";
import { isOpen } from "@/lib/approvals";
import { normalizePhone, read } from "@/lib/db";

export const dynamic = "force-dynamic";

// "Find my visit" (Visitor Connect): the 4-digit visit code plus the mobile number used at check-in
// reopens an open visit's screen on any phone.
// Wrong tries are limited per network address, so codes can't be guessed one after another.
const MAX_FAILS = 8;
const WINDOW_MS = 10 * 60_000;
const fails = new Map<string, { count: number; since: number }>();

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const now = Date.now();
  const f = fails.get(ip);
  if (f && now - f.since < WINDOW_MS && f.count >= MAX_FAILS) {
    return NextResponse.json({ error: "Too many tries. Please ask at reception." }, { status: 429 });
  }

  const body = (await req.json().catch(() => ({}))) as { code?: unknown; phone?: unknown };
  const code = typeof body.code === "string" ? body.code.trim() : "";
  const phone = typeof body.phone === "string" ? normalizePhone(body.phone) : "";
  if (!/^\d{4}$/.test(code) || phone.replace(/\D/g, "").length < 8) {
    return NextResponse.json({ error: "Enter your 4-digit visit code and your mobile number." }, { status: 400 });
  }

  const visit = read((d) => {
    const v = d.visits.find((x) => x.code === code && isOpen(x));
    const visitor = v && d.visitors.find((p) => p.id === v.visitorId);
    return v && visitor && visitor.phone === phone ? v : null;
  });

  if (!visit) {
    const entry = f && now - f.since < WINDOW_MS ? f : { count: 0, since: now };
    fails.set(ip, { ...entry, count: entry.count + 1 });
    return NextResponse.json({ error: "No open visit matches that code and number. Check both, or ask at reception." }, { status: 404 });
  }
  fails.delete(ip);
  return NextResponse.json({ href: `/badge/${visit.id}?t=${visit.badgeToken}` });
}
