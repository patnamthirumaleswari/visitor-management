import { LOCATION } from "./config";
import { read, type Branding } from "./db";

// Company branding: logo, main colour, company name and the reception welcome text
// (FR-KIO-03, FR-BAD-02, FR-ADM-06). Admins change it on /admin/branding; until then these defaults apply.

export type ResolvedBranding = {
  companyName: string;
  welcomeText: string;
  primaryColor: string;
  primaryText: string; // black or white, whichever is readable on primaryColor
  logo: string | null;
};

export const DEFAULT_BRANDING = {
  companyName: LOCATION.company,
  welcomeText: LOCATION.welcomeText,
  primaryColor: "#2563eb",
};

export function getBranding(): ResolvedBranding {
  const saved: Branding = read((d) => d.branding ?? {});
  const primaryColor = isHexColor(saved.primaryColor) ? saved.primaryColor.toLowerCase() : DEFAULT_BRANDING.primaryColor;
  return {
    companyName: saved.companyName?.trim() || DEFAULT_BRANDING.companyName,
    welcomeText: saved.welcomeText?.trim() || DEFAULT_BRANDING.welcomeText,
    primaryColor,
    primaryText: readableTextOn(primaryColor),
    logo: saved.logo ?? null,
  };
}

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

/** White text on dark colours, near-black on light ones, so buttons stay readable whatever colour is picked. */
export function readableTextOn(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // WCAG contrast against white vs against #111827 (luminance 0.0092); pick the larger.
  return 1.05 / (luminance + 0.05) >= (luminance + 0.05) / (0.0092 + 0.05) ? "#ffffff" : "#111827";
}
