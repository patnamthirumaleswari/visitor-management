import { PrismaClient } from "@prisma/client";

// The one database connection for the server (Supabase PostgreSQL, see prisma/schema.prisma).
// Only lib/repos/* use it; pages, routes and services go through the repos.
//
// In development Next.js reloads modules on every edit, so the client is kept on globalThis to
// avoid opening a new pool of connections each time. On Cloudflare (later) a client is made per
// request instead, through Hyperdrive; see docs/ARCHITECTURE.md.

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
