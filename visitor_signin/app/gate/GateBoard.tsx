"use client";

// Main gate (Visitor Connect): visitors cleared to leave, with a big photo so security can check the
// face. Release lets them out; Hold keeps them with a reason, and the host or an admin clears it.

import { useCallback, useEffect, useState } from "react";
import ClearHoldButton from "../ClearHoldButton";
import Icon from "../Icon";
import { StatusPill } from "../RequestList";
import type { RequestRow } from "@/lib/requests";

type GateRow = RequestRow & { hold: { reason: string; by: string; at: string } | null; clearedBy: string | null; clearedAt: string | null };

export default function GateBoard({ canClear }: { canClear: boolean }) {
  const [queue, setQueue] = useState<GateRow[]>([]);
  const [inside, setInside] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/staff/gate", { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = "/login?next=/gate";
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      setQueue(data.queue);
      setInside(data.inside);
      setLoaded(true);
    } catch {
      /* keep the last list */
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  const term = q.trim().toLowerCase();
  const shown = term ? queue.filter((r) => `${r.name} ${r.code} ${r.no}`.toLowerCase().includes(term)) : queue;
  const time = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "");

  return (
    <main className="admin">
      <div className="ph-h">
        <div>
          <h2>Main gate</h2>
          <p>Check the face against the photo, then release.</p>
        </div>
        <span className="pill t-info">{inside} more still inside</span>
      </div>
      <div className="toolbar">
        <div className="grow" style={{ position: "relative" }}>
          <input aria-label="Search" placeholder="Search by name, visit code or number" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 38 }} />
          <span style={{ position: "absolute", left: 12, top: 12, color: "var(--faint)" }}><Icon name="search" /></span>
        </div>
      </div>

      {shown.length > 0 ? (
        <div className="gatecards">
          {shown.map((r) => <GateCard key={r.id} row={r} canClear={canClear} onDone={load} time={time} />)}
        </div>
      ) : (
        loaded && (
          <section className="panel">
            <div className="empty"><Icon name="door" /><b>No one waiting at the gate</b>When a host approves a checkout, the visitor appears here with their photo.</div>
          </section>
        )
      )}
    </main>
  );
}

function GateCard({ row, canClear, onDone, time }: { row: GateRow; canClear: boolean; onDone: () => void; time: (iso: string | null) => string }) {
  const [holding, setHolding] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initials = row.name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");

  async function act(action: "release" | "hold") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/staff/visits/${row.id}/gate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't save that. Please try again.");
      setHolding(false);
      setReason("");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={`gcard${row.status === "hold" ? " held" : ""}`}>
      <div className="top">
        <span className="avatar" style={{ width: 96, height: 96, fontSize: 32 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {row.photo ? <img src={row.photo} alt="" /> : initials}
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 6, flexWrap: "wrap" }}>
            <b style={{ fontFamily: "var(--f-display)", fontSize: 17 }}>{row.name}</b>
            <StatusPill status={row.status} />
          </div>
          {row.company && <div className="muted small">{row.company}</div>}
          <dl>
            <dt>No.</dt><dd className="mono">{row.no}</dd>
            <dt>Code</dt><dd className="mono">{row.code}</dd>
            <dt>Host</dt><dd>{row.host}</dd>
            {row.status === "hold" ? (
              <><dt>Held</dt><dd style={{ color: "var(--bad)" }}>{row.hold?.reason}</dd></>
            ) : (
              <><dt>Cleared</dt><dd>{row.clearedBy ? `${row.clearedBy}, ${time(row.clearedAt)}` : "yes"}</dd></>
            )}
          </dl>
        </div>
      </div>
      <div className="acts">
        {row.status === "gate" && !holding && (
          <div className="decide-row">
            <button type="button" className="btn ok" style={{ flex: 1 }} onClick={() => act("release")} disabled={busy}><Icon name="door" />Release</button>
            <button type="button" className="btn line" onClick={() => setHolding(true)} disabled={busy}>Hold</button>
          </div>
        )}
        {row.status === "gate" && holding && (
          <div className="decide-deny">
            <input aria-label="Reason for holding" placeholder="Reason, e.g. Laptop not on the pass" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} autoFocus />
            <div className="decide-row">
              <button type="button" className="btn danger" onClick={() => act("hold")} disabled={busy || reason.trim().length < 3}><Icon name="shieldAlert" />Hold at gate</button>
              <button type="button" className="btn line" onClick={() => setHolding(false)} disabled={busy}>Back</button>
            </div>
          </div>
        )}
        {row.status === "hold" && (canClear
          ? <ClearHoldButton visitId={row.id} onDone={onDone} />
          : <span className="muted small">Waiting for the host or an admin to clear the hold.</span>)}
        <a className="btn ghost sm" href={`/visits/${row.id}`}><Icon name="file" />Details &amp; gate pass</a>
        {error && <p className="errmsg" role="alert" style={{ margin: 0 }}><Icon name="alert" />{error}</p>}
      </div>
    </article>
  );
}
