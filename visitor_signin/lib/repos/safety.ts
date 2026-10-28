import type { Prisma } from "@prisma/client";
import type { SafetyBriefing, SafetyRule } from "../db";
import { prisma } from "../prisma";

// The single SafetyBriefing row (id "main"). Missing until an admin saves one.

export async function getSafetyRow(): Promise<SafetyBriefing | null> {
  const s = await prisma.safetyBriefing.findUnique({ where: { id: "main" } });
  if (!s) return null;
  return {
    enabled: s.enabled,
    version: s.version,
    emergencyPhone: s.emergencyPhone,
    assemblyPoint: s.assemblyPoint,
    notes: s.notes,
    rules: s.rules as SafetyRule[],
    exitPlan: s.exitPlan,
    updatedAt: s.updatedAt.toISOString(),
  };
}

export async function saveSafetyRow(b: Omit<SafetyBriefing, "updatedAt">) {
  const data = { ...b, rules: b.rules as unknown as Prisma.InputJsonValue };
  await prisma.safetyBriefing.upsert({ where: { id: "main" }, create: { id: "main", ...data }, update: data });
}
