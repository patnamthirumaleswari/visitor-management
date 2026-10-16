import { NextResponse, type NextRequest } from "next/server";
import { homeFor, STAFF_COOKIE, STAFF_SESSION_SECONDS } from "@/lib/auth";
import { read } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { makeToken } from "@/lib/token";

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
  const user = read((d) => d.staff.find((s) => s.username.toLowerCase() === username));

  // Same message for unknown user and wrong password, so it doesn't reveal which usernames exist.
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  // Only follow ?next= to a page on this site ("/admin"), never to another site ("//evil.com").
  const next = typeof body.next === "string" && /^\/(?![/\\])/.test(body.next) ? body.next : homeFor(user.role);

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
