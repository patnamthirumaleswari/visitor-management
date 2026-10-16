import crypto from "node:crypto";

const SECRET = process.env.APP_SECRET || "dev-only-secret-change-me";

export type TokenKind = "qr" | "session" | "staff";

export type TokenPayload = {
  k: TokenKind; // what the token is for
  e: number; // expiry, unix seconds
  d: string; // data, e.g. location id
  n: string; // nonce, makes each token unique (used for single-use sessions)
};

function sign(body: string) {
  return crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
}

/** Signed, stateless token: nothing is stored until a visitor actually uses it. */
export function makeToken(kind: TokenKind, ttlSeconds: number, data = ""): string {
  const payload: TokenPayload = {
    k: kind,
    e: Math.floor(Date.now() / 1000) + ttlSeconds,
    d: data,
    n: crypto.randomBytes(9).toString("base64url"),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function readToken(token: string | undefined, kind: TokenKind): TokenPayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  const expected = Buffer.from(sign(body));
  const actual = Buffer.from(sig);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as TokenPayload;
    if (payload.k !== kind) return null;
    if (payload.e < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

export function randomToken(bytes = 18) {
  return crypto.randomBytes(bytes).toString("base64url");
}
