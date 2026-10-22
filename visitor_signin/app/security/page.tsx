import StaffShell from "../StaffShell";
import { ACCESS, requireStaffPage } from "@/lib/auth";
import EvacuationList from "./EvacuationList";

export const dynamic = "force-dynamic";

// Security officer's view: everyone on site right now, read-only and printable (FR-EVA-01).
export default async function SecurityPage() {
  const staff = await requireStaffPage(ACCESS.security, "/security");
  return (
    <StaffShell staff={staff}>
      <EvacuationList />
    </StaffShell>
  );
}
