import { NextResponse, type NextRequest } from "next/server";
import { CHANGE_PASSWORD_PATH, homeFor, ROLE_LABELS, STAFF_COOKIE, STAFF_SESSION_SECONDS } from "@/lib/auth";
import { audit, ipOf } from "@/lib/services/audit";
import { signIn } from "@/lib/services/auth";
import { makeToken } from "@/lib/token";

export const dynamic = "force-dynamic";

// Staff login. Passwords are checked on the server against the stored hash (lib/services/auth.ts);
// the browser only ever gets a signed, httpOnly session cookie.
export async function POST(req: NextRequest) {
  let body: { username?: unknown; password?: unknown; next?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const result = await signIn(username, password, ipOf(req));
  if (!result.ok) {
    if (result.failure) await audit(req, { name: username || "(blank)", role: "Unknown" }, "Failed sign-in", result.failure);
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  const user = result.user;

  // Only follow ?next= to a page on this site ("/admin"), never to another site ("//evil.com").
  const wanted = typeof body.next === "string" && /^\/(?![/\\])/.test(body.next) ? body.next : homeFor(user.role);
  // A temporary password from an admin: choose your own first.
  const next = user.mustChangePassword ? `${CHANGE_PASSWORD_PATH}?next=${encodeURIComponent(wanted)}` : wanted;

  await audit(req, { name: user.name, role: ROLE_LABELS[user.role] }, "Signed in");
  const res = NextResponse.json({ redirect: next });
  res.cookies.set(STAFF_COOKIE, makeToken("staff", STAFF_SESSION_SECONDS, user.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: req.nextUrl.protocol === "https:",
    maxAge: STAFF_SESSION_SECONDS,
    path: "/",
  });
  return res;
}
