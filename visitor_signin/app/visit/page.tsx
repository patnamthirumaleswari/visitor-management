import { AGREEMENT, LOCATION, VISITOR_TYPES } from "@/lib/config";
import { getSignInSession } from "@/lib/session";
import ExistingBadgeLink from "./ExistingBadgeLink";
import SignInFlow from "./SignInFlow";

export const dynamic = "force-dynamic";

export default async function VisitPage({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  const { expired } = await searchParams;
  const session = await getSignInSession();

  if (!session) {
    return (
      <main className="phone">
        <div className="card stack">
          <h1>{expired ? "That code has expired" : "Scan the code at reception"}</h1>
          <p className="muted">
            For security, the sign-in QR code at {LOCATION.name} changes every few seconds and only works on site.
            Please scan the code on the reception screen again.
          </p>
          <ExistingBadgeLink />
        </div>
      </main>
    );
  }

  return <SignInFlow location={LOCATION} visitorTypes={VISITOR_TYPES} agreement={AGREEMENT} />;
}
