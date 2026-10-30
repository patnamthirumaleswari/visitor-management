import { notFound } from "next/navigation";
import Icon from "../../../Icon";
import SafetyBriefingView from "../../../SafetyBriefingView";
import { countVisits } from "@/lib/repos/visits";
import { getBriefing } from "@/lib/services/safety";

export const dynamic = "force-dynamic";

// "Safety & emergency" on the visitor's phone during the visit (Visitor Connect): who to call,
// where to gather, the rules and the exit plan. The badge token proves it's their visit.
export default async function VisitorSafetyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { id } = await params;
  const { t } = await searchParams;
  const ok = !!t && (await countVisits({ id, badgeToken: t })) > 0;
  if (!ok) notFound();

  return (
    <main className="phone stack">
      <a className="btn ghost sm" href={`/badge/${id}?t=${t}`} style={{ justifySelf: "start" }}><Icon name="back" />Back to my visit</a>
      <div className="card">
        <h1 style={{ marginBottom: 0 }}>Safety &amp; emergency</h1>
        <SafetyBriefingView briefing={await getBriefing()} />
      </div>
    </main>
  );
}
