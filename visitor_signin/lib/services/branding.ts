import { resolveBranding, type ResolvedBranding } from "../branding";
import { getBrandingRow, saveBrandingRow } from "../repos/branding";

// Company branding (FR-KIO-03, FR-BAD-02, FR-ADM-06): what's saved, with the defaults filled in.

export async function getBranding(): Promise<ResolvedBranding> {
  return resolveBranding((await getBrandingRow()) ?? {});
}

/** Saves already-checked values. `logo`: data URL to set, null to remove, undefined to keep. */
export async function saveBranding(values: { companyName: string; welcomeText: string; primaryColor: string; logo?: string | null }): Promise<ResolvedBranding> {
  await saveBrandingRow({ ...values, primaryColor: values.primaryColor.toLowerCase() });
  return getBranding();
}
