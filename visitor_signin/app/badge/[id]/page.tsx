import { notFound } from "next/navigation";
import AutoRefresh from "../../AutoRefresh";
import Icon from "../../Icon";
import { sweepAutoSignOut } from "@/lib/autoSignout";
import { loadBadge, type BadgeData } from "@/lib/badge";
import { LOCATION } from "@/lib/config";
import BadgeCard from "../BadgeCard";
import CheckoutButton from "./CheckoutButton";

export const dynamic = "force-dynamic";

// The visitor's own visit screen on their phone (Visitor Connect): waiting for approval, approved
// (with the digital badge, FR-BAD-02/04/05, and Check out), checkout requested, go to the gate,
// held at the gate, not approved, or finished. While something is pending it refreshes itself.
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
  const waiting = visit.status === "pending" || visit.status === "checkout" || visit.status === "gate" || visit.status === "hold";
  const passHref = `/badge/${visit.id}/pass?t=${visit.badgeToken}`;

  return (
    <main className="phone stack">
      {waiting && <AutoRefresh seconds={4} />}

      {visit.status === "pending" && (
        <>
          <Status cls="s-wait" icon="hourglass" title="Waiting for approval"
            text={`${badge.hostName} has been told you are here. Please wait at reception; this screen updates by itself.`} />
          <VisitCard badge={badge} />
          <p className="small muted" style={{ textAlign: "center" }}>
            Keep this page open. If you close it, use &quot;Find my visit&quot; with your visit code and mobile number.
          </p>
        </>
      )}

      {visit.status === "signed_in" && (
        <>
          <Status cls="s-ok pop" icon="shieldCheck" title="You are approved"
            text={`${visit.decidedBy ? `${hostFirstName} approved your visit. ` : `${hostFirstName} has been told you've arrived. `}When you finish, tap Check out below.`} />
          {visit.checkoutNote && (
            <p className="notice" style={{ margin: 0 }}><Icon name="info" />Checkout not confirmed yet: &ldquo;{visit.checkoutNote}&rdquo;</p>
          )}
          <BadgeCard badge={badge} />
          <CheckoutButton visitId={visit.id} token={visit.badgeToken} />
          <Links passHref={passHref} />
        </>
      )}

      {visit.status === "checkout" && (
        <>
          <Status cls="s-wait" icon="hourglass" title="Checkout requested" text={`Waiting for ${badge.hostName} to confirm your visit is finished.`} />
          <VisitCard badge={badge} />
          <Links passHref={passHref} />
        </>
      )}

      {visit.status === "gate" && (
        <>
          <Status cls="s-gate pop" icon="door" title="Go to the exit gate" text="Show this screen to security. They check your photo and let you out." />
          <VisitCard badge={badge} big />
          <Links passHref={passHref} />
        </>
      )}

      {visit.status === "hold" && (
        <>
          <Status cls="s-bad" icon="shieldAlert" title="Please wait at the gate" text="Security will help you shortly." />
          <VisitCard badge={badge} big />
        </>
      )}

      {visit.status === "denied" && (
        <>
          <Status cls="s-bad" icon="x" title="Entry not approved"
            text={visit.decisionNote ? `Note from ${badge.branding.companyName}: ${visit.decisionNote}` : "Please speak to reception."} />
          <VisitCard badge={badge} />
        </>
      )}

      {visit.status === "signed_out" && (
        <>
          <Status cls="s-done" icon="check" title="Visit complete"
            text={visit.signedOutBy === "auto"
              ? "You were signed out automatically at the end of the day. Thanks for visiting!"
              : `You left at ${time(visit.signedOutAt)}. Thank you for visiting ${badge.branding.companyName}.`} />
          <Links passHref={passHref} />
        </>
      )}
    </main>
  );
}

const time = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: LOCATION.timezone }) : "");

function Status({ cls, icon, title, text }: { cls: string; icon: "hourglass" | "shieldCheck" | "door" | "shieldAlert" | "x" | "check"; title: string; text: string }) {
  return (
    <div className={`status ${cls}`} role="status">
      <Icon name={icon} className="big" />
      <h1>{title}</h1>
      <p style={{ margin: 0 }}>{text}</p>
    </div>
  );
}

/** Who, whom they're visiting, number and code, and how far the visit has got (Entry · Checkout · Gate). */
function VisitCard({ badge, big }: { badge: BadgeData; big?: boolean }) {
  const { visit } = badge;
  const initials = badge.visitorName.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
  const size = big ? 96 : 76;
  const phases = {
    pending: ["cur", "", ""], signed_in: ["on", "", ""], denied: ["alert", "", ""], checkout: ["on", "cur", ""],
    gate: ["on", "on", "cur"], hold: ["on", "on", "alert"], signed_out: ["on", "on", "on"], expected: ["", "", ""],
  }[visit.status];
  return (
    <div className={`vcard glass${visit.status === "gate" ? " go" : ""}`}>
      <div className="who">
        <span className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {badge.photo ? <img src={badge.photo} alt="" /> : initials}
        </span>
        <div style={{ minWidth: 0 }}>
          <b style={{ fontFamily: "var(--f-display)", fontSize: 19, display: "block" }}>{badge.visitorName}</b>
          {badge.company && <span className="muted">{badge.company}</span>}
          <div className="muted small">Visiting {badge.hostName}</div>
        </div>
      </div>
      {(visit.no || visit.code) && (
        <div className="nums">
          <div><small>Visitor no.</small><b style={{ color: "var(--primary)" }}>{visit.no ?? "—"}</b></div>
          <div><small>Visit code</small><b>{visit.code ?? "—"}</b></div>
        </div>
      )}
      <div className="ph">
        <div className="phases">{phases.map((c, i) => <i key={i} className={c} />)}</div>
        <div className="phases-l"><span>Entry</span><span>Checkout</span><span>Gate</span></div>
      </div>
    </div>
  );
}

function Links({ passHref }: { passHref: string }) {
  return (
    <a className="linkcard" href={passHref}>
      <span className="li" style={{ background: "var(--gold-soft)", color: "var(--gold-ink)" }}><Icon name="file" /></span>
      <span><b>Gate pass</b><small>Your live digital pass</small></span>
      <Icon name="chev" />
    </a>
  );
}
