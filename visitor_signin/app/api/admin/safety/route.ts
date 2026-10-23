import { NextResponse } from "next/server";
import { ACCESS, requireStaffApi } from "@/lib/auth";
import { write, type SafetyRule } from "@/lib/db";
import { briefingFrom, RULE_KINDS } from "@/lib/safety";

export const dynamic = "force-dynamic";

const MAX_RULES = 20;
const MAX_NOTES = 5;
const MAX_PLAN_CHARS = 900_000; // the page shrinks pictures to 1200 px first, so they're well under this

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// Admin saves the site safety briefing (Visitor Connect). If anything visitors see changed, it becomes
// a new version, and new visits record that version. Admins only. TODO: audit log (FR-ROLE-02).
export async function PUT(req: Request) {
  const staff = await requireStaffApi(ACCESS.safety);
  if (staff instanceof NextResponse) return staff;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return bad("Invalid request");

  const enabled = body.enabled !== false;
  const emergencyPhone = str(body.emergencyPhone, 30);
  const assemblyPoint = str(body.assemblyPoint, 80);
  const notes = (Array.isArray(body.notes) ? body.notes : []).map((n) => str(n, 200)).filter(Boolean);
  const rawRules = Array.isArray(body.rules) ? body.rules : [];
  if (enabled && emergencyPhone.length < 3) return bad("Enter the emergency number visitors should call.");
  if (enabled && assemblyPoint.length < 2) return bad("Enter the assembly point.");
  if (notes.length > MAX_NOTES) return bad(`Use at most ${MAX_NOTES} notes.`);
  if (rawRules.length > MAX_RULES) return bad(`Use at most ${MAX_RULES} rules.`);

  const rules: SafetyRule[] = [];
  for (const [i, r] of rawRules.entries()) {
    const rule = r && typeof r === "object" ? (r as Record<string, unknown>) : {};
    const kind = typeof rule.kind === "string" && RULE_KINDS[rule.kind] ? rule.kind : "info";
    const text = str(rule.text, 200);
    if (text.length < 3) return bad(`Rule ${i + 1} needs some text.`);
    rules.push({ kind, text });
  }

  // null = remove the picture; a string = new picture; missing = keep the current one.
  let exitPlan: string | null | undefined;
  if (body.exitPlan === null) exitPlan = null;
  else if (typeof body.exitPlan === "string") {
    if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(body.exitPlan)) return bad("The exit plan must be a PNG, JPG or WebP picture.");
    if (body.exitPlan.length > MAX_PLAN_CHARS) return bad("The exit plan picture is too large.");
    exitPlan = body.exitPlan;
  }

  const saved = write((d) => {
    const current = briefingFrom(d);
    const next = { enabled, emergencyPhone, assemblyPoint, notes, rules, exitPlan: exitPlan === undefined ? current.exitPlan : exitPlan };
    const { enabled: _e, ...nextContent } = next;
    const { enabled: _c, version: _v, updatedAt: _u, ...currentContent } = current;
    const changed = JSON.stringify(nextContent) !== JSON.stringify(currentContent);
    d.safety = {
      ...next,
      version: changed ? current.version + 1 : current.version,
      updatedAt: new Date().toISOString(),
    };
    return d.safety;
  });

  return NextResponse.json({ briefing: saved });
}

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}
