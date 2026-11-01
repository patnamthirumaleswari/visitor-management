import os from "node:os";

/**
 * The address a visitor's phone uses to reach this server — this is what the QR encodes.
 * Set PUBLIC_BASE_URL when hosted (e.g. on Cloudflare: https://visitor-connect.<account>.workers.dev).
 * "localhost" would point the phone at itself, so in dev we fall back to the PC's LAN IP.
 */
export function publicBaseUrl(): string {
  const configured = process.env.PUBLIC_BASE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const port = process.env.PORT || "3000";
  let addresses: string[] = [];
  try {
    addresses = Object.values(os.networkInterfaces())
      .flat()
      .filter((a) => a && a.family === "IPv4" && !a.internal)
      .map((a) => a!.address);
  } catch {
    // No network details where this runs (Cloudflare Workers): PUBLIC_BASE_URL must be set there.
  }
  // Prefer the usual home/office Wi-Fi range over virtual adapters (WSL, Hyper-V, VPN).
  const lan = addresses.find((a) => a.startsWith("192.168.")) ?? addresses[0];
  return `http://${lan ?? "localhost"}:${port}`;
}
