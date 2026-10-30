// One-off: copy data/db.json (the old prototype store) into Supabase.
//
//   node scripts/import-json.mjs            refuses if the database already has visits or staff
//   node scripts/import-json.mjs --replace  empties the tables first, then imports
//
// Reads DATABASE_URL from .env (Prisma loads it). Records that point at something missing (for
// example a notification for a deleted visit) are skipped and counted.

import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const replace = process.argv.includes("--replace");
const file = path.join(process.cwd(), "data", "db.json");
const d = JSON.parse(fs.readFileSync(file, "utf8"));
const date = (s) => (s ? new Date(s) : null);
const skipped = {};
const skip = (what) => (skipped[what] = (skipped[what] ?? 0) + 1);

async function main() {
  const existing = (await prisma.visit.count()) + (await prisma.staffUser.count());
  if (existing && !replace) {
    console.log("The database already has data. Run with --replace to empty it and import again.");
    return;
  }
  if (replace) {
    // Children before parents, so foreign keys don't block the deletes.
    for (const m of ["notificationRead", "notification", "timelineEvent", "invitation", "visit", "visitor", "employeeVisit",
      "staffUser", "host", "visitorType", "watchEntry", "auditEntry", "usedSession", "loginAttempt", "branding", "safetyBriefing", "settings"]) {
      await prisma[m].deleteMany();
    }
  }

  // Visitor types (every visit needs its type to exist).
  const types = d.visitorTypes ?? [];
  const typeIds = new Set(types.map((t) => t.id));
  for (const v of d.visits ?? []) {
    if (!typeIds.has(v.visitorType)) {
      types.push({ id: v.visitorType, label: v.visitorType, description: "", color: "#64748b", photoRequired: false, agreementRequired: false, questions: [], active: false });
      typeIds.add(v.visitorType);
    }
  }
  await prisma.visitorType.createMany({
    data: types.map((t, i) => ({
      id: t.id, label: t.label, description: t.description ?? "", color: t.color, fields: t.fields ?? {},
      photoRequired: !!t.photoRequired, agreementRequired: !!t.agreementRequired, approvalRequired: t.approvalRequired !== false,
      questions: t.questions ?? [], active: t.active !== false, sortOrder: i,
    })),
  });

  await prisma.host.createMany({
    data: (d.hosts ?? []).map((h) => ({
      id: h.id, name: h.name, email: h.email ?? "", phone: h.phone ?? "", department: h.department ?? "",
      notifyBy: h.notifyBy?.length ? h.notifyBy : ["email"], pinHash: h.pinHash ?? null, pinFailures: h.pinFailures ?? 0,
      pinLockedUntil: date(h.pinLockedUntil), qrToken: h.qrToken ?? null, active: h.active !== false,
    })),
  });
  const hostIds = new Set((d.hosts ?? []).map((h) => h.id));

  await prisma.staffUser.createMany({
    data: (d.staff ?? []).map((s) => ({
      id: s.id, username: s.username, name: s.name, role: s.role, passwordHash: s.passwordHash,
      active: s.active !== false, mustChangePassword: !!s.mustChangePassword, hostId: s.hostId && hostIds.has(s.hostId) ? s.hostId : null,
    })),
  });
  const staffIds = new Set((d.staff ?? []).map((s) => s.id));

  await prisma.visitor.createMany({
    data: (d.visitors ?? []).map((p) => ({ id: p.id, name: p.name, phone: p.phone ?? "", email: p.email ?? "", company: p.company ?? "", photo: p.photo ?? null })),
  });
  const visitorIds = new Set((d.visitors ?? []).map((p) => p.id));

  const visits = (d.visits ?? []).filter((v) => (visitorIds.has(v.visitorId) && hostIds.has(v.hostId)) || (skip("visits (missing visitor or host)"), false));
  await prisma.visit.createMany({
    data: visits.map((v) => ({
      id: v.id, visitorId: v.visitorId, hostId: v.hostId, locationId: v.locationId ?? "hq", visitorTypeId: v.visitorType,
      purpose: v.purpose ?? "", status: v.status, source: v.source ?? "qr", expectedDate: v.expectedDate ?? null, no: v.no ?? null,
      code: v.code ?? null, badgeToken: v.badgeToken, checkedInAt: date(v.checkedInAt), signedInAt: date(v.signedInAt),
      decidedAt: date(v.decidedAt), decidedBy: v.decidedBy ?? null, decisionNote: v.decisionNote ?? null, escalated: !!v.escalated,
      checkoutRequestedAt: date(v.checkoutRequestedAt), checkoutEscalated: !!v.checkoutEscalated, checkoutNote: v.checkoutNote ?? null,
      holdReason: v.hold?.reason ?? null, holdBy: v.hold?.by ?? null, holdAt: date(v.hold?.at), watchName: v.watch?.name ?? null,
      watchReason: v.watch?.reason ?? null, signedOutAt: date(v.signedOutAt), signedOutBy: v.signedOutBy ?? null,
      agreementVersion: v.agreementVersion ?? null, signature: v.signature ?? null, answers: v.answers ?? [],
      safetyVersion: v.safetyVersion ?? null, ageConfirmed: !!v.ageConfirmed, consentAt: date(v.consentAt),
    })),
  });
  const visitIds = new Set(visits.map((v) => v.id));

  await prisma.timelineEvent.createMany({
    data: visits.flatMap((v) => (v.timeline ?? []).map((e) => ({ visitId: v.id, at: new Date(e.at), event: e.event, by: e.by }))),
  });

  await prisma.invitation.createMany({
    data: (d.invitations ?? []).filter((i) => visitIds.has(i.visitId) || (skip("invitations"), false)).map((i) => ({
      id: i.id, visitId: i.visitId, qrToken: i.qrToken, validFrom: i.validFrom, validTo: i.validTo, createdAt: new Date(i.createdAt), usedAt: date(i.usedAt),
    })),
  });

  const notes = (d.notifications ?? []).filter((n) => visitIds.has(n.visitId) || (skip("notifications"), false));
  await prisma.notification.createMany({
    data: notes.map((n) => ({
      id: n.id, kind: n.kind ?? "arrival", visitId: n.visitId, hostId: n.hostId && hostIds.has(n.hostId) ? n.hostId : null,
      to: n.to ?? "", channel: n.channel ?? "email", status: n.status ?? "logged", error: n.error ?? null, sentAt: new Date(n.sentAt),
    })),
  });
  await prisma.notificationRead.createMany({
    data: notes.flatMap((n) => (n.readBy ?? []).filter((s) => staffIds.has(s)).map((staffUserId) => ({ notificationId: n.id, staffUserId }))),
  });

  await prisma.employeeVisit.createMany({
    data: (d.employeeVisits ?? []).filter((e) => hostIds.has(e.hostId) || (skip("employee sign-ins"), false)).map((e) => ({
      id: e.id, hostId: e.hostId, locationId: e.locationId ?? "hq", method: e.method, signedInAt: new Date(e.signedInAt),
      signedOutAt: date(e.signedOutAt), signedOutBy: e.signedOutBy ?? null,
    })),
  });

  await prisma.watchEntry.createMany({
    data: (d.watchlist ?? []).map((w) => ({ id: w.id, name: w.name ?? "", phone: w.phone ?? "", company: w.company ?? "", reason: w.reason, active: w.active !== false, by: w.by, at: new Date(w.at) })),
  });
  await prisma.auditEntry.createMany({
    data: (d.audit ?? []).map((a) => ({ id: a.id, at: new Date(a.at), action: a.action, by: a.by, role: a.role, detail: a.detail ?? "", ip: a.ip ?? "" })),
  });
  await prisma.usedSession.createMany({ data: [...new Set(d.usedSessions ?? [])].map((nonce) => ({ nonce })), skipDuplicates: true });

  if (d.branding) {
    const { companyName, welcomeText, primaryColor, logo } = d.branding;
    await prisma.branding.create({ data: { companyName, welcomeText, primaryColor, logo } });
  }
  if (d.safety) {
    const s = d.safety;
    await prisma.safetyBriefing.create({
      data: { enabled: s.enabled !== false, version: s.version ?? 1, emergencyPhone: s.emergencyPhone ?? "", assemblyPoint: s.assemblyPoint ?? "", notes: s.notes ?? [], rules: s.rules ?? [], exitPlan: s.exitPlan ?? null },
    });
  }
  await prisma.settings.create({
    data: { escalateMinutes: d.settings?.escalateMinutes ?? null, autoSignoutTime: d.settings?.autoSignoutTime ?? null, retentionDays: d.settings?.retentionDays ?? null, lastVisitNo: d.counters?.visitNo ?? null },
  });

  const counts = {
    "visitor types": await prisma.visitorType.count(), hosts: await prisma.host.count(), staff: await prisma.staffUser.count(),
    visitors: await prisma.visitor.count(), visits: await prisma.visit.count(), "timeline events": await prisma.timelineEvent.count(),
    invitations: await prisma.invitation.count(), notifications: await prisma.notification.count(),
    "employee sign-ins": await prisma.employeeVisit.count(), watchlist: await prisma.watchEntry.count(), "audit entries": await prisma.auditEntry.count(),
  };
  console.log("Imported:", counts);
  if (Object.keys(skipped).length) console.log("Skipped (pointed at something missing):", skipped);
}

main()
  .catch((e) => {
    console.error("Import failed:", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
