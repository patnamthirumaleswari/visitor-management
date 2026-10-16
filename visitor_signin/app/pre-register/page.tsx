import StaffBar from "../StaffBar";
import { ACCESS, requireStaffPage, ROLE_LABELS } from "@/lib/auth";
import { VISITOR_TYPES } from "@/lib/config";
import { todayAtLocation } from "@/lib/dates";
import { read } from "@/lib/db";
import PreRegisterForm from "./PreRegisterForm";

export const dynamic = "force-dynamic";

// Host pre-registers a visitor (FR-PRE-01/02). Logged-in hosts, reception and admins only (NFR-SEC-03).
// A host account only sees itself in the host list; reception and admins can invite for anyone.
export default async function PreRegisterPage() {
  const staff = await requireStaffPage(ACCESS.preRegister, "/pre-register");
  const hosts = read((d) =>
    d.hosts
      .filter((h) => staff.role !== "host" || h.id === staff.hostId)
      .map(({ id, name, department }) => ({ id, name, department })),
  );
  return (
    <>
      <StaffBar name={staff.name} role={staff.role} roleLabel={ROLE_LABELS[staff.role]} isHost={!!staff.hostId} />
      <PreRegisterForm hosts={hosts} visitorTypes={VISITOR_TYPES} today={todayAtLocation()} />
    </>
  );
}
