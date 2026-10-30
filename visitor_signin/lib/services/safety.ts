import type { SafetyBriefing } from "../types";
import { getSafetyRow, saveSafetyRow } from "../repos/safety";
import { startingBriefing } from "../safety";

// Site safety briefing (Visitor Connect). Every save that changes what visitors see publishes a new
// version; each visit records the version the visitor accepted.

/** The briefing visitors see now (the starting one until an admin saves their own). */
export async function getBriefing(): Promise<SafetyBriefing> {
  return (await getSafetyRow()) ?? startingBriefing();
}

/** `exitPlan`: data URL to set, null to remove, undefined to keep the current picture. */
export async function saveBriefing(next: Omit<SafetyBriefing, "version" | "updatedAt" | "exitPlan"> & { exitPlan?: string | null }): Promise<SafetyBriefing> {
  const current = await getBriefing();
  const merged = { ...next, exitPlan: next.exitPlan === undefined ? current.exitPlan : next.exitPlan };
  // Switching it on or off isn't a new version; changing any wording or picture is.
  const { enabled: _e, ...nextContent } = merged;
  const { enabled: _c, version: _v, updatedAt: _u, ...currentContent } = current;
  const changed = JSON.stringify(nextContent) !== JSON.stringify(currentContent);
  await saveSafetyRow({ ...merged, version: changed ? current.version + 1 : current.version });
  return getBriefing();
}
