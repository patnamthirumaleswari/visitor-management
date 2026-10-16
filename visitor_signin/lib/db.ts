// Prototype storage: one JSON file under ./data. Every function goes through read()/write(),
// so swapping this module for PostgreSQL (Prisma/Drizzle) later doesn't touch the routes.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { hashPassword } from "./password";

export type NotificationChannel = "email" | "sms";

export type Host = {
  id: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  notifyBy?: NotificationChannel[]; // how they want to hear about arrivals (FR-NOT-06); email if not set
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
  // "expected" = pre-registered, not arrived yet (FR-PRE-01)
  status: "expected" | "signed_in" | "signed_out";
  source: "qr" | "kiosk" | "portal";
  expectedDate?: string; // YYYY-MM-DD, for pre-registered visits
  signedInAt?: string;
  signedOutAt?: string;
  badgeToken: string;
  agreementVersion?: string;
  signature?: string; // data URL of the finger signature
};

// One message sent (or attempted). "logged" = provider not configured, printed to the console instead.
export type Notification = {
  id: string;
  kind?: "arrival" | "invitation"; // missing on records from before invitations were sent
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

export type Data = {
  staff: StaffUser[];
  hosts: Host[];
  visitors: Visitor[];
  visits: Visit[];
  invitations: Invitation[];
  usedSessions: string[];
  notifications: Notification[];
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

const SEED: Omit<Data, "staff"> = {
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
