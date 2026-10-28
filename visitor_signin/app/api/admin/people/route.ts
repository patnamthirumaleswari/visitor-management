import { NextResponse } from "next/server";
import { ACCESS, ROLE_LABELS, requireStaffApi } from "@/lib/auth";
import { normalizePhone } from "@/lib/db";
import { audit } from "@/lib/services/audit";
import { addPerson, listPeople } from "@/lib/services/people";

export const dynamic = "force-dynamic";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// People (FR-ADM-04): list everyone, and add a person. Admins only.
export async function GET() {
  const staff = await requireStaffApi(ACCESS.people);
  if (staff instanceof NextResponse) return staff;
  return NextResponse.json({ people: await listPeople() });
}

export async function POST(req: Request) {
  const staff = await requireStaffApi(ACCESS.people);
  if (staff instanceof NextResponse) return staff;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const result = await addPerson({
    role: body?.role,
    name: str(body?.name, 80),
    username: str(body?.username, 40).toLowerCase(),
    department: str(body?.department, 60),
    email: str(body?.email, 120),
    phone: normalizePhone(str(body?.phone, 20)),
    signIn: body?.signIn !== false,
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

  const { secret, role } = result;
  await audit(req, staff, "Person added", `${secret.name} (${ROLE_LABELS[role]}${secret.username ? `, username ${secret.username}` : ", no sign-in"})`);
  // The secrets are shown to the admin once and never stored in plain text.
  return NextResponse.json({ people: await listPeople(), secret }, { status: 201 });
}
