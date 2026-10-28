import { cookies } from "next/headers";
import { isSessionUsed } from "./repos/sessions";
import { readToken, type TokenPayload } from "./token";

export const SESSION_COOKIE = "vms_session";

/**
 * The sign-in session a phone gets after scanning the kiosk QR.
 * It is single-use: once a visit is created its nonce is recorded as used.
 */
export async function getSignInSession(): Promise<TokenPayload | null> {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = readToken(raw, "session");
  if (!session) return null;
  return (await isSessionUsed(session.n)) ? null : session;
}
