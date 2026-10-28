import BrandLine from "../BrandLine";
import { getBranding } from "@/lib/branding";
import { LOCATION } from "@/lib/config";
import { getSettings } from "@/lib/services/settings";

export const dynamic = "force-dynamic";

// Privacy notice for visitors, linked from the consent tick during sign-in. Plain language; the
// company should have its legal team check the wording before going live.
export default async function PrivacyPage() {
  const { companyName } = getBranding();
  const { retentionDays } = await getSettings();
  const keep = retentionDays ? `${retentionDays} days after your visit ends` : "until an administrator deletes them";

  return (
    <main className="phone">
      <BrandLine />
      <article className="card stack">
        <h1>Visitor privacy notice</h1>
        <p className="muted" style={{ margin: 0 }}>{companyName} · {LOCATION.name}</p>

        <h2>What we record</h2>
        <p>Your name, mobile number, and, if you give them, your email and company. Who you are visiting and why, the
          answers to any questions for your type of visit, your photo and signature, the times you arrived and left,
          and which safety briefing you accepted.</p>

        <h2>Why</h2>
        <p>To let your host know you have arrived and approve your entry, to print or show your visitor pass, to know
          who is in the building if it has to be evacuated, and for site security.</p>

        <h2>Who sees it</h2>
        <p>Your host, reception, security and site administrators. We don&apos;t sell your details or use them for
          marketing.</p>

        <h2>How long we keep it</h2>
        <p>Your visit records, photo and signature are deleted {keep}. A short log of staff actions (for example
          &ldquo;entry approved&rdquo;) may be kept longer for security.</p>

        <h2>Your choices</h2>
        <p>You can ask reception to see, correct or delete your details. If you don&apos;t agree to your details being
          recorded, please speak to reception: you won&apos;t be able to check in with this app.</p>
      </article>
    </main>
  );
}
