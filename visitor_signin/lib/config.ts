// Prototype configuration. In the full product these come from the Location and
// VisitorType tables managed in the admin portal (FR-LOC-02, FR-KIO-04/05).

export const LOCATION = {
  id: "hq",
  name: "Head Office",
  company: "Acme Pvt Ltd",
  timezone: "Asia/Kolkata", // decides what "today" means for invitations
  address: "4th Floor, Example Tech Park, Hitech City, Hyderabad 500081", // shown in invitations (FR-PRE-02)
  welcomeText: "Welcome! Scan to sign in on your phone",
};

export type VisitorTypeConfig = {
  id: string;
  label: string;
  description: string;
  color: string;
  photoRequired: boolean;
  agreementRequired: boolean;
};

export const VISITOR_TYPES: VisitorTypeConfig[] = [
  { id: "guest", label: "Guest", description: "Meeting someone", color: "#2563eb", photoRequired: true, agreementRequired: true },
  { id: "contractor", label: "Contractor", description: "Here to do work on site", color: "#d97706", photoRequired: true, agreementRequired: true },
  { id: "interview", label: "Interview", description: "Here for a job interview", color: "#7c3aed", photoRequired: false, agreementRequired: true },
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
