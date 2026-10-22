import StaffShell from "../StaffShell";
import { ACCESS, requireStaffPage } from "@/lib/auth";
import { LOCATION } from "@/lib/config";
import AdminDashboard from "./AdminDashboard";

export const dynamic = "force-dynamic";

// Reception portal: who is on site, who is expected, manual sign-out (FR-ADM-01/02).
// Admin and reception only (NFR-SEC-03).
export default async function AdminPage() {
  const staff = await requireStaffPage(ACCESS.admin, "/admin");
  return (
    <StaffShell staff={staff}>
      <AdminDashboard firstName={staff.name.split(" ")[0]} locationName={LOCATION.name} />
    </StaffShell>
  );
}
