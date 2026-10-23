import StaffShell from "../StaffShell";
import { ACCESS, requireStaffPage } from "@/lib/auth";
import { LOCATION } from "@/lib/config";
import RequestsBoard from "./RequestsBoard";

export const dynamic = "force-dynamic";

// Host home: approve or deny visitors waiting at reception (Visitor Connect). Admins and reception
// can open it too (they see everyone's requests); their home is /admin, which has the same list.
export default async function RequestsPage() {
  const staff = await requireStaffPage(ACCESS.decide, "/requests");
  return (
    <StaffShell staff={staff}>
      <RequestsBoard firstName={staff.name.split(" ")[0]} locationName={LOCATION.name} />
    </StaffShell>
  );
}
