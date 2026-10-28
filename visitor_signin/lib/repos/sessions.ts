import { prisma } from "../prisma";
import type { Tx } from "./visits";

// One-time sign-in sessions already used (table UsedSession): one QR scan, one check-in.

export async function isSessionUsed(nonce: string, db: Tx | typeof prisma = prisma): Promise<boolean> {
  return (await db.usedSession.count({ where: { nonce } })) > 0;
}

/** Records the session as used. Returns false if it already was (two quick submits). */
export async function useSession(tx: Tx, nonce: string): Promise<boolean> {
  const { count } = await tx.usedSession.createMany({ data: [{ nonce }], skipDuplicates: true });
  return count === 1;
}
