import { notFound } from "next/navigation";
import AutoRefresh from "../../../AutoRefresh";
import GatePass from "../../../badge/GatePass";
import Icon from "../../../Icon";
import StaffShell from "../../../StaffShell";
import { isOpen } from "@/lib/approvals";
import { requireStaffPage } from "@/lib/auth";
import { loadPass } from "@/lib/gatepass";

export const dynamic = "force-dynamic";

// A visit's gate pass for staff (Visitor Connect): who, whom they visited, and the full record.
// Admins, reception and security see any visit; hosts only their own visitors.
export default async function StaffPassPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireStaffPage(["admin", "receptionist", "security", "host"], `/admin/visits/${id}`);
  const pass = loadPass(id, null);
  if (!pass || (staff.role === "host" && pass.visit.hostId !== staff.hostId)) notFound();

  return (
    <StaffShell staff={staff}>
      <main className="admin" style={{ maxWidth: 640 }}>
        {isOpen(pass.visit) && <AutoRefresh seconds={6} />}
        <div className="ph-h">
          <div><h2>Gate pass</h2><p>Visitor no. {pass.visit.no ?? "—"} · {pass.visitor.name}</p></div>
          <a className="btn line sm" href={staff.role === "security" ? "/gate" : staff.role === "host" ? "/requests" : "/admin"}><Icon name="back" />Back</a>
        </div>
        <GatePass pass={pass} />
      </main>
    </StaffShell>
  );
}
