// Starting data for a fresh database: staff accounts, employees and the four visitor types.
//
//   npx prisma db seed        (also runs after `npx prisma migrate reset`)
//
// Does nothing if the database already has staff, so it never overwrites real data. Change the
// starting passwords (and PINs) before anyone else can reach the app.

import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Same format as lib/password.ts: "salt:hash" with scrypt.
const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString("hex");
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString("hex")}`;
};

// Every employee starts with this PIN for signing in at reception; each changes it on My account.
const STARTING_PIN = "1234";

const HOSTS = [
  { id: "h1", name: "Anita Sharma", email: "anita@example.com", phone: "1111111111", department: "Engineering" },
  { id: "h2", name: "Rahul Verma", email: "rahul@example.com", phone: "2222222222", department: "Sales" },
  { id: "h3", name: "Priya Nair", email: "priya@example.com", phone: "3333333333", department: "HR" },
  { id: "h4", name: "Arjun Reddy", email: "arjun@example.com", phone: "4444444444", department: "Finance" },
  { id: "h5", name: "Meera Iyer", email: "meera@example.com", phone: "5555555555", department: "Operations" },
  { id: "h6", name: "Kiran Kumar", email: "kiran@example.com", phone: "6666666666", department: "Facilities" },
];

const STAFF = [
  { username: "admin", password: "admin123", name: "Admin User", role: "admin" },
  { username: "reception", password: "reception123", name: "Front Desk", role: "receptionist" },
  { username: "host", password: "host123", name: "Priya Nair", role: "host", hostId: "h3" },
  { username: "security", password: "security123", name: "Security Officer", role: "security" },
];

// The types named in the requirements (FR-KIO-04): Guest, Contractor, Interview, Delivery.
const VISITOR_TYPES = [
  {
    id: "guest", label: "Guest", description: "Meeting someone", color: "#2563eb", photoRequired: true, agreementRequired: true,
    fields: { company: "optional", email: "optional", purpose: "optional" },
    questions: [],
  },
  {
    id: "contractor", label: "Contractor", description: "Here to do work on site", color: "#d97706", photoRequired: true, agreementRequired: true,
    fields: { company: "required", email: "optional", purpose: "hidden" },
    questions: [
      { id: "q-work", label: "What work are you doing today?", kind: "text", required: true },
      { id: "q-induction", label: "Have you completed our site safety induction?", kind: "yesno", required: true },
    ],
  },
  {
    id: "interview", label: "Interview", description: "Here for a job interview", color: "#7c3aed", photoRequired: false, agreementRequired: true,
    fields: { company: "hidden", email: "optional", purpose: "hidden" },
    questions: [{ id: "q-role", label: "Which role are you interviewing for?", kind: "text", required: false }],
  },
  {
    id: "delivery", label: "Delivery", description: "Dropping off a parcel or food", color: "#059669", photoRequired: false, agreementRequired: false,
    fields: { company: "required", email: "hidden", purpose: "hidden" },
    approvalRequired: false, // couriers drop off at reception; no need to wait for a host
    questions: [
      { id: "q-parcel", label: "What are you delivering?", kind: "select", required: true, options: ["Parcel", "Documents", "Food", "Other"] },
    ],
  },
];

async function main() {
  if (await prisma.staffUser.count()) {
    console.log("The database already has staff accounts; nothing seeded.");
    return;
  }
  await prisma.host.createMany({
    data: HOSTS.map((h) => ({ ...h, pinHash: hashPassword(STARTING_PIN), qrToken: crypto.randomBytes(18).toString("base64url") })),
    skipDuplicates: true,
  });
  await prisma.staffUser.createMany({ data: STAFF.map(({ password, ...s }) => ({ ...s, passwordHash: hashPassword(password) })) });
  await prisma.visitorType.createMany({ data: VISITOR_TYPES.map((t, i) => ({ ...t, approvalRequired: t.approvalRequired !== false, sortOrder: i })), skipDuplicates: true });
  console.log(`Seeded ${STAFF.length} staff accounts, ${HOSTS.length} employees and ${VISITOR_TYPES.length} visitor types.`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
