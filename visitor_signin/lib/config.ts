// Prototype configuration. In the full product these come from the Location and
// VisitorType tables managed in the admin portal (FR-LOC-02, FR-KIO-04/05).

export const LOCATION = {
  id: "hq",
  name: "Head Office",
  company: "InternFactory Private Limited",
  timezone: "Asia/Kolkata", // decides what "today" means for invitations
  address: "4th Floor, Example Tech Park, Hitech City, Hyderabad 500081", // shown in invitations (FR-PRE-02)
  welcomeText: "Welcome! Scan to check in on your phone",
};

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

// Host approval (Visitor Connect). A walk-in waits at reception until the host approves entry.
// If nobody answers within this many minutes, the request is marked escalated and reception is told.
export const ESCALATE_MINUTES = 5;
// Visitor numbers start here and count up (shown on the badge and staff lists).
export const FIRST_VISIT_NO = 101;
