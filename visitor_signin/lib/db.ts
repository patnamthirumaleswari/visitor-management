// Prototype storage: one JSON file under ./data. Every function goes through read()/write(),
// so swapping this module for PostgreSQL (Prisma/Drizzle) later doesn't touch the routes.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { STARTING_VISITOR_TYPES } from "./config";
import { hashPassword } from "./password";

export type NotificationChannel = "email" | "sms";

// Visitor types and their questions, managed on /admin/visitor-types (FR-KIO-04/05/07).
export type QuestionKind = "text" | "select" | "yesno" | "date";

export type Question = {
  id: string;
  label: string;
  kind: QuestionKind;
  required: boolean;
  options?: string[]; // for "select"
};

// Whether a standard sign-in field is asked for this visitor type (FR-KIO-05).
// Name and mobile number are always asked: the mobile number recognises returning visitors.
export type FieldMode = "hidden" | "optional" | "required";
export type StandardField = "company" | "email" | "purpose";

export type VisitorType = {
  id: string;
  label: string;
  description: string;
  color: string; // "#rrggbb", used on the badge and staff lists
  fields?: Partial<Record<StandardField, FieldMode>>; // missing = "optional"
  photoRequired: boolean; // FR-KIO-07
  agreementRequired: boolean;
  approvalRequired?: boolean; // host must approve entry; missing = yes
  questions: Question[];
  active: boolean; // hidden types aren't offered at sign-in, but old visits keep them
};

// An answer is stored with the question's wording at the time, so editing a question later
// doesn't change what past visitors were asked.
export type Answer = { questionId: string; label: string; value: string };

export type Host = {
  id: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  notifyBy?: NotificationChannel[]; // how they want to hear about arrivals (FR-NOT-06); email if not set
  // Employee sign-in at reception (FR-EMP-01): a PIN (stored hashed) and a personal QR code.
  pinHash?: string;
  pinFailures?: number; // wrong PINs in a row; the PIN locks after MAX_PIN_FAILURES
  pinLockedUntil?: string;
  qrToken?: string;
};

// An employee's day at the office: signed in at reception, signed out when they leave (FR-EMP-01).
export type EmployeeVisit = {
  id: string;
  hostId: string;
  locationId: string;
  method: "pin" | "qr" | "portal";
  signedInAt: string;
  signedOutAt?: string;
  signedOutBy?: "pin" | "qr" | "portal" | "auto";
};

export type Visitor = {
  id: string;
  name: string;
  phone: string;
  email: string;
  company: string;
  photo?: string; // data URL (prototype); S3 URL in production
};

export type Visit = {
  id: string;
  visitorId: string;
  hostId: string;
  locationId: string;
  visitorType: string;
  purpose: string;
  // expected = pre-registered, not arrived yet (FR-PRE-01)
  // pending  = at reception, waiting for the host to approve entry (Visitor Connect)
  // signed_in = on site (approved, or invited, or a type that needs no approval)
  // denied   = the host or an admin did not approve entry
  // checkout = the visitor asked to leave; waiting for the host to confirm the visit is finished
  // gate     = cleared to leave; security checks the photo at the gate and releases them
  // hold     = security is holding them at the gate (reason in `hold`); the host or an admin clears it
  status: "expected" | "pending" | "signed_in" | "denied" | "checkout" | "gate" | "hold" | "signed_out";
  source: "qr" | "kiosk" | "portal";
  expectedDate?: string; // YYYY-MM-DD, for pre-registered visits
  no?: number; // visitor number, counting up at the location (101, 102, …)
  code?: string; // 4-digit visit code for "Find my visit", unique among open visits
  checkedInAt?: string; // when they arrived and checked in on their phone
  signedInAt?: string; // when entry started (approved, or straight away when no approval is needed)
  decidedAt?: string;
  decidedBy?: string; // name of who approved or denied, e.g. "Priya Nair (from email)"
  decisionNote?: string; // optional note shown to the visitor when entry isn't approved
  escalated?: boolean; // the host didn't answer in time and reception was told
  checkoutRequestedAt?: string;
  checkoutEscalated?: boolean; // nobody confirmed the checkout in time and reception was told
  checkoutNote?: string; // why the host said "not yet", shown to the visitor
  hold?: { reason: string; by: string; at: string }; // why security is holding them at the gate
  timeline?: TimelineEvent[]; // what happened, in order; becomes the gate pass record in Stage 3
  signedOutAt?: string;
  // How they signed out (FR-KIO-10): badge on their phone, reception screen, staff portal, or the
  // automatic end-of-day sign-out. Missing on visits signed out before this was recorded.
  signedOutBy?: "badge" | "kiosk" | "portal" | "auto" | "gate"; // "gate" = released by security
  badgeToken: string;
  agreementVersion?: string;
  signature?: string; // data URL of the finger signature
  answers?: Answer[]; // the visitor type's questions, answered at sign-in (FR-KIO-05)
  safetyVersion?: number; // the safety briefing version the visitor read and accepted
  ageConfirmed?: boolean; // ticked "I am 18 years of age or older"
  consentAt?: string; // when they agreed to their details and photo being recorded
};

// One message sent (or attempted). "logged" = provider not configured, printed to the console instead.
export type Notification = {
  id: string;
  kind?: "arrival" | "invitation" | "approval" | "escalation" | "checkout" | "hold"; // missing on records from before invitations were sent
  visitId: string;
  hostId?: string;
  to: string;
  channel: NotificationChannel;
  status: "logged" | "sent" | "failed";
  error?: string;
  sentAt: string;
};

// The invite a host sends before the visit (FR-PRE-02). qrToken is what the invite link/QR carries.
export type Invitation = {
  id: string;
  visitId: string;
  qrToken: string;
  validFrom: string; // YYYY-MM-DD
  validTo: string; // YYYY-MM-DD
  createdAt: string;
  usedAt?: string;
};

// Staff who log in to the portal (section 2 roles). A "host" account is linked to a Host
// record so they can only invite visitors for themselves.
export type StaffRole = "admin" | "receptionist" | "host" | "security";

export type StaffUser = {
  id: string;
  username: string;
  name: string;
  role: StaffRole;
  hostId?: string;
  passwordHash: string;
};

// Company branding set on /admin/branding (FR-KIO-03, FR-BAD-02, FR-ADM-06). Missing fields
// fall back to the defaults in lib/branding.ts.
export type Branding = {
  companyName?: string;
  welcomeText?: string;
  primaryColor?: string; // "#rrggbb"
  logo?: string; // small PNG/JPEG/WebP data URL (prototype); file storage in production
  updatedAt?: string;
};

export type TimelineEvent = { at: string; event: string; by: string };

// Site safety briefing (Visitor Connect), edited on /admin/safety. See lib/safety.ts.
export type SafetyRule = { kind: string; text: string };
export type SafetyBriefing = {
  enabled: boolean; // visitors must read and accept it before signing in
  version: number; // goes up each time a change is saved; visits record the version they accepted
  emergencyPhone: string;
  assemblyPoint: string;
  notes: string[]; // "Before you start" notes, e.g. a fire drill this week
  rules: SafetyRule[];
  exitPlan: string | null; // picture of the exit plan (data URL, prototype); file storage in production
  updatedAt: string;
};

export type Data = {
  counters?: { visitNo: number }; // last visitor number handed out
  safety?: SafetyBriefing; // missing until an admin saves one: the starting briefing in lib/safety.ts applies
  visitorTypes: VisitorType[];
  branding?: Branding;
  staff: StaffUser[];
  hosts: Host[];
  visitors: Visitor[];
  visits: Visit[];
  invitations: Invitation[];
  usedSessions: string[];
  notifications: Notification[];
  employeeVisits: EmployeeVisit[];
};

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

// Starting accounts, taken from the staff login in the old Vite client (client/src/login/users.js).
// Change these passwords before anyone else can reach the app.
const SEED_STAFF: Array<Omit<StaffUser, "id" | "passwordHash"> & { password: string }> = [
  { username: "admin", password: "admin123", name: "Admin User", role: "admin" },
  { username: "reception", password: "reception123", name: "Front Desk", role: "receptionist" },
  { username: "host", password: "host123", name: "Priya Nair", role: "host", hostId: "h3" },
  { username: "security", password: "security123", name: "Security Officer", role: "security" },
];

function seedStaff(): StaffUser[] {
  return SEED_STAFF.map(({ password, ...user }) => ({ id: newId(), ...user, passwordHash: hashPassword(password) }));
}

// Every employee starts with this PIN so the reception sign-in can be tried straight away.
// Each employee changes it on /account.
const STARTING_PIN = "1234";

const SEED: Omit<Data, "staff" | "visitorTypes"> = {
  hosts: [
    { id: "h1", name: "Anita Sharma", email: "anita@example.com", phone: "+911111111111", department: "Engineering" },
    { id: "h2", name: "Rahul Verma", email: "rahul@example.com", phone: "+912222222222", department: "Sales" },
    { id: "h3", name: "Priya Nair", email: "priya@example.com", phone: "+913333333333", department: "HR" },
    { id: "h4", name: "Arjun Reddy", email: "arjun@example.com", phone: "+914444444444", department: "Finance" },
    { id: "h5", name: "Meera Iyer", email: "meera@example.com", phone: "+915555555555", department: "Operations" },
    { id: "h6", name: "Kiran Kumar", email: "kiran@example.com", phone: "+916666666666", department: "Facilities" },
  ],
  visitors: [],
  visits: [],
  invitations: [],
  usedSessions: [],
  notifications: [],
  employeeVisits: [],
};

function load(): Data {
  if (!fs.existsSync(DB_FILE)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify({ staff: seedStaff(), ...SEED }, null, 2));
  }
  const data = JSON.parse(fs.readFileSync(DB_FILE, "utf8")) as Data;
  data.invitations ??= []; // db.json files created before pre-registration existed
  if (!data.staff) {
    // db.json files created before staff login existed: add the starting accounts once.
    data.staff = seedStaff();
    save(data);
  }
  data.employeeVisits ??= []; // db.json files created before employee sign-in existed
  if (!data.visitorTypes) {
    // db.json files created before visitor types were editable: copy in the starting set, once.
    data.visitorTypes = STARTING_VISITOR_TYPES.map((t) => ({
      ...t,
      fields: { ...t.fields },
      questions: t.questions.map((q) => ({ ...q, ...(q.options ? { options: [...q.options] } : {}) })),
      active: true,
    }));
    save(data);
  }
  const delivery = data.visitorTypes.find((t) => t.id === "delivery");
  if (delivery && delivery.approvalRequired === undefined) {
    // Saved before host approval existed: couriers keep going straight in, as the starting set intends.
    delivery.approvalRequired = false;
    save(data);
  }
  if (data.hosts.some((h) => !h.pinHash || !h.qrToken)) {
    // Give employees from older db.json files a starting PIN and a personal QR, once.
    for (const host of data.hosts) {
      host.pinHash ??= hashPassword(STARTING_PIN);
      host.qrToken ??= crypto.randomBytes(18).toString("base64url");
    }
    save(data);
  }
  return data;
}

function save(data: Data) {
  const tmp = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

export function read<T>(fn: (data: Data) => T): T {
  return fn(load());
}

export function write<T>(fn: (data: Data) => T): T {
  const data = load();
  const result = fn(data);
  save(data);
  return result;
}

export const newId = () => crypto.randomUUID();

export const normalizePhone = (phone: string) => phone.replace(/[^\d+]/g, "");
