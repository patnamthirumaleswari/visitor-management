import { notFound } from "next/navigation";
import AutoRefresh from "../../../AutoRefresh";
import Icon from "../../../Icon";
import { isOpen } from "@/lib/approvals";
import { loadPass } from "@/lib/gatepass";
import GatePass from "../../GatePass";

export const dynamic = "force-dynamic";

// The visitor's live digital gate pass on their phone (Visitor Connect). The badge token proves it's theirs.
export default async function VisitorPassPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { id } = await params;
  const { t } = await searchParams;
  const pass = t ? await loadPass(id, t) : null;
  if (!pass) notFound();

  return (
    <main className="phone stack">
      {isOpen(pass.visit) && <AutoRefresh seconds={6} />}
      <a className="btn ghost sm" href={`/badge/${id}?t=${t}`} style={{ justifySelf: "start" }}><Icon name="back" />Back to my visit</a>
      <GatePass pass={pass} />
      <p className="small muted" style={{ textAlign: "center" }}>Your pass fills in by itself as the visit goes on.</p>
    </main>
  );
}
