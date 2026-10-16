import StaffBar from "../StaffBar";
import { ACCESS, requireStaffPage, ROLE_LABELS } from "@/lib/auth";
import AdminDashboard from "./AdminDashboard";

export const dynamic = "force-dynamic";

// Reception portal: who is on site, who is expected, manual sign-out (FR-ADM-01/02).
// Admin and reception only (NFR-SEC-03).
export default async function AdminPage() {
  const staff = await requireStaffPage(ACCESS.admin, "/admin");
  return (
    <>
      <StaffBar name={staff.name} role={staff.role} roleLabel={ROLE_LABELS[staff.role]} isHost={!!staff.hostId} />
      <AdminDashboard />
    </>
  );
}
