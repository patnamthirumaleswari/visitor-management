"use client";

import { useState } from "react";
import { mobileInput } from "@/lib/phone";
import Icon from "../../Icon";
import type { StaffRole } from "@/lib/types";
import type { PersonRow } from "@/lib/services/people";

const ROLE_NAMES: Record<StaffRole, string> = { host: "Host", receptionist: "Reception", security: "Security", admin: "Admin" };
const ROLES: StaffRole[] = ["host", "receptionist", "security", "admin"];
const EMPTY = { name: "", username: "", department: "", email: "", phone: "", signIn: true };

type Secret = { name: string; username: string | null; password: string | null; pin: string | null };

export default function PeopleManager({ initial, meId }: { initial: PersonRow[]; meId: string }) {
  const [people, setPeople] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [role, setRole] = useState<StaffRole>("host");
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [secret, setSecret] = useState<Secret | null>(null);
  const [q, setQ] = useState("");
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: k === "signIn" ? e.target.checked : e.target.value }));

  async function call(url: string, body: unknown) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Something went wrong");
    setPeople(data.people);
    if (data.secret) setSecret(data.secret);
    return data;
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await call("/api/admin/people", { ...form, role });
      setForm(EMPTY);
      setAdding(false);
    } catch (err) {
      setMessage({ text: (err as Error).message, error: true });
    } finally {
      setBusy(false);
    }
  }

  async function act(p: PersonRow, action: string, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return;
    let username: string | undefined;
    if (action === "give-sign-in") {
      username = prompt(`Username for ${p.name} (they sign in with this):`, p.email.split("@")[0] || "")?.trim();
      if (!username) return;
    }
    setMessage(null);
    try {
      await call(`/api/admin/people/${p.id}`, { action, username });
    } catch (err) {
      setMessage({ text: (err as Error).message, error: true });
    }
  }

  const term = q.trim().toLowerCase();
  const shown = term ? people.filter((p) => `${p.name} ${p.username ?? ""} ${p.department} ${p.email}`.toLowerCase().includes(term)) : people;

  return (
    <main className="admin">
      <div className="ph-h">
        <div>
          <h2>People</h2>
          <p>Hosts visitors can come to see, reception, security and admins.</p>
        </div>
        {!adding && <button type="button" style={{ width: "auto" }} onClick={() => { setAdding(true); setMessage(null); }}><Icon name="plus" /> Add person</button>}
      </div>

      {secret && (
        <section className="card stack" style={{ marginBottom: 18, borderColor: "var(--primary)" }} role="status">
          <h3 style={{ margin: 0 }}>Share these with {secret.name}</h3>
          <p className="muted small" style={{ margin: 0 }}>Shown once only. {secret.password ? "They choose their own password when they first sign in." : ""}</p>
          {secret.username && <Secret label="Username" value={secret.username} />}
          {secret.password && <Secret label="Temporary password" value={secret.password} />}
          {secret.pin && <Secret label="PIN for signing in at reception" value={secret.pin} />}
          <div><button type="button" className="secondary" style={{ width: "auto" }} onClick={() => setSecret(null)}>Done</button></div>
        </section>
      )}

      {adding && (
        <form className="card stack" onSubmit={add} style={{ marginBottom: 18 }}>
          <h3 style={{ margin: 0 }}>Add person</h3>
          <div className="tabs" style={{ margin: 0 }}>
            {ROLES.map((r) => <button key={r} type="button" className="tab" aria-pressed={role === r} onClick={() => setRole(r)}>{ROLE_NAMES[r]}</button>)}
          </div>
          <div className="row" style={{ flexWrap: "wrap" }}>
            <label className="field"><span>Full name <span className="req">*</span></span><input value={form.name} onChange={set("name")} maxLength={80} required /></label>
            {(role !== "host" || form.signIn) && (
              <label className="field"><span>Username <span className="req">*</span></span><input value={form.username} onChange={set("username")} maxLength={40} autoCapitalize="none" placeholder="e.g. priya.n" required /></label>
            )}
          </div>
          {role === "host" && (
            <>
              <div className="row" style={{ flexWrap: "wrap" }}>
                <label className="field"><span>Department</span><input value={form.department} onChange={set("department")} maxLength={60} /></label>
                <label className="field"><span>Email for approval requests <span className="req">*</span></span><input type="email" value={form.email} onChange={set("email")} maxLength={120} required /></label>
                <label className="field"><span>Mobile (10 digits)</span><input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: mobileInput(e.target.value) }))} inputMode="numeric" /></label>
              </div>
              <label className="check"><input type="checkbox" checked={form.signIn} onChange={set("signIn")} /> Can sign in to approve their visitors</label>
            </>
          )}
          <p className="muted small" style={{ margin: 0 }}>
            <Icon name="key" /> {role === "host" && !form.signIn ? "They get a PIN for signing in at reception." : "A temporary password is created; they choose their own at first sign-in."}
          </p>
          {message && <p className="error" role="status">{message.text}</p>}
          <div style={{ display: "flex", gap: 10 }}>
            <button type="submit" disabled={busy} style={{ width: "auto" }}>{busy ? "Adding…" : "Add person"}</button>
            <button type="button" className="secondary" style={{ width: "auto" }} onClick={() => { setAdding(false); setMessage(null); }}>Cancel</button>
          </div>
        </form>
      )}
      {!adding && message && <p className="error" role="status">{message.text}</p>}

      <div className="toolbar">
        <div className="grow" style={{ position: "relative" }}>
          <input aria-label="Search people" placeholder="Search by name, username, department or email" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 38 }} />
          <span style={{ position: "absolute", left: 12, top: 12, color: "var(--faint)" }}><Icon name="search" /></span>
        </div>
      </div>

      <section className="panel">
        <div className="panel-h"><h3>{shown.length} {shown.length === 1 ? "person" : "people"}</h3></div>
        {shown.map((p) => (
          <div key={p.id} className="prow" style={p.active ? undefined : { opacity: 0.6 }}>
            <div className="main">
              <b>{p.name}</b>{" "}
              {!p.active && <span className="pill t-done">Switched off</span>}{" "}
              {p.temporaryPassword && <span className="pill t-gold">Temporary password</span>}
              <small>
                {p.role ? ROLE_NAMES[p.role] : "Employee · no sign-in"}
                {p.department ? ` · ${p.department}` : ""}
                {p.username ? <> · <span className="mono">{p.username}</span></> : null}
                {p.email ? ` · ${p.email}` : ""}
              </small>
            </div>
            {p.id === meId ? (
              <span className="muted small">You</span>
            ) : (
              <div className="row-actions" style={{ flexWrap: "wrap" }}>
                {p.role === null && p.active && <button type="button" className="button secondary" onClick={() => act(p, "give-sign-in")}>Give sign-in</button>}
                {p.role && p.active && <button type="button" className="button secondary" onClick={() => act(p, "reset-password", `Give ${p.name} a new temporary password? Their current password stops working.`)}><Icon name="key" /> Reset password</button>}
                {p.hostId && p.active && <button type="button" className="button secondary" onClick={() => act(p, "reset-pin", `Give ${p.name} a new reception PIN?`)}>Reset PIN</button>}
                {p.active ? (
                  <button type="button" className="button secondary" onClick={() => act(p, "switch-off", `Switch off ${p.name}? They can't sign in${p.hostId ? " and visitors can't choose them" : ""} until switched on again.`)}>Switch off</button>
                ) : (
                  <button type="button" className="button secondary" onClick={() => act(p, "switch-on")}>Switch on</button>
                )}
              </div>
            )}
          </div>
        ))}
      </section>
    </main>
  );
}

function Secret({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 14, background: "var(--sunken)" }}>
      <div><small className="muted" style={{ display: "block" }}>{label}</small><b className="mono" style={{ fontSize: 17 }}>{value}</b></div>
      <button type="button" className="secondary" style={{ width: "auto" }} onClick={() => navigator.clipboard?.writeText(value).then(() => setCopied(true))}>
        <Icon name="copy" /> {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
