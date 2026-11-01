import { getCloudflareContext } from "@opennextjs/cloudflare";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// The database connection for the server (Supabase PostgreSQL, see prisma/schema.prisma).
// Only lib/repos/* use it; pages, routes and services go through the repos.
//
// - On your computer (`npm run dev`, scripts): one shared client. Next.js reloads modules on every
//   edit, so it's kept on globalThis to avoid opening new connections each time.
// - On Cloudflare Workers: a new client for each request. Workers can't share a connection between
//   requests, so the client is tied to the request and never reused (maxUses: 1). The connection
//   goes through Hyperdrive when it's set up, otherwise straight to Supabase (DIRECT_URL).

// Set in wrangler.jsonc ("vars"), so it's only "cloudflare" when running on Workers or `npm run preview`.
// Read on each call: Workers fill in process.env when a request arrives.
const onWorkers = () => process.env.RUNTIME === "cloudflare";

type HyperdriveEnv = { HYPERDRIVE?: { connectionString: string } };

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/** One client per request on Workers, keyed by the request's execution context. */
const perRequest = new WeakMap<object, PrismaClient>();

function workersClient(): PrismaClient {
  const { env, ctx } = getCloudflareContext();
  let client = perRequest.get(ctx);
  if (!client) {
    const connectionString = (env as HyperdriveEnv).HYPERDRIVE?.connectionString ?? process.env.DIRECT_URL ?? process.env.DATABASE_URL;
    if (!connectionString) throw new Error("No database connection: set up Hyperdrive or the DIRECT_URL secret.");
    // Prisma's WebAssembly build, named explicitly: the Cloudflare build would otherwise pick Prisma's Node
    // version (its package lists "node" before "workerd"), which can't run there. Loaded with require because
    // Prisma 6 ships only a CommonJS file for it (its "import" entry points to a wasm.mjs that doesn't exist).
    const { PrismaClient: WasmPrismaClient } = require("@prisma/client/wasm") as typeof import("@prisma/client");
    client = new WasmPrismaClient({ adapter: new PrismaPg({ connectionString, maxUses: 1 }) });
    perRequest.set(ctx, client);
  }
  return client;
}

function localClient(): PrismaClient {
  return (globalForPrisma.prisma ??= new PrismaClient());
}

/** The client for the current request: use it like a normal PrismaClient (`prisma.visit.findMany(...)`). */
export const prisma = new Proxy({} as PrismaClient, {
  get(_, property) {
    const client = onWorkers() ? workersClient() : localClient();
    const value = Reflect.get(client, property);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
