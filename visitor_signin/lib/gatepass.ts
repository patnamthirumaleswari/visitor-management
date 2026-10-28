import type { ResolvedBranding } from "./branding";
import { getBranding } from "./services/branding";
import { LOCATION } from "./config";
import type { Visit } from "./types";
import { findVisitWithPeople } from "./repos/visits";
import { typeDisplay } from "./visitorTypes";
import { listVisitorTypes } from "./services/visitorTypes";

// The digital gate pass (Visitor Connect): everything about one visit, filled in as it goes on.

export type PassData = {
  visit: Visit;
  branding: ResolvedBranding;
  locationName: string;
  visitor: { name: string; phone: string; email: string; company: string; photo: string | null };
  hostName: string;
  hostDepartment: string;
  typeLabel: string;
};

/** Loads a pass. The visitor passes their badge token; staff pages pass null after their own login check. */
export async function loadPass(visitId: string, token: string | null): Promise<PassData | null> {
  const [types, branding, found] = await Promise.all([listVisitorTypes(), getBranding(), findVisitWithPeople(visitId)]);
  if (!found) return null;
  const { visit, visitor, host } = found;
  if (visit.status === "expected") return null;
  if (token !== null && visit.badgeToken !== token) return null;
  return {
      visit,
      branding,
      locationName: `${LOCATION.company} · ${LOCATION.name}`,
      visitor: {
        name: visitor?.name ?? "",
        phone: visitor?.phone ?? "",
        email: visitor?.email ?? "",
        company: visitor?.company ?? "",
        photo: visitor?.photo ?? null,
      },
      hostName: host?.name ?? "",
      hostDepartment: host?.department ?? "",
      typeLabel: typeDisplay(types, visit.visitorType).label,
  };
}

/** The four steps on the pass, from the visit's timeline: when, and who did it. */
export function passSteps(visit: Visit) {
  const find = (prefix: string) => [...(visit.timeline ?? [])].reverse().find((t) => t.event.startsWith(prefix));
  const denied = find("Entry not approved");
  const approved = find("Entry approved") ?? find("Entry started");
  const checkout = find("Checkout approved") ?? find("Cleared for exit");
  const released = find("Released at the gate") ?? find("Signed out by staff");
  return [
    { label: "Registered (self check-in)", at: visit.checkedInAt, by: "Visitor", done: true },
    denied
      ? { label: "Entry not approved", at: denied.at, by: denied.by, done: true }
      : { label: "Entry approved · time in", at: approved?.at ?? visit.signedInAt, by: approved?.by ?? "", done: !!(approved || visit.signedInAt) },
    { label: "Checkout approved", at: checkout?.at, by: checkout?.by ?? "", done: !!checkout },
    { label: released?.event.startsWith("Signed out") ? "Signed out by staff · time out" : "Released at gate · time out", at: released?.at ?? (visit.status === "signed_out" ? visit.signedOutAt : undefined), by: released?.by ?? "", done: visit.status === "signed_out" },
  ];
}
