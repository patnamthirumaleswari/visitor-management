import StaffShell from "../../StaffShell";
import { ACCESS, requireStaffPage } from "@/lib/auth";
import { getBriefing } from "@/lib/services/safety";
import SafetyForm from "./SafetyForm";

export const dynamic = "force-dynamic";

// Site safety briefing settings (Visitor Connect): emergency number, assembly point, notes, rules
// and exit plan, with a live preview of what visitors see. Admins only.
export default async function SafetyPage() {
  const staff = await requireStaffPage(ACCESS.safety, "/admin/safety");
  return (
    <StaffShell staff={staff}>
      <SafetyForm initial={await getBriefing()} />
    </StaffShell>
  );
}
