import { notFound } from "next/navigation";
import { sweepAutoSignOut } from "@/lib/autoSignout";
import { loadBadge } from "@/lib/badge";
import BadgeCard from "../BadgeCard";
import SignOutButton from "./SignOutButton";

export const dynamic = "force-dynamic";

// Digital badge on the visitor's phone (FR-BAD-02/04/05), with self sign-out.
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
      {visit.status === "signed_in" ? (
        <>
          <BadgeCard badge={badge} />
          <p className="notice" role="status">You&apos;re signed in. {hostFirstName} has been told you&apos;ve arrived.</p>
          <SignOutButton visitId={visit.id} token={visit.badgeToken} />
          <p className="small muted" style={{ textAlign: "center" }}>
            Keep this page open, or bookmark it, to sign out when you leave. You can also scan the code at reception.
          </p>
        </>
      ) : (
        <div className="card stack" style={{ textAlign: "center" }}>
          <h1>{badge.visitorName}</h1>
          <p className="notice" style={{ margin: 0 }}>
            {visit.signedOutBy === "auto"
              ? "You were signed out automatically at the end of the day. Thanks for visiting!"
              : "You signed out. Thanks for visiting!"}
          </p>
        </div>
      )}
    </main>
  );
}
