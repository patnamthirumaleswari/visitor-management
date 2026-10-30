import type { Metadata, Viewport } from "next";
import { getBranding } from "@/lib/services/branding";
import "./globals.css";

export const metadata: Metadata = {
  title: "Visitor Connect",
  description: "Visitor check-in, approvals and gate release",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#4F46E5",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The brand colour from /admin/branding replaces the default indigo on every page (FR-ADM-06).
  const { primaryColor, primaryText } = await getBranding();
  return (
    <html lang="en">
      <head>
        {/* Fonts from the Visitor Connect design; the page falls back to system fonts if these can't load. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap"
        />
      </head>
      <body style={{ ["--primary" as string]: primaryColor, ["--primary-text" as string]: primaryText }}>
        {/* Soft moving colour blobs behind the glass panels */}
        <div className="mesh" aria-hidden="true"><i /><i /><i /><i /></div>
        <div className="app-root">{children}</div>
      </body>
    </html>
  );
}
