"use client";

import { useState } from "react";
import Icon from "../../Icon";
import type { AuditEntry } from "@/lib/services/audit";
import { LOCATION } from "@/lib/config";

const PAGE = 100; // rows shown at a time

export default function AuditTable({ entries }: { entries: AuditEntry[] }) {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [shown, setShown] = useState(PAGE);

  const roles = [...new Set(entries.map((e) => e.role))].sort();
  const term = q.trim().toLowerCase();
  const matches = entries.filter(
    (e) => (!role || e.role === role) && (!term || `${e.action} ${e.by} ${e.detail} ${e.ip}`.toLowerCase().includes(term)),
  );

  return (
    <main className="admin">
      <div className="ph-h">
        <div>
          <h2>Audit log</h2>
          <p>Every sign-in, decision and settings change, newest first. Keeps the last 5,000 entries.</p>
        </div>
      </div>
      <div className="toolbar">
        <div className="grow" style={{ position: "relative" }}>
          <input aria-label="Search the audit log" placeholder="Search by action, person, visitor or IP" value={q} onChange={(e) => { setQ(e.target.value); setShown(PAGE); }} style={{ paddingLeft: 38 }} />
          <span style={{ position: "absolute", left: 12, top: 12, color: "var(--faint)" }}><Icon name="search" /></span>
        </div>
        <select aria-label="Filter by role" value={role} onChange={(e) => { setRole(e.target.value); setShown(PAGE); }} style={{ width: "auto" }}>
          <option value="">Everyone</option>
          {roles.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {matches.length === 0 ? (
        <section className="panel"><div className="empty"><Icon name="scroll" /><b>{entries.length ? "Nothing matches" : "Nothing logged yet"}</b>{entries.length ? "Try another search." : "Staff actions appear here as they happen."}</div></section>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead><tr><th>When</th><th>Action</th><th>By</th><th>Role</th><th>Details</th><th>IP</th></tr></thead>
              <tbody>
                {matches.slice(0, shown).map((e) => (
                  <tr key={e.id}>
                    <td className="small mono" style={{ whiteSpace: "nowrap" }}>{new Date(e.at).toLocaleString("en-GB", { timeZone: LOCATION.timezone, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" })}</td>
                    <td><b>{e.action}</b></td>
                    <td>{e.by}</td>
                    <td className="small muted">{e.role}</td>
                    <td className="small">{e.detail}</td>
                    <td className="small mono muted">{e.ip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small muted" style={{ textAlign: "center" }}>
            Showing {Math.min(shown, matches.length)} of {matches.length}
            {shown < matches.length && <> · <button type="button" className="secondary" style={{ width: "auto", display: "inline-flex" }} onClick={() => setShown((s) => s + PAGE)}>Show more</button></>}
          </p>
        </>
      )}
    </main>
  );
}
