import StaffShell from "../StaffShell";
import { ACCESS, requireStaffPage } from "@/lib/auth";
import { todayAtLocation } from "@/lib/dates";
import { listHosts } from "@/lib/repos/hosts";
import { isActiveHost } from "@/lib/services/people";
import { getActiveVisitorTypes } from "@/lib/services/visitorTypes";
import PreRegisterForm from "./PreRegisterForm";

export const dynamic = "force-dynamic";

// Host pre-registers a visitor (FR-PRE-01/02). Logged-in hosts, reception and admins only (NFR-SEC-03).
// A host account only sees itself in the host list; reception and admins can invite for anyone.
export default async function PreRegisterPage() {
  const staff = await requireStaffPage(ACCESS.preRegister, "/pre-register");
  const hosts = (await listHosts())
      .filter((h) => isActiveHost(h) && (staff.role !== "host" || h.id === staff.hostId))
      .map(({ id, name, department }) => ({ id, name, department }));
  return (
    <StaffShell staff={staff}>
      <PreRegisterForm hosts={hosts} visitorTypes={await getActiveVisitorTypes()} today={todayAtLocation()} />
    </StaffShell>
  );
}
