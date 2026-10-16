import QRCode from "qrcode";
import { notFound } from "next/navigation";
import { publicBaseUrl } from "@/lib/baseUrl";
import { LOCATION, VISITOR_TYPES } from "@/lib/config";
import { read } from "@/lib/db";
import SignOutButton from "./SignOutButton";

export const dynamic = "force-dynamic";

// Digital badge on the visitor's phone (FR-BAD-04/05), with self sign-out.
export default async function BadgePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { id } = await params;
  const { t } = await searchParams;

  const data = read((d) => {
    const visit = d.visits.find((v) => v.id === id);
    // An "expected" visit has no badge yet — the visitor hasn't signed in.
    if (!visit || !t || visit.badgeToken !== t || visit.status === "expected") return null;
    return {
      visit,
      visitor: d.visitors.find((v) => v.id === visit.visitorId)!,
      host: d.hosts.find((h) => h.id === visit.hostId)!,
    };
  });
  if (!data) notFound();

  const { visit, visitor, host } = data;
  const type = VISITOR_TYPES.find((v) => v.id === visit.visitorType);
  const signedIn = new Date(visit.signedInAt ?? Date.now());
  const validDate = signedIn.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  // The badge QR lets reception (or a future kiosk scanner) look up this visit (FR-KIO-10).
  const badgeQr = await QRCode.toDataURL(`${publicBaseUrl()}/badge/${visit.id}?t=${visit.badgeToken}`, { margin: 1, width: 300 });

  return (
    <main className="phone">
      <div className="card badge stack" style={{ ["--badge" as string]: type?.color }}>
        <p className="muted small">{LOCATION.company} · {LOCATION.name}</p>
        {visitor.photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="photo" src={visitor.photo} alt="" />
        )}
        <div>
          <h1>{visitor.name}</h1>
          {visitor.company && <p className="muted" style={{ margin: 0 }}>{visitor.company}</p>}
        </div>
        {type && <span className="type" style={{ background: type.color }}>{type.label}</span>}
        <p style={{ margin: 0 }}>Visiting <strong>{host.name}</strong></p>

        {visit.status === "signed_in" ? (
          <>
            <p className="notice" role="status">You're signed in. {host.name.split(" ")[0]} has been told you've arrived.</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={badgeQr} alt="Badge QR code" width={180} height={180} style={{ margin: "0 auto", display: "block" }} />
            <p className="small muted">Valid {validDate} only · signed in {signedIn.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</p>
            <SignOutButton visitId={visit.id} token={visit.badgeToken} />
            <p className="small muted">Keep this page open, or bookmark it, to sign out when you leave.</p>
          </>
        ) : (
          <p className="notice">You signed out. Thanks for visiting!</p>
        )}
      </div>
    </main>
  );
}
