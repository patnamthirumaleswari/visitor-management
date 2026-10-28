import type { WatchEntry as WatchRow } from "@prisma/client";
import type { WatchEntry } from "../types";
import { prisma } from "../prisma";

// The watchlist (table WatchEntry, FR-SEC-01).

const toEntry = (w: WatchRow): WatchEntry => ({ id: w.id, name: w.name, phone: w.phone, company: w.company, reason: w.reason, active: w.active, by: w.by, at: w.at.toISOString() });

/** Newest first. */
export async function listWatchEntries(onlyActive = false): Promise<WatchEntry[]> {
  return (await prisma.watchEntry.findMany({ where: onlyActive ? { active: true } : {}, orderBy: { at: "desc" } })).map(toEntry);
}

export async function insertWatchEntry(e: Omit<WatchEntry, "id" | "at" | "active">): Promise<WatchEntry> {
  return toEntry(await prisma.watchEntry.create({ data: e }));
}

/** Returns null if there's no such entry. */
export async function setWatchEntryActive(id: string, active: boolean): Promise<WatchEntry | null> {
  const { count } = await prisma.watchEntry.updateMany({ where: { id }, data: { active } });
  if (!count) return null;
  return toEntry((await prisma.watchEntry.findUnique({ where: { id } }))!);
}

/** Returns the removed entry, or null if there was none. */
export async function deleteWatchEntry(id: string): Promise<WatchEntry | null> {
  const w = await prisma.watchEntry.findUnique({ where: { id } });
  if (!w) return null;
  await prisma.watchEntry.delete({ where: { id } });
  return toEntry(w);
}
