import StaffShell from "../../StaffShell";
import { ACCESS, requireStaffPage } from "@/lib/auth";
import { listPeople } from "@/lib/services/people";
import PeopleManager from "./PeopleManager";

export const dynamic = "force-dynamic";

// People (FR-ADM-04): hosts, reception, security and admins. Admins only.
export default async function PeoplePage() {
  const staff = await requireStaffPage(ACCESS.people, "/admin/people");
  return (
    <StaffShell staff={staff}>
      <PeopleManager initial={await listPeople()} meId={staff.id} />
    </StaffShell>
  );
}
