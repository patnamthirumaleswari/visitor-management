import { notFound } from "next/navigation";
import { isOnSite } from "@/lib/approvals";
import { ACCESS, requireStaffPage } from "@/lib/auth";
import { loadBadge } from "@/lib/badge";
import BadgeCard from "../../../badge/BadgeCard";
import PrintControls from "./PrintControls";

export const dynamic = "force-dynamic";

// Printable visitor badge for reception (FR-BAD-02, ready for the label printer in FR-BAD-01).
// Sized for a 62 mm wide label, e.g. Brother QL DK-22205 continuous roll. Admin and reception only.
export default async function PrintBadgePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireStaffPage(ACCESS.admin, `/admin/badge/${id}`);

  const badge = await loadBadge(id, null);
  if (!badge) notFound();

  return (
    <main className="print-badge">
      {/* Only on this page: one badge per 62 mm x 100 mm page, no margins. */}
      <style>{`@page { size: 62mm 100mm; margin: 0; }`}</style>
      <PrintControls signedOut={!isOnSite(badge.visit)} />
      <BadgeCard badge={badge} />
    </main>
  );
}
