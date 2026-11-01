import os from "node:os";
import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// In dev, Next.js blocks cross-origin requests for its dev assets. Phones load the app
// through this PC's LAN IP, so allow every local IPv4 address.
const lanAddresses = Object.values(os.networkInterfaces())
  .flat()
  .filter((a) => a && a.family === "IPv4" && !a.internal)
  .map((a) => a!.address);

const nextConfig: NextConfig = {
  allowedDevOrigins: lanAddresses,
  // Hosting on Cloudflare (@opennextjs/cloudflare): it patches the Prisma client for Workers, so the
  // client must be bundled as-is rather than inlined by Next.js.
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  // Files used only on Cloudflare, which Next.js's file tracing never sees, so they're copied in whole:
  // pg-cloudflare (the database driver's Workers connection) and Prisma's WebAssembly client (wasm.js).
  outputFileTracingIncludes: {
    "/*": ["./node_modules/pg-cloudflare/**/*", "./node_modules/.prisma/client/**/*", "./node_modules/@prisma/client/**/*"],
  },
};

export default nextConfig;

// Lets `npm run dev` see Cloudflare bindings (such as Hyperdrive) from wrangler.jsonc.
if (process.env.NODE_ENV === "development") initOpenNextCloudflareForDev();
