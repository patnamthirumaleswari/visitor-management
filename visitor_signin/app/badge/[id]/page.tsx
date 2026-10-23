import { notFound } from "next/navigation";
import AutoRefresh from "../../AutoRefresh";
import Icon from "../../Icon";
import { sweepAutoSignOut } from "@/lib/autoSignout";
import { loadBadge, type BadgeData } from "@/lib/badge";
import BadgeCard from "../BadgeCard";
import SignOutButton from "./SignOutButton";

export const dynamic = "force-dynamic";

// The visitor's own visit screen on their phone (Visitor Connect): waiting for approval, approved
// (with the digital badge, FR-BAD-02/04/05, and self sign-out), not approved, or finished.
// While waiting it refreshes itself, so the visitor sees the host's answer without doing anything.
export default async function BadgePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { id } = await params;
  const { t } = await searchParams;
  sweepAutoSignOut(); // an old badge opened the next day shows "signed out", not "signed in"

  const badge = t ? await loadBadge(id, t) : null;
  if (!badge) notFound();

  const { visit } = badge;
  const hostFirstName = badge.hostName.split(" ")[0];

  return (
    <main className="phone stack">
      {visit.status === "pending" && (
        <>
          <AutoRefresh seconds={4} />
          <div className="status s-wait" role="status">
            <Icon name="hourglass" className="big" />
            <h1>Waiting for approval</h1>
            <p style={{ margin: 0 }}>{badge.hostName} has been told you are here. Please wait at reception; this screen updates by itself.</p>
          </div>
          <VisitCard badge={badge} />
          <p className="small muted" style={{ textAlign: "center" }}>
            Keep this page open. If you close it, use &quot;Find my visit&quot; with your visit code and mobile number.
          </p>
        </>
      )}

      {visit.status === "signed_in" && (
        <>
          <div className="status s-ok pop" role="status">
            <Icon name="shieldCheck" className="big" />
            <h1>You are approved</h1>
            <p style={{ margin: 0 }}>
              {visit.decidedBy ? `${hostFirstName} approved your visit. ` : `${hostFirstName} has been told you've arrived. `}
              Show this badge if asked, and sign out when you leave.
            </p>
          </div>
          <BadgeCard badge={badge} />
          <Numbers badge={badge} />
          <SignOutButton visitId={visit.id} token={visit.badgeToken} />
          <p className="small muted" style={{ textAlign: "center" }}>
            Keep this page open, or bookmark it, to sign out when you leave. You can also scan the code at reception.
          </p>
        </>
      )}

      {visit.status === "denied" && (
        <>
          <div className="status s-bad" role="status">
            <Icon name="x" className="big" />
            <h1>Entry not approved</h1>
            <p style={{ margin: 0 }}>
              {visit.decisionNote ? `Note from ${badge.branding.companyName}: ${visit.decisionNote}` : "Please speak to reception."}
            </p>
          </div>
          <VisitCard badge={badge} />
        </>
      )}

      {visit.status === "signed_out" && (
        <div className="status s-done" role="status">
          <Icon name="check" className="big" />
          <h1>Visit complete</h1>
          <p style={{ margin: 0 }}>
            {visit.signedOutBy === "auto"
              ? "You were signed out automatically at the end of the day. Thanks for visiting!"
              : "You signed out. Thanks for visiting!"}
          </p>
        </div>
      )}
    </main>
  );
}

/** Who, whom they're visiting, and their visitor number and visit code. */
function VisitCard({ badge }: { badge: BadgeData }) {
  const initials = badge.visitorName.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
  return (
    <div className="vcard glass">
      <div className="who">
        <span className="avatar" style={{ width: 76, height: 76, fontSize: 26 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {badge.photo ? <img src={badge.photo} alt="" /> : initials}
        </span>
        <div style={{ minWidth: 0 }}>
          <b style={{ fontFamily: "var(--f-display)", fontSize: 19, display: "block" }}>{badge.visitorName}</b>
          {badge.company && <span className="muted">{badge.company}</span>}
          <div className="muted small">Visiting {badge.hostName}</div>
        </div>
      </div>
      <Numbers badge={badge} bare />
    </div>
  );
}

function Numbers({ badge, bare }: { badge: BadgeData; bare?: boolean }) {
  if (!badge.visit.no && !badge.visit.code) return null;
  const nums = (
    <div className="nums">
      <div><small>Visitor no.</small><b style={{ color: "var(--primary)" }}>{badge.visit.no ?? "—"}</b></div>
      <div><small>Visit code</small><b>{badge.visit.code ?? "—"}</b></div>
    </div>
  );
  return bare ? nums : <div className="vcard glass">{nums}</div>;
}
