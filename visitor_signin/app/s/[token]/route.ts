import { NextResponse, type NextRequest } from "next/server";
import { publicBaseUrl } from "@/lib/baseUrl";
import { SESSION_TTL_SECONDS } from "@/lib/config";
import { SESSION_COOKIE } from "@/lib/session";
import { makeToken, readToken } from "@/lib/token";

// Where the QR points. Swaps the short-lived QR token for a sign-in session cookie on the
// visitor's own phone, then sends them into the form. Redirecting also removes the token
// from the address bar, so it isn't left in their history or shared by accident.
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const qr = readToken(token, "qr");

  // Build redirects from the same base the QR used; req.url can say 0.0.0.0 in dev.
  const base = publicBaseUrl();
  if (!qr) {
    return NextResponse.redirect(new URL("/visit?expired=1", base));
  }

  const res = NextResponse.redirect(new URL("/visit", base));
  res.cookies.set(SESSION_COOKIE, makeToken("session", SESSION_TTL_SECONDS, qr.d), {
    httpOnly: true,
    sameSite: "lax",
    secure: req.nextUrl.protocol === "https:",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });
  return res;
}
