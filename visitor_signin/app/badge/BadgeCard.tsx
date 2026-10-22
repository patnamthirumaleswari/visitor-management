// The visitor badge (FR-BAD-02): company logo, photo, name, company, host, date,
// a band in the visitor type's colour, and the QR code. Shown on the visitor's phone and
// printed at reception (sized for a 62 mm label, see .badge-card in globals.css).

import Logo from "../Logo";
import type { BadgeData } from "@/lib/badge";
import { readableTextOn } from "@/lib/branding";

export default function BadgeCard({ badge }: { badge: BadgeData }) {
  const { branding } = badge;
  const initials = badge.visitorName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <article className="badge-card" aria-label={`Visitor badge for ${badge.visitorName}`}>
      <header className="badge-top" style={{ background: branding.primaryColor, color: branding.primaryText }}>
        <Logo logo={branding.logo} companyName={branding.companyName} color={branding.primaryText} textColor={branding.primaryColor} size={28} />
        <span>{branding.companyName}</span>
      </header>

      <div className="badge-body">
        {badge.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="badge-photo" src={badge.photo} alt="" />
        ) : (
          <span className="badge-photo badge-photo-empty" aria-hidden>{initials}</span>
        )}
        <h1 className="badge-name">{badge.visitorName}</h1>
        {badge.company && <p className="badge-company">{badge.company}</p>}
        <p className="badge-host">Visiting <strong>{badge.hostName}</strong></p>
      </div>

      <div className="badge-type" style={{ background: badge.typeColor, color: readableTextOn(badge.typeColor) }}>
        {badge.typeLabel}
      </div>

      <footer className="badge-bottom">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="badge-qr" src={badge.qr} alt="Badge QR code" />
        <div>
          <strong>Valid {badge.validDate} only</strong>
          <span>Signed in {badge.signedInTime}</span>
          <span>Scan at reception to sign out</span>
        </div>
      </footer>
    </article>
  );
}
