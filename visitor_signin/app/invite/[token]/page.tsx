import { notFound } from "next/navigation";
import { LOCATION } from "@/lib/config";
import { formatDay, todayAtLocation } from "@/lib/dates";
import { read } from "@/lib/db";
import SaveInvite from "./SaveInvite";

export const dynamic = "force-dynamic";

// What the invitation link/QR opens on the visitor's phone. It remembers the invite on the
// phone, so after scanning the reception QR on arrival the visitor skips the form.
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const data = read((d) => {
    const invitation = d.invitations.find((i) => i.qrToken === token);
    const visit = invitation && d.visits.find((v) => v.id === invitation.visitId);
    if (!invitation || !visit) return null;
    return {
      invitation,
      visit,
      visitor: d.visitors.find((p) => p.id === visit.visitorId),
      host: d.hosts.find((h) => h.id === visit.hostId),
    };
  });
  if (!data) notFound();

  const { invitation, visit, visitor, host } = data;
  const firstName = visitor?.name.split(" ")[0] ?? "there";
  const today = todayAtLocation();
  const used = !!invitation.usedAt || visit.status !== "expected";
  const expired = today > invitation.validTo;

  return (
    <main className="phone">
      <div className="card stack">
        <p className="muted small">{LOCATION.company} · {LOCATION.name}</p>
        {used ? (
          <>
            <h1>You're all set</h1>
            <p>This invitation has already been used to sign in.</p>
          </>
        ) : expired ? (
          <>
            <h1>This invitation has expired</h1>
            <p>It was for {formatDay(invitation.validTo)}. Please ask {host?.name ?? "your host"} for a new one.</p>
          </>
        ) : (
          <>
            <h1>Hi {firstName}, you're invited!</h1>
            <p>
              <strong>{host?.name}</strong> is expecting you at {LOCATION.name} on{" "}
              <strong>{invitation.validFrom === today ? "today" : formatDay(invitation.validFrom)}</strong>.
            </p>
            <div className="notice">
              <strong>When you arrive:</strong> scan the QR code on the reception screen with this phone. Your details
              are already filled in — you'll only need a quick photo and signature.
            </div>
            <SaveInvite token={token} />
          </>
        )}
      </div>
    </main>
  );
}
