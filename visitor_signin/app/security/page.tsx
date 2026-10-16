import StaffBar from "../StaffBar";
import { ACCESS, requireStaffPage, ROLE_LABELS } from "@/lib/auth";
import EvacuationList from "./EvacuationList";

export const dynamic = "force-dynamic";

// Security officer's view: everyone on site right now, read-only and printable (FR-EVA-01).
export default async function SecurityPage() {
  const staff = await requireStaffPage(ACCESS.security, "/security");
  return (
    <>
      <StaffBar name={staff.name} role={staff.role} roleLabel={ROLE_LABELS[staff.role]} isHost={!!staff.hostId} />
      <EvacuationList />
    </>
  );
}
