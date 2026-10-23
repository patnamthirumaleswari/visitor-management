"use client";

// Rows of visitors (Visitor Connect "vrow"), with Approve / Deny on the ones waiting for an answer.

import ClearHoldButton from "./ClearHoldButton";
import DecisionButtons from "./DecisionButtons";
import ReapproveButton from "./ReapproveButton";
import Icon from "./Icon";
import type { RequestRow } from "@/lib/requests";

const STATUS: Record<RequestRow["status"], { label: string; tone: string }> = {
  expected: { label: "Expected", tone: "t-info" },
  pending: { label: "Waiting for approval", tone: "t-wait" },
  signed_in: { label: "On site", tone: "t-ok" },
  denied: { label: "Not approved", tone: "t-bad" },
  checkout: { label: "Checkout requested", tone: "t-wait" },
  gate: { label: "Cleared for exit", tone: "t-info" },
  hold: { label: "Held at gate", tone: "t-bad" },
  signed_out: { label: "Left", tone: "t-done" },
};

export function StatusPill({ status }: { status: RequestRow["status"] }) {
  const s = STATUS[status];
  return <span className={`pill ${s.tone}`}>{s.label}</span>;
}

export default function RequestList({ rows, onDecided, showHost }: { rows: RequestRow[]; onDecided: () => void; showHost?: boolean }) {
  const time = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "");
  return (
    <>
      {rows.map((r) => {
        const initials = r.name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
        return (
          <div key={r.id} className={`vrow${(r.escalated && (r.status === "pending" || r.status === "checkout")) || r.status === "hold" ? " alert" : ""}`}>
            <span className="avatar" style={{ width: 46, height: 46, fontSize: 16 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {r.photo ? <img src={r.photo} alt="" /> : initials}
            </span>
            <div className="main">
              <div className="t"><a className="namelink" href={`/visits/${r.id}`}><b>{r.name}</b></a><StatusPill status={r.status} /></div>
              <div className="meta">
                {r.company ? `${r.company} · ` : ""}
                <span style={{ color: r.typeColor, fontWeight: 600 }}>{r.typeLabel}</span>
                {showHost ? ` · for ${r.host}` : ""}
                {r.purpose ? ` · ${r.purpose}` : ""}
              </div>
              <div className="chips">
                {r.no && <span className="tag mono">No. {r.no}</span>}
                {r.code && r.status === "pending" && <span className="tag mono">Code {r.code}</span>}
                {r.status === "pending" || r.status === "checkout" ? (
                  <span className="wait"><Icon name="clock" /> {r.status === "checkout" ? "wants to leave" : "waiting"} {r.waitingMinutes} min</span>
                ) : (
                  <span><Icon name="clock" /> in {time(r.checkedInAt)}{r.decidedBy ? ` · ${r.status === "denied" ? "not approved" : "approved"} by ${r.decidedBy}` : ""}</span>
                )}
                {r.escalated && (r.status === "pending" || r.status === "checkout") && <span className="pill t-bad">Escalated</span>}
                {r.status === "hold" && r.holdReason && <span style={{ color: "var(--bad)", fontWeight: 600 }}>{r.holdReason}</span>}
              </div>
              {r.answers.map((a) => (
                <div key={a.questionId} className="small answer"><span className="muted">{a.label}</span> {a.value}</div>
              ))}
              {r.status === "denied" && r.decisionNote && <div className="small answer"><span className="muted">Note:</span> {r.decisionNote}</div>}
              {r.status === "signed_in" && r.checkoutNote && <div className="small answer"><span className="muted">Checkout not yet:</span> {r.checkoutNote}</div>}
              {r.status === "pending" && <DecisionButtons endpoint={`/api/staff/visits/${r.id}/decide`} onDone={onDecided} />}
              {r.status === "checkout" && (
                <DecisionButtons endpoint={`/api/staff/visits/${r.id}/decide`} onDone={onDecided}
                  labels={{ approve: "Approve checkout", deny: "Not yet", confirmDeny: "Keep them on site", notePlaceholder: "Note for the visitor (optional), e.g. Please wait for the meeting to end" }} />
              )}
              {r.status === "hold" && <ClearHoldButton visitId={r.id} onDone={onDecided} />}
              {r.status === "denied" && r.reapprovable && <ReapproveButton visitId={r.id} onDone={onDecided} />}
              <a className="btn ghost sm" href={`/visits/${r.id}`} style={{ marginTop: 6, paddingLeft: 0 }}><Icon name="file" />View details</a>
            </div>
          </div>
        );
      })}
    </>
  );
}
