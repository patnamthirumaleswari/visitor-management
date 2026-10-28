import StaffShell from "../../StaffShell";
import { getAudit } from "@/lib/services/audit";
import { ACCESS, requireStaffPage } from "@/lib/auth";
import AuditTable from "./AuditTable";

export const dynamic = "force-dynamic";

// Audit log (FR-ROLE-02): who did what and when, newest first. Admins only.
export default async function AuditPage() {
  const staff = await requireStaffPage(ACCESS.reports, "/admin/audit");
  return (
    <StaffShell staff={staff}>
      <AuditTable entries={await getAudit()} />
    </StaffShell>
  );
}
