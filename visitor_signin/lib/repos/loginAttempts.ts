import { prisma } from "../prisma";

// Wrong-password counts per "username|ip" (table LoginAttempt), for the login lock.

export type LoginAttempt = { count: number; firstAt: Date; lockedUntil: Date | null };

export async function getAttempt(key: string): Promise<LoginAttempt | null> {
  return prisma.loginAttempt.findUnique({ where: { key }, select: { count: true, firstAt: true, lockedUntil: true } });
}

export async function saveAttempt(key: string, a: LoginAttempt) {
  await prisma.loginAttempt.upsert({ where: { key }, create: { key, ...a }, update: a });
}

export async function clearAttempt(key: string) {
  await prisma.loginAttempt.deleteMany({ where: { key } });
}
