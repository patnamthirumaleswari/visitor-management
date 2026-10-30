import { AGREEMENT, LOCATION } from "@/lib/config";
import { getBranding } from "@/lib/services/branding";
import { toView } from "@/lib/safety";
import { getBriefing } from "@/lib/services/safety";
import { getSignInSession } from "@/lib/session";
import { getActiveVisitorTypes } from "@/lib/services/visitorTypes";
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

  const [briefing, brand, visitorTypes] = await Promise.all([getBriefing(), getBranding(), getActiveVisitorTypes()]);
  return <SignInFlow location={LOCATION} brand={brand} briefing={briefing.enabled ? toView(briefing) : null} visitorTypes={visitorTypes} agreement={AGREEMENT} />;
}
