import os from "node:os";

/**
 * The address a visitor's phone uses to reach this server — this is what the QR encodes.
 * "localhost" would point the phone at itself, so in dev we fall back to the PC's LAN IP.
 */
export function publicBaseUrl(): string {
  const configured = process.env.PUBLIC_BASE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const port = process.env.PORT || "3000";
  const addresses = Object.values(os.networkInterfaces())
    .flat()
    .filter((a) => a && a.family === "IPv4" && !a.internal)
    .map((a) => a!.address);
  // Prefer the usual home/office Wi-Fi range over virtual adapters (WSL, Hyper-V, VPN).
  const lan = addresses.find((a) => a.startsWith("192.168.")) ?? addresses[0];
  return `http://${lan ?? "localhost"}:${port}`;
}
