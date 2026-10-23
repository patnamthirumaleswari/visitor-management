import { AGREEMENT, LOCATION } from "@/lib/config";
import { getBranding } from "@/lib/branding";
import { getSignInSession } from "@/lib/session";
import { getActiveVisitorTypes } from "@/lib/visitorTypes";
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
          <a className="button secondary" href="/find">Already checked in? Find my visit</a>
        </div>
      </main>
    );
  }

  return <SignInFlow location={LOCATION} brand={getBranding()} visitorTypes={getActiveVisitorTypes()} agreement={AGREEMENT} />;
}
