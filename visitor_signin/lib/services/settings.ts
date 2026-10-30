import { AUTO_SIGNOUT_TIME, ESCALATE_MINUTES } from "../config";
import { getSettingsRow, saveSettingsRow } from "../repos/settings";

// Site settings an admin changes on /admin/settings. Anything not saved yet uses the defaults in
// lib/config.ts.

export type Settings = {
  escalateMinutes: number; // tell reception when a request waits this long
  autoSignoutTime: string | null; // "20:00", or null for no automatic sign-out (FR-KIO-10)
  retentionDays: number; // visit records older than this are deleted (privacy); 0 = keep
};

// Matches the visitor agreement ("Records are deleted after 90 days").
export const DEFAULT_RETENTION_DAYS = 90;

export async function getSettings(): Promise<Settings> {
  const s = await getSettingsRow();
  return {
    escalateMinutes: s?.escalateMinutes ?? ESCALATE_MINUTES,
    autoSignoutTime: s?.autoSignoutTime == null ? AUTO_SIGNOUT_TIME : s.autoSignoutTime || null,
    retentionDays: s?.retentionDays ?? DEFAULT_RETENTION_DAYS,
  };
}

/** Saves already-checked values ("" = automatic sign-out off) and returns the settings now in force. */
export async function saveSettings(values: { escalateMinutes: number; autoSignoutTime: string; retentionDays: number }): Promise<Settings> {
  await saveSettingsRow(values);
  return getSettings();
}
