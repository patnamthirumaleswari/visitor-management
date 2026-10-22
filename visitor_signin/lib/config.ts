// Prototype configuration. In the full product these come from the Location and
// VisitorType tables managed in the admin portal (FR-LOC-02, FR-KIO-04/05).
import type { VisitorType } from "./db";

export const LOCATION = {
  id: "hq",
  name: "Head Office",
  company: "Acme Pvt Ltd",
  timezone: "Asia/Kolkata", // decides what "today" means for invitations
  address: "4th Floor, Example Tech Park, Hitech City, Hyderabad 500081", // shown in invitations (FR-PRE-02)
  welcomeText: "Welcome! Scan to sign in on your phone",
};

// Visitor types now live in data/db.json and are managed on /admin/visitor-types (FR-KIO-04/05/07).
// These are only the starting set, copied into db.json the first time the app runs.
// The types named in the requirements (FR-KIO-04): Guest, Contractor, Interview, Delivery.
export const STARTING_VISITOR_TYPES: Omit<VisitorType, "active">[] = [
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
    questions: [
      { id: "q-parcel", label: "What are you delivering?", kind: "select", required: true, options: ["Parcel", "Documents", "Food", "Other"] },
    ],
  },
];

export const AGREEMENT = {
  version: "2026-10",
  title: "Visitor agreement",
  text: [
    "I will keep confidential any information I see or hear during my visit.",
    "I will follow all safety instructions and stay with my host in restricted areas.",
    "I consent to my name, phone, photo and signature being stored for site security and evacuation. Records are deleted after 90 days.",
  ],
};

// Anyone still signed in is signed out automatically at this local time (FR-KIO-10), e.g. visitors
// who left without signing out. Set to null to turn it off.
export const AUTO_SIGNOUT_TIME: string | null = "20:00";

// The kiosk QR changes every QR_ROTATE_SECONDS; each code stays valid for QR_TTL_SECONDS,
// so a photo of the code shared outside the building stops working within ~90 s.
export const QR_ROTATE_SECONDS = 30;
export const QR_TTL_SECONDS = 90;

// Once scanned, the visitor has this long to finish the form on their phone.
export const SESSION_TTL_SECONDS = 20 * 60;

// Employee sign-in at reception (FR-EMP-01).
export const MAX_PIN_FAILURES = 5; // wrong PINs in a row before the PIN locks
export const PIN_LOCK_MINUTES = 5;
// Scanning the same personal QR again within this time doesn't sign the person straight back out.
export const REPEAT_SCAN_SECONDS = 60;
// What an employee's personal QR code contains, followed by their token.
export const EMPLOYEE_QR_PREFIX = "vms-employee:";
