import { NextResponse, type NextRequest } from "next/server";
import { audit } from "@/lib/audit";
import { CHANGE_PASSWORD_PATH, homeFor, STAFF_COOKIE, STAFF_SESSION_SECONDS } from "@/lib/auth";
import { read } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { ipOf } from "@/lib/audit";
import { makeToken } from "@/lib/token";
import { loginBlocked, noteLoginFailure, clearLoginFailures } from "@/lib/loginLimit";

export const dynamic = "force-dynamic";

// Staff login. Passwords are checked here on the server against the stored hash;
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
  // Too many wrong passwords for this username from this address: wait before trying again.
  const key = `${username}|${ipOf(req)}`;
  const wait = loginBlocked(key);
  if (wait) {
    return NextResponse.json({ error: `Too many attempts. Try again in ${wait} minute${wait === 1 ? "" : "s"}.` }, { status: 429 });
  }

  const user = read((d) => d.staff.find((s) => s.username.toLowerCase() === username));

  // Same message for unknown user and wrong password, so it doesn't reveal which usernames exist.
  if (!user || !verifyPassword(password, user.passwordHash)) {
    const locked = noteLoginFailure(key);
    audit(req, { name: username || "(blank)", role: "Unknown" }, "Failed sign-in", locked ? "Wrong username or password; locked for 15 min" : "Wrong username or password");
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }
  clearLoginFailures(key);
  if (user.active === false) {
    audit(req, { name: user.name, role: "Unknown" }, "Failed sign-in", "Account switched off");
    return NextResponse.json({ error: "This account is switched off. Ask an admin." }, { status: 403 });
  }

  // Only follow ?next= to a page on this site ("/admin"), never to another site ("//evil.com").
  const wanted = typeof body.next === "string" && /^\/(?![/\\])/.test(body.next) ? body.next : homeFor(user.role);
  // A temporary password from an admin: choose your own first.
  const next = user.mustChangePassword ? `${CHANGE_PASSWORD_PATH}?next=${encodeURIComponent(wanted)}` : wanted;

  audit(req, { name: user.name, role: ({ admin: "Admin", receptionist: "Receptionist", host: "Host", security: "Security" } as const)[user.role] }, "Signed in");
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
