import type { Metadata, Viewport } from "next";
import { getBranding } from "@/lib/branding";
import "./globals.css";

export const metadata: Metadata = {
  title: "Visitor Sign-In",
  description: "Touchless visitor sign-in",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // The brand colour from /admin/branding replaces the default blue on every page (FR-ADM-06).
  const { primaryColor, primaryText } = getBranding();
  return (
    <html lang="en">
      <body style={{ ["--primary" as string]: primaryColor, ["--primary-text" as string]: primaryText }}>{children}</body>
    </html>
  );
}
