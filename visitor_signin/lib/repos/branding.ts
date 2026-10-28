import type { Branding } from "../db";
import { prisma } from "../prisma";

// The single Branding row (id "main"). Missing until an admin saves branding.

export async function getBrandingRow(): Promise<Branding | null> {
  const b = await prisma.branding.findUnique({ where: { id: "main" } });
  if (!b) return null;
  return {
    ...(b.companyName ? { companyName: b.companyName } : {}),
    ...(b.welcomeText ? { welcomeText: b.welcomeText } : {}),
    ...(b.primaryColor ? { primaryColor: b.primaryColor } : {}),
    ...(b.logo ? { logo: b.logo } : {}),
    updatedAt: b.updatedAt.toISOString(),
  };
}

/** `logo`: a data URL to set, null to remove, undefined to keep the current one. */
export async function saveBrandingRow(values: { companyName: string; welcomeText: string; primaryColor: string; logo?: string | null }) {
  const data = { companyName: values.companyName, welcomeText: values.welcomeText, primaryColor: values.primaryColor, ...(values.logo === undefined ? {} : { logo: values.logo }) };
  await prisma.branding.upsert({ where: { id: "main" }, create: { id: "main", ...data }, update: data });
}
