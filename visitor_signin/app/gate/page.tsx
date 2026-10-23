import StaffShell from "../StaffShell";
import { ACCESS, requireStaffPage } from "@/lib/auth";
import GateBoard from "./GateBoard";

export const dynamic = "force-dynamic";

// Main gate (Visitor Connect): security releases or holds visitors who are leaving. Security's home page.
export default async function GatePage() {
  const staff = await requireStaffPage(ACCESS.gate, "/gate");
  return (
    <StaffShell staff={staff}>
      {/* Reception and admins can also clear a hold here; security can't clear the holds they set. */}
      <GateBoard canClear={staff.role !== "security"} />
    </StaffShell>
  );
}
