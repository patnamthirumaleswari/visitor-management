import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { ACCESS, ROLE_LABELS, requireStaffApi } from "@/lib/auth";
import { newId, read, write, type Data } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { peopleRows, temporaryPassword, temporaryPin } from "@/lib/people";

export const dynamic = "force-dynamic";

type Action = "switch-off" | "switch-on" | "reset-password" | "reset-pin" | "give-sign-in";
const ACTIONS: Action[] = ["switch-off", "switch-on", "reset-password", "reset-pin", "give-sign-in"];

// One person's actions on /admin/people. :id is their staff account's id, or the employee's id if
// they have no sign-in. Admins only; an admin can't switch off or reset themselves here.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaffApi(ACCESS.people);
  if (staff instanceof NextResponse) return staff;
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { action?: unknown; username?: unknown } | null;
  const action = ACTIONS.find((a) => a === body?.action);
  if (!action) return bad("Unknown action.");
  if (id === staff.id) return bad("Use My account to change your own sign-in.");

  const username = typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";
  const secret = action === "reset-password" || action === "give-sign-in" ? temporaryPassword() : action === "reset-pin" ? temporaryPin() : null;

  const result = write((d): { error: string; status?: number } | { name: string } => {
    const user = d.staff.find((s) => s.id === id);
    const host = d.hosts.find((h) => h.id === (user ? user.hostId : id));
    if (!user && !host) return { error: "Person not found.", status: 404 };
    const name = user?.name ?? host!.name;

    switch (action) {
      case "switch-off":
        if (user?.role === "admin" && !otherActiveAdmin(d, user.id)) return { error: "Keep at least one admin switched on." };
        if (user) user.active = false;
        if (host) host.active = false;
        break;
      case "switch-on":
        if (user) delete user.active;
        if (host) delete host.active;
        break;
      case "reset-password":
        if (!user) return { error: "They don't have a sign-in yet." };
        user.passwordHash = hashPassword(secret!);
        user.mustChangePassword = true;
        break;
      case "reset-pin":
        if (!host) return { error: "Only employees have a reception PIN." };
        host.pinHash = hashPassword(secret!);
        delete host.pinFailures;
        delete host.pinLockedUntil;
        break;
      case "give-sign-in":
        if (user || !host) return { error: "They already have a sign-in." };
        if (!/^[a-z0-9._@-]{3,40}$/.test(username)) return { error: "Choose a username: 3 to 40 letters, numbers, dots or dashes." };
        if (d.staff.some((s) => s.username.toLowerCase() === username)) return { error: "That username is taken." };
        d.staff.push({ id: newId(), username, name: host.name, role: "host", hostId: host.id, passwordHash: hashPassword(secret!), mustChangePassword: true });
        break;
    }
    return { name };
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status ?? 400 });

  const LABELS: Record<Action, string> = {
    "switch-off": "Person switched off",
    "switch-on": "Person switched on",
    "reset-password": "Temporary password given",
    "reset-pin": "Reception PIN reset",
    "give-sign-in": "Sign-in created",
  };
  audit(req, staff, LABELS[action], action === "give-sign-in" ? `${result.name} (${ROLE_LABELS.host}, username ${username})` : result.name);
  return NextResponse.json({
    people: read(peopleRows),
    ...(secret ? { secret: { name: result.name, username: action === "give-sign-in" ? username : null, password: action === "reset-pin" ? null : secret, pin: action === "reset-pin" ? secret : null } } : {}),
  });
}

function otherActiveAdmin(d: Data, exceptId: string) {
  return d.staff.some((s) => s.id !== exceptId && s.role === "admin" && s.active !== false);
}

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}
