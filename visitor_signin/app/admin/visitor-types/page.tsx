import StaffShell from "../../StaffShell";
import { ACCESS, requireStaffPage } from "@/lib/auth";
import { typesWithUsage } from "@/lib/services/visitorTypes";
import VisitorTypesManager from "./VisitorTypesManager";

export const dynamic = "force-dynamic";

// Visitor types (FR-KIO-04), the fields and questions each one asks (FR-KIO-05),
// and photo on/off (FR-KIO-07). Admins only (NFR-SEC-03).
export default async function VisitorTypesPage() {
  const staff = await requireStaffPage(ACCESS.visitorTypes, "/admin/visitor-types");
  const { types, usage } = await typesWithUsage();

  return (
    <StaffShell staff={staff}>
      <VisitorTypesManager initialTypes={types} usage={usage} />
    </StaffShell>
  );
}
