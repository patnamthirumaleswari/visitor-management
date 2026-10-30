import { NextResponse } from "next/server";
import { ACCESS, ROLE_LABELS, requireStaffApi } from "@/lib/auth";
import { audit } from "@/lib/services/audit";
import { actOnPerson, listPeople, PERSON_ACTIONS, type PersonAction } from "@/lib/services/people";

export const dynamic = "force-dynamic";

const LABELS: Record<PersonAction, string> = {
  "switch-off": "Person switched off",
  "switch-on": "Person switched on",
  "reset-password": "Temporary password given",
  "reset-pin": "Reception PIN reset",
  "give-sign-in": "Sign-in created",
};

// One person's actions on /admin/people. :id is their staff account's id, or the employee's id if
// they have no sign-in. Admins only; an admin can't switch off or reset themselves here.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaffApi(ACCESS.people);
  if (staff instanceof NextResponse) return staff;
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { action?: unknown; username?: unknown } | null;
  const action = PERSON_ACTIONS.find((a) => a === body?.action);
  if (!action) return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  const username = typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";

  const result = await actOnPerson(id, action, staff.id, username);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

  await audit(req, staff, LABELS[action], action === "give-sign-in" ? `${result.name} (${ROLE_LABELS.host}, username ${username})` : result.name);
  return NextResponse.json({ people: await listPeople(), ...(result.secret ? { secret: result.secret } : {}) });
}
