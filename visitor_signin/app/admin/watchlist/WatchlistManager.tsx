"use client";

import { useState } from "react";
import { mobileInput } from "@/lib/phone";
import Icon from "../../Icon";
import type { WatchEntry } from "@/lib/types";
import { LOCATION } from "@/lib/config";

const EMPTY = { name: "", phone: "", company: "", reason: "" };

export default function WatchlistManager({ initial }: { initial: WatchEntry[] }) {
  const [entries, setEntries] = useState(initial);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function call(url: string, init: RequestInit) {
    const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Something went wrong");
    return data;
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const { entry } = await call("/api/admin/watchlist", { method: "POST", body: JSON.stringify(form) });
      setEntries((es) => [entry, ...es]);
      setForm(EMPTY);
      setMessage({ text: "Added. They'll be held for an admin next time they check in.", error: false });
    } catch (err) {
      setMessage({ text: (err as Error).message, error: true });
    } finally {
      setBusy(false);
    }
  }

  async function toggle(w: WatchEntry) {
    try {
      const { entry } = await call(`/api/admin/watchlist/${w.id}`, { method: "PATCH", body: JSON.stringify({ active: !w.active }) });
      setEntries((es) => es.map((x) => (x.id === w.id ? entry : x)));
    } catch (err) {
      setMessage({ text: (err as Error).message, error: true });
    }
  }

  async function remove(w: WatchEntry) {
    if (!confirm(`Remove ${w.name || w.phone} from the watchlist?`)) return;
    try {
      await call(`/api/admin/watchlist/${w.id}`, { method: "DELETE" });
      setEntries((es) => es.filter((x) => x.id !== w.id));
    } catch (err) {
      setMessage({ text: (err as Error).message, error: true });
    }
  }

  return (
    <main className="admin">
      <div className="ph-h">
        <div>
          <h2>Watchlist</h2>
          <p>People on this list are held at check-in as &ldquo;Watchlist review&rdquo;. Only an admin can let them in; their host isn&rsquo;t asked.</p>
        </div>
      </div>

      <form className="card" onSubmit={add} style={{ display: "grid", gap: 12, marginBottom: 18 }}>
        <h3 style={{ margin: 0 }}>Add someone</h3>
        <p className="muted small" style={{ margin: 0 }}>We match on the mobile number, or on the exact full name (not case sensitive).</p>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <label className="field"><span>Full name</span><input value={form.name} onChange={set("name")} maxLength={80} /></label>
          <label className="field"><span>Mobile number</span><input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: mobileInput(e.target.value) }))} inputMode="numeric" placeholder="10 digits" /></label>
          <label className="field"><span>Company</span><input value={form.company} onChange={set("company")} maxLength={80} /></label>
        </div>
        <label className="field"><span>Reason <span className="req">*</span></span><input value={form.reason} onChange={set("reason")} maxLength={200} placeholder="e.g. Banned after an incident on 3 Oct" /></label>
        {message && <p className={message.error ? "error" : "small"} role="status" style={{ margin: 0 }}>{message.text}</p>}
        <div><button type="submit" disabled={busy} style={{ width: "auto" }}><Icon name="plus" /> {busy ? "Adding…" : "Add to watchlist"}</button></div>
      </form>

      {entries.length === 0 ? (
        <section className="panel"><div className="empty"><Icon name="shieldCheck" /><b>Nobody on the watchlist</b>Add someone above to hold them for an admin when they check in.</div></section>
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Mobile</th><th>Company</th><th>Reason</th><th>Added</th><th>Status</th><th /></tr></thead>
            <tbody>
              {entries.map((w) => (
                <tr key={w.id} style={w.active ? undefined : { opacity: 0.55 }}>
                  <td><b>{w.name || "—"}</b></td>
                  <td>{w.phone || "—"}</td>
                  <td>{w.company || "—"}</td>
                  <td>{w.reason}</td>
                  <td className="small muted">{new Date(w.at).toLocaleDateString("en-GB", { timeZone: LOCATION.timezone, day: "numeric", month: "short", year: "numeric" })} by {w.by}</td>
                  <td><span className={`pill ${w.active ? "t-bad" : ""}`}>{w.active ? "Active" : "Paused"}</span></td>
                  <td>
                    <div className="row-actions">
                      <button type="button" className="button secondary" onClick={() => toggle(w)}>{w.active ? "Pause" : "Resume"}</button>
                      <button type="button" className="button danger" onClick={() => remove(w)}>Remove</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
