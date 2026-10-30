"use client";

// Based on the pre-registration form from the Vite client
// (branch feature/pre-registration-and-qr-codes, client/src/pre-registration/PreRegistration.jsx).
// Invitations are now saved on the server, so reception can recognise the visitor on arrival.

import { useState } from "react";
import { mobileInput } from "@/lib/phone";
import type { VisitorType } from "@/lib/types";
import { formatDay } from "@/lib/dates";

type HostOption = { id: string; name: string; department: string };
type Props = { hosts: HostOption[]; visitorTypes: VisitorType[]; today: string };

const EMPTY_FORM = { visitorName: "", phone: "", email: "", company: "" };

export default function PreRegisterForm({ hosts, visitorTypes, today }: Props) {
  // A host account gets a list with only themselves, so pick it for them.
  const defaultHostId = hosts.length === 1 ? hosts[0].id : "";
  // The first visitor type an admin has made available (Guest unless they changed it).
  const defaultTypeId = visitorTypes[0]?.id ?? "";
  const [form, setForm] = useState({ ...EMPTY_FORM, visitorType: defaultTypeId, hostId: defaultHostId, visitDate: today });
  const [result, setResult] = useState<{ inviteUrl: string; qr: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm({ ...form, [name]: name === "phone" ? mobileInput(value) : value });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create the invitation");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the invitation");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyLink() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked (e.g. plain HTTP on a phone) — the link is still selectable */
    }
  }

  function registerAnother() {
    setResult(null);
    setForm({ ...EMPTY_FORM, visitorType: defaultTypeId, hostId: defaultHostId, visitDate: today });
  }

  if (result) {
    const host = hosts.find((h) => h.id === form.hostId);
    return (
      <main className="phone">
        <div className="card stack" style={{ textAlign: "center" }}>
          <h1>Pre-registration done!</h1>
          <p>
            {form.visitorName} is expected on <strong>{formatDay(form.visitDate)}</strong> to see {host?.name}.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={result.qr} alt="Invitation QR code" width={220} height={220} style={{ margin: "0 auto", display: "block" }} />
          <p className="small muted">
            Send this link or QR to the visitor. They open it on their phone; on arrival they scan the screen at
            reception and skip the form.
          </p>
          <input readOnly value={result.inviteUrl} onFocus={(e) => e.target.select()} aria-label="Invitation link" />
          <div className="row">
            <button className="secondary" onClick={copyLink}>{copied ? "Copied!" : "Copy link"}</button>
            <button onClick={registerAnother}>Register another</button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="phone">
      <div className="card">
        <h1>Pre-register a visitor</h1>
        <p className="muted">Invite a visitor and get their QR code.</p>

        <form onSubmit={handleSubmit} className="stack">
          <div>
            <label htmlFor="visitorName">Visitor name</label>
            <input id="visitorName" name="visitorName" value={form.visitorName} onChange={handleChange} required />
          </div>
          <div>
            <label htmlFor="phone">Visitor mobile number (10 digits)</label>
            <input id="phone" name="phone" type="tel" inputMode="numeric" pattern="\d{10}" title="10 digits" value={form.phone} onChange={handleChange} required />
          </div>
          <div>
            <label htmlFor="email">Visitor email (optional)</label>
            <input id="email" name="email" type="email" value={form.email} onChange={handleChange} />
          </div>
          <div>
            <label htmlFor="company">Company (optional)</label>
            <input id="company" name="company" value={form.company} onChange={handleChange} />
          </div>
          <div>
            <label htmlFor="visitorType">Visitor type</label>
            <select id="visitorType" name="visitorType" value={form.visitorType} onChange={handleChange} required>
              {visitorTypes.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="visitDate">Visit date</label>
            <input id="visitDate" name="visitDate" type="date" min={today} value={form.visitDate} onChange={handleChange} required />
          </div>
          <div>
            <label htmlFor="hostId">Host</label>
            <select id="hostId" name="hostId" value={form.hostId} onChange={handleChange} required disabled={hosts.length === 1}>
              {hosts.length > 1 && <option value="">-- Select host --</option>}
              {hosts.map((h) => <option key={h.id} value={h.id}>{h.name} · {h.department}</option>)}
            </select>
          </div>

          {error && <p className="error" role="alert">{error}</p>}
          <button type="submit" disabled={submitting}>{submitting ? "Creating…" : "Generate QR"}</button>
        </form>
      </div>
    </main>
  );
}
