import { notFound } from "next/navigation";
import { Fragment } from "react";
import AutoRefresh from "../../AutoRefresh";
import GatePass from "../../badge/GatePass";
import Icon from "../../Icon";
import { StatusPill } from "../../RequestList";
import StaffShell from "../../StaffShell";
import { canClearHold, canDecide, canReapprove, isOpen, reapproveProblem } from "@/lib/approvals";
import { homeFor, requireStaffPage } from "@/lib/auth";
import { LOCATION } from "@/lib/config";
import { read } from "@/lib/db";
import { loadPass } from "@/lib/gatepass";
import VisitActions from "./VisitActions";

export const dynamic = "force-dynamic";

const fmt = (iso?: string) =>
  iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: LOCATION.timezone }) : "—";

// Visitor details for staff: who they are, what they answered, what can be done now, and everything
// that happened. Hosts see their own visitors; admins, reception and security see any visit.
export default async function VisitDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const staff = await requireStaffPage(["admin", "receptionist", "security", "host"], `/visits/${id}`);
  const pass = loadPass(id, null);
  if (!pass || (staff.role === "host" && pass.visit.hostId !== staff.hostId)) notFound();

  const { visit, visitor } = pass;
  const reapproveNote = visit.status === "denied" ? read((d) => reapproveProblem(d, d.visits.find((v) => v.id === id)!)) : null;
  const initials = visitor.name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");

  return (
    <StaffShell staff={staff}>
      <main className="admin">
        {isOpen(visit) && <AutoRefresh seconds={5} />}
        <div className="ph-h">
          <div>
            <h2 style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>{visitor.name} <StatusPill status={visit.status} /></h2>
            <p>Visitor no. {visit.no ?? "—"} · visiting {pass.hostName}</p>
          </div>
          <a className="btn line sm" href={homeFor(staff.role)}><Icon name="back" />Back</a>
        </div>

        <div className="cols two">
          <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
            <section className="panel">
              <div className="panel-h"><h3>Visitor details</h3></div>
              <div className="visit-details">
                <span className="avatar" style={{ width: 96, height: 96, fontSize: 32 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {visitor.photo ? <img src={visitor.photo} alt="" /> : initials}
                </span>
                <dl className="kv">
                  <dt>Name</dt><dd>{visitor.name}</dd>
                  {visitor.company && <><dt>Company</dt><dd>{visitor.company}</dd></>}
                  <dt>Mobile</dt><dd>{visitor.phone}</dd>
                  {visitor.email && <><dt>Email</dt><dd>{visitor.email}</dd></>}
                  <dt>Type</dt><dd>{pass.typeLabel}</dd>
                  {visit.purpose && <><dt>Purpose</dt><dd>{visit.purpose}</dd></>}
                  <dt>Host</dt><dd>{pass.hostName}{pass.hostDepartment ? `, ${pass.hostDepartment}` : ""}</dd>
                  <dt>Visit code</dt><dd className="mono">{visit.code ?? "—"}</dd>
                  <dt>Checked in</dt><dd>{fmt(visit.checkedInAt)}</dd>
                  {visit.signedOutAt && <><dt>Left</dt><dd>{fmt(visit.signedOutAt)}</dd></>}
                  {(visit.answers ?? []).map((a) => <Fragment key={a.questionId}><dt>{a.label}</dt><dd>{a.value}</dd></Fragment>)}
                  {visit.decisionNote && <><dt>Note</dt><dd>{visit.decisionNote}</dd></>}
                  {visit.hold && <><dt>Held</dt><dd style={{ color: "var(--bad)" }}>{visit.hold.reason}</dd></>}
                </dl>
              </div>
            </section>
            <section className="panel">
              <div className="panel-h"><h3>Actions</h3></div>
              <div style={{ padding: "14px 18px" }}>
                <VisitActions
                  visitId={visit.id}
                  status={visit.status}
                  canDecide={canDecide(staff, visit)}
                  reapprovable={canReapprove(staff, visit) && reapproveNote === null}
                  reapproveNote={canReapprove(staff, visit) ? reapproveNote : null}
                  canClearHold={canClearHold(staff, visit)}
                  canSignOut={staff.role === "admin" || staff.role === "receptionist"}
                />
              </div>
            </section>
          </div>

          <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
            <section className="panel">
              <div className="panel-h"><h3>History</h3><span className="count">{visit.timeline?.length ?? 0}</span></div>
              <ol className="history">
                {[...(visit.timeline ?? [])].reverse().map((t, i) => (
                  <li key={i}><b>{t.event}</b><small>{fmt(t.at)} · {t.by}</small></li>
                ))}
                {!visit.timeline?.length && <li className="muted">No history recorded for this visit.</li>}
              </ol>
            </section>
            <details className="panel pass-details">
              <summary>Gate pass</summary>
              <GatePass pass={pass} />
            </details>
          </div>
        </div>
      </main>
    </StaffShell>
  );
}
