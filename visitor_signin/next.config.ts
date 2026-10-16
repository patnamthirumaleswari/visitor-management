import os from "node:os";
import type { NextConfig } from "next";

// In dev, Next.js blocks cross-origin requests for its dev assets. Phones load the app
// through this PC's LAN IP, so allow every local IPv4 address.
const lanAddresses = Object.values(os.networkInterfaces())
  .flat()
  .filter((a) => a && a.family === "IPv4" && !a.internal)
  .map((a) => a!.address);

const nextConfig: NextConfig = {
  allowedDevOrigins: lanAddresses,
};

export default nextConfig;
