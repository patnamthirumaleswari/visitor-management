import { LOCATION } from "./config";
import { dayAt, hourAt } from "./dates";
import { read, type Data, type Visit } from "./db";
import { typeDisplay } from "./visitorTypes";
import { listVisitorTypes } from "./services/visitorTypes";

// Analytics (FR-REP-01) and the CSV export (FR-REP-02). Everything is worked out from the visits in
// db.json; a visit counts on the day it checked in (or was signed in, for older records).

export const RANGES = [7, 14, 30] as const;
export type Range = (typeof RANGES)[number];

/** When the visit started: check-in on the phone, or sign-in for visits from before check-in existed. */
const startedAt = (v: Visit) => v.checkedInAt ?? v.signedInAt;

/** The first entry decision someone made (approve or not), from the timeline. */
const entryDecision = (v: Visit) => v.timeline?.find((e) => e.event === "Entry approved" || e.event === "Entry not approved");

/** Visits that started in the last `days` days at the location, today included. */
export function visitsInRange(d: Data, days: number): Visit[] {
  const first = dayAt(new Date(Date.now() - (days - 1) * 864e5).toISOString());
  return d.visits.filter((v) => {
    const at = startedAt(v);
    return !!at && dayAt(at) >= first;
  });
}

export type Analytics = {
  days: number;
  total: number;
  avgApprovalMin: number | null; // check-in → someone approved or turned them away
  avgStayMin: number | null; // entry → sign-out
  notApprovedPct: number | null; // of the visits someone decided on
  perDay: { day: string; count: number }[];
  perHour: number[]; // 24 buckets, location time
  topHosts: { name: string; count: number }[];
  byType: { label: string; color: string; count: number }[];
};

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const minutes = (from: string, to: string) => (new Date(to).getTime() - new Date(from).getTime()) / 60_000;

export async function getAnalytics(days: number): Promise<Analytics> {
  const visitorTypes = await listVisitorTypes();
  return read((d) => {
    const visits = visitsInRange(d, days);

    const perDay = Array.from({ length: days }, (_, i) => ({ day: dayAt(new Date(Date.now() - (days - 1 - i) * 864e5).toISOString()), count: 0 }));
    const perHour = Array<number>(24).fill(0);
    const hosts = new Map<string, number>();
    const types = new Map<string, number>();
    const approvalTimes: number[] = [];
    const stays: number[] = [];
    let decided = 0;
    let notApproved = 0;

    for (const v of visits) {
      const at = startedAt(v)!;
      const slot = perDay.find((p) => p.day === dayAt(at));
      if (slot) slot.count++;
      perHour[hourAt(at)]++;
      hosts.set(v.hostId, (hosts.get(v.hostId) ?? 0) + 1);
      types.set(v.visitorType, (types.get(v.visitorType) ?? 0) + 1);

      const decision = entryDecision(v);
      if (decision) {
        decided++;
        if (decision.event === "Entry not approved") notApproved++;
        if (v.checkedInAt) approvalTimes.push(minutes(v.checkedInAt, decision.at));
      }
      if (v.signedInAt && v.signedOutAt) stays.push(minutes(v.signedInAt, v.signedOutAt));
    }

    const rank = <T,>(m: Map<string, number>, f: (id: string, count: number) => T) =>
      [...m].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, count]) => f(id, count));

    return {
      days,
      total: visits.length,
      avgApprovalMin: avg(approvalTimes),
      avgStayMin: avg(stays),
      notApprovedPct: decided ? (notApproved / decided) * 100 : null,
      perDay,
      perHour,
      topHosts: rank(hosts, (id, count) => ({ name: d.hosts.find((h) => h.id === id)?.name ?? "Unknown", count })),
      byType: rank(types, (id, count) => ({ ...typeDisplay(visitorTypes, id), count })),
    };
  });
}

// ───────── CSV export (FR-REP-02) ─────────

const STATUS_LABELS: Record<Visit["status"], string> = {
  expected: "Expected",
  pending: "Waiting for approval",
  review: "Watchlist review",
  signed_in: "On site",
  denied: "Not approved",
  checkout: "Checking out",
  gate: "At the gate",
  hold: "Held at the gate",
  signed_out: "Signed out",
};

/** Quotes a cell; a leading = + - @ is defused so spreadsheets don't run it as a formula. */
function cell(value: unknown): string {
  let s = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/** "23/10/2026, 14:05" at the location. */
const local = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-GB", { timeZone: LOCATION.timezone, dateStyle: "short", timeStyle: "short" }) : "");

export async function visitsCsv(days: number): Promise<string> {
  const visitorTypes = await listVisitorTypes();
  return read((d) => {
    const header = ["Visitor no.", "Name", "Company", "Phone", "Email", "Type", "Host", "Status", "Checked in", "Entered", "Signed out", "Signed out by", "Decided by", "Watchlist"];
    const rows = visitsInRange(d, days)
      .sort((a, b) => (startedAt(b) ?? "").localeCompare(startedAt(a) ?? ""))
      .map((v) => {
        const p = d.visitors.find((x) => x.id === v.visitorId);
        return [
          v.no ?? "",
          p?.name,
          p?.company,
          p?.phone,
          p?.email,
          typeDisplay(visitorTypes, v.visitorType).label,
          d.hosts.find((h) => h.id === v.hostId)?.name,
          STATUS_LABELS[v.status],
          local(v.checkedInAt),
          local(v.signedInAt),
          local(v.signedOutAt),
          v.signedOutBy ?? "",
          v.decidedBy ?? "",
          v.watch ? `Yes: ${v.watch.reason}` : "",
        ];
      });
    // BOM so Excel opens it as UTF-8; CRLF line endings per RFC 4180.
    return "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
  });
}
