import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { write } from "@/lib/db";

// Visitor signs themself out from the badge on their phone. The badge token proves it's their visit.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { token } = (await req.json().catch(() => ({}))) as { token?: string };

  const outcome = write((d) => {
    const visit = d.visits.find((v) => v.id === id);
    if (!visit || !token || !safeEqual(visit.badgeToken, token)) return "not-found";
    if (visit.status === "signed_out") return "already";
    visit.status = "signed_out";
    visit.signedOutAt = new Date().toISOString();
    return "ok";
  });

  if (outcome === "not-found") return NextResponse.json({ error: "Visit not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
