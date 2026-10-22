import QRCode from "qrcode";
import { publicBaseUrl } from "./baseUrl";
import { getBranding, type ResolvedBranding } from "./branding";
import { LOCATION, VISITOR_TYPES } from "./config";
import { read, type Visit } from "./db";

// Everything a visitor badge shows (FR-BAD-02), for the phone badge and the printed one.

export type BadgeData = {
  visit: Visit;
  branding: ResolvedBranding;
  visitorName: string;
  company: string;
  photo: string | null;
  hostName: string;
  typeLabel: string;
  typeColor: string;
  validDate: string; // "22 Oct 2026"
  signedInTime: string; // "09:42"
  qr: string; // data URL; the code holds the badge link, which the reception screen scans to sign out (FR-KIO-10)
};

/** Loads a badge. Pass the badge token for the visitor's own link; staff pages pass null after their own login check. */
export async function loadBadge(visitId: string, token: string | null): Promise<BadgeData | null> {
  const found = read((d) => {
    const visit = d.visits.find((v) => v.id === visitId);
    // An "expected" visit has no badge yet: the visitor hasn't signed in.
    if (!visit || visit.status === "expected") return null;
    if (token !== null && visit.badgeToken !== token) return null;
    return {
      visit,
      visitor: d.visitors.find((v) => v.id === visit.visitorId),
      host: d.hosts.find((h) => h.id === visit.hostId),
    };
  });
  if (!found?.visitor) return null;

  const { visit, visitor, host } = found;
  const type = VISITOR_TYPES.find((t) => t.id === visit.visitorType);
  const signedIn = new Date(visit.signedInAt ?? Date.now());
  const qr = await QRCode.toDataURL(`${publicBaseUrl()}/badge/${visit.id}?t=${visit.badgeToken}`, {
    margin: 1,
    width: 300,
    errorCorrectionLevel: "M",
  });

  return {
    visit,
    branding: getBranding(),
    visitorName: visitor.name,
    company: visitor.company,
    photo: visitor.photo ?? null,
    hostName: host?.name ?? "",
    typeLabel: type?.label ?? visit.visitorType,
    typeColor: type?.color ?? "#6b7280",
    validDate: signedIn.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: LOCATION.timezone }),
    signedInTime: signedIn.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: LOCATION.timezone }),
    qr,
  };
}
