import { prisma } from "../prisma";

// The single Settings row (id "main"). Empty fields mean "use the default from lib/config.ts".

export type SettingsRow = { escalateMinutes: number | null; autoSignoutTime: string | null; retentionDays: number | null };

export async function getSettingsRow(): Promise<SettingsRow | null> {
  return prisma.settings.findUnique({
    where: { id: "main" },
    select: { escalateMinutes: true, autoSignoutTime: true, retentionDays: true },
  });
}

export async function saveSettingsRow(values: { escalateMinutes: number; autoSignoutTime: string; retentionDays: number }) {
  await prisma.settings.upsert({ where: { id: "main" }, create: { id: "main", ...values }, update: values });
}
