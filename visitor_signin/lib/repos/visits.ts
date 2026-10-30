import crypto from "node:crypto";
import type { Prisma, Visit as VisitRow, TimelineEvent as EventRow } from "@prisma/client";
import { FIRST_VISIT_NO } from "../config";
import type { Answer, Host, Visit, Visitor } from "../types";
import { prisma } from "../prisma";
import { toHost } from "./hosts";
import { toVisitor } from "./visitors";

// Visits and their history (tables Visit and TimelineEvent). Returns the app's Visit shape, so the
// rules in lib/approvals.ts work on plain objects. To change a visit, use changeVisit(): it locks the
// row, hands the visit to your function, and saves whatever it changed, all in one transaction.

export type Tx = Prisma.TransactionClient;
type Db = Tx | typeof prisma;

/** Statuses of visits still going on (waiting or on site). */
export const OPEN_STATUSES: Visit["status"][] = ["pending", "review", "signed_in", "checkout", "gate", "hold"];

const iso = (d: Date | null) => (d ? d.toISOString() : undefined);
const date = (s: string | undefined) => (s ? new Date(s) : null);

export function toVisit(v: VisitRow & { timeline?: EventRow[] }): Visit {
  const out: Visit = {
    id: v.id,
    visitorId: v.visitorId,
    hostId: v.hostId,
    locationId: v.locationId,
    visitorType: v.visitorTypeId,
    purpose: v.purpose,
    status: v.status,
    source: v.source,
    badgeToken: v.badgeToken,
    timeline: (v.timeline ?? []).map((e) => ({ at: e.at.toISOString(), event: e.event, by: e.by })),
  };
  const opt: Partial<Visit> = {
    expectedDate: v.expectedDate ?? undefined,
    no: v.no ?? undefined,
    code: v.code ?? undefined,
    checkedInAt: iso(v.checkedInAt),
    signedInAt: iso(v.signedInAt),
    decidedAt: iso(v.decidedAt),
    decidedBy: v.decidedBy ?? undefined,
    decisionNote: v.decisionNote ?? undefined,
    escalated: v.escalated || undefined,
    checkoutRequestedAt: iso(v.checkoutRequestedAt),
    checkoutEscalated: v.checkoutEscalated || undefined,
    checkoutNote: v.checkoutNote ?? undefined,
    hold: v.holdReason ? { reason: v.holdReason, by: v.holdBy ?? "", at: iso(v.holdAt) ?? "" } : undefined,
    watch: v.watchReason ? { name: v.watchName ?? "", reason: v.watchReason } : undefined,
    signedOutAt: iso(v.signedOutAt),
    signedOutBy: v.signedOutBy ?? undefined,
    agreementVersion: v.agreementVersion ?? undefined,
    signature: v.signature ?? undefined,
    answers: (v.answers as Answer[]).length ? (v.answers as Answer[]) : undefined,
    safetyVersion: v.safetyVersion ?? undefined,
    ageConfirmed: v.ageConfirmed || undefined,
    consentAt: iso(v.consentAt),
  };
  for (const [k, val] of Object.entries(opt)) if (val !== undefined) (out as Record<string, unknown>)[k] = val;
  return out;
}

/** Every column of a visit except its id and history, from the app's shape. */
function columns(v: Visit) {
  return {
    visitorId: v.visitorId,
    hostId: v.hostId,
    locationId: v.locationId,
    visitorTypeId: v.visitorType,
    purpose: v.purpose ?? "",
    status: v.status,
    source: v.source,
    expectedDate: v.expectedDate ?? null,
    no: v.no ?? null,
    code: v.code ?? null,
    badgeToken: v.badgeToken,
    checkedInAt: date(v.checkedInAt),
    signedInAt: date(v.signedInAt),
    decidedAt: date(v.decidedAt),
    decidedBy: v.decidedBy ?? null,
    decisionNote: v.decisionNote ?? null,
    escalated: !!v.escalated,
    checkoutRequestedAt: date(v.checkoutRequestedAt),
    checkoutEscalated: !!v.checkoutEscalated,
    checkoutNote: v.checkoutNote ?? null,
    holdReason: v.hold?.reason ?? null,
    holdBy: v.hold?.by ?? null,
    holdAt: date(v.hold?.at),
    watchName: v.watch?.name ?? null,
    watchReason: v.watch?.reason ?? null,
    signedOutAt: date(v.signedOutAt),
    signedOutBy: v.signedOutBy ?? null,
    agreementVersion: v.agreementVersion ?? null,
    signature: v.signature ?? null,
    answers: (v.answers ?? []) as unknown as Prisma.InputJsonValue,
    safetyVersion: v.safetyVersion ?? null,
    ageConfirmed: !!v.ageConfirmed,
    consentAt: date(v.consentAt),
  };
}

const WITH_TIMELINE = { timeline: { orderBy: { at: "asc" as const } } };

export async function findVisit(id: string, db: Db = prisma): Promise<Visit | null> {
  const v = await db.visit.findUnique({ where: { id }, include: WITH_TIMELINE });
  return v && toVisit(v);
}

export async function findVisits(where: Prisma.VisitWhereInput, orderBy: Prisma.VisitOrderByWithRelationInput = { checkedInAt: "desc" }, take?: number): Promise<Visit[]> {
  return (await prisma.visit.findMany({ where, orderBy, take, include: WITH_TIMELINE })).map(toVisit);
}

export type VisitWithPeople = { visit: Visit; visitor: Visitor; host: Host };

/** Visits with their visitor and host, for lists and screens that show names. */
export async function findVisitsWithPeople(where: Prisma.VisitWhereInput, orderBy: Prisma.VisitOrderByWithRelationInput = { checkedInAt: "desc" }, take?: number): Promise<VisitWithPeople[]> {
  const rows = await prisma.visit.findMany({ where, orderBy, take, include: { ...WITH_TIMELINE, visitor: true, host: true } });
  return rows.map((r) => ({ visit: toVisit(r), visitor: toVisitor(r.visitor), host: toHost(r.host) }));
}

export async function findVisitWithPeople(id: string): Promise<VisitWithPeople | null> {
  return (await findVisitsWithPeople({ id }))[0] ?? null;
}

export type TimelineItem = { at: string; event: string; by: string; visit: Visit; visitor: Visitor; host: Host };

/** History events since `since`, newest first, for the activity tracker (only `hostId`'s visits if given). */
export async function findRecentTimeline(since: Date, take: number, hostId?: string): Promise<TimelineItem[]> {
  const rows = await prisma.timelineEvent.findMany({
    where: { at: { gte: since }, ...(hostId ? { visit: { hostId } } : {}) },
    orderBy: { at: "desc" },
    take,
    include: { visit: { include: { visitor: true, host: true } } },
  });
  return rows.map((e) => ({ at: e.at.toISOString(), event: e.event, by: e.by, visit: toVisit(e.visit), visitor: toVisitor(e.visit.visitor), host: toHost(e.visit.host) }));
}

export async function countVisits(where: Prisma.VisitWhereInput): Promise<number> {
  return prisma.visit.count({ where });
}

/** Runs `fn` in one database transaction (used for changes that touch several tables). */
export function transaction<R>(fn: (tx: Tx) => Promise<R>): Promise<R> {
  return prisma.$transaction(fn, { timeout: 20_000 });
}

export async function insertVisit(tx: Tx, v: Visit) {
  await tx.visit.create({ data: { id: v.id, ...columns(v) } });
  const events = v.timeline ?? [];
  if (events.length) await tx.timelineEvent.createMany({ data: events.map((e) => ({ visitId: v.id, at: new Date(e.at), event: e.event, by: e.by })) });
}

/** Saves a changed visit: every column, plus history events added since `before`. */
export async function saveVisit(tx: Tx, before: Visit, after: Visit) {
  await tx.visit.update({ where: { id: after.id }, data: columns(after) });
  const added = (after.timeline ?? []).slice((before.timeline ?? []).length);
  if (added.length) await tx.timelineEvent.createMany({ data: added.map((e) => ({ visitId: after.id, at: new Date(e.at), event: e.event, by: e.by })) });
}

/**
 * Loads one visit with its row locked, lets `fn` change it, and saves the result, all in one
 * transaction, so two people acting at the same moment can't overwrite each other.
 * Returns null if there's no such visit. `fn` may also use `tx` for related rows.
 */
export async function changeVisit<R>(id: string, fn: (visit: Visit, tx: Tx) => R | Promise<R>): Promise<R | null> {
  return transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Visit" WHERE id = ${id} FOR UPDATE`;
    const visit = await findVisit(id, tx);
    if (!visit) return null;
    const before = structuredClone(visit);
    const result = await fn(visit, tx);
    await saveVisit(tx, before, visit);
    return result;
  });
}

/** The next visitor number, and a 4-digit code no open visit is using. Call inside a transaction. */
export async function nextNumberAndCode(tx: Tx): Promise<{ no: number; code: string }> {
  await tx.settings.upsert({ where: { id: "main" }, create: { id: "main" }, update: {} });
  const [row] = await tx.$queryRaw<{ lastVisitNo: number }[]>`
    UPDATE "Settings" SET "lastVisitNo" = GREATEST(COALESCE("lastVisitNo", 0), ${FIRST_VISIT_NO - 1}) + 1
    WHERE id = 'main' RETURNING "lastVisitNo"`;
  const used = new Set((await tx.visit.findMany({ where: { status: { in: OPEN_STATUSES }, code: { not: null } }, select: { code: true } })).map((v) => v.code));
  let code: string;
  do code = String(crypto.randomInt(1000, 10000));
  while (used.has(code));
  return { no: row.lastVisitNo, code };
}

export async function deleteVisits(ids: string[]) {
  if (ids.length) await prisma.visit.deleteMany({ where: { id: { in: ids } } }); // history, invitation, notifications go with them
}
