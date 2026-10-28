"use client";

import { useState } from "react";
import type { Settings } from "@/lib/services/settings";

const KEEP = [30, 90, 180, 365, 730];

export default function SettingsForm({ initial }: { initial: Settings }) {
  const [escalateMinutes, setEscalate] = useState(String(initial.escalateMinutes));
  const [autoOn, setAutoOn] = useState(!!initial.autoSignoutTime);
  const [autoTime, setAutoTime] = useState(initial.autoSignoutTime ?? "20:00");
  const [retentionDays, setRetention] = useState(initial.retentionDays);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const keepOptions = KEEP.includes(retentionDays) || retentionDays === 0 ? KEEP : [...KEEP, retentionDays].sort((a, b) => a - b);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (retentionDays && retentionDays < initial.retentionDays &&
        !confirm(`Visit records older than ${retentionDays} days will be deleted straight away. Continue?`)) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ escalateMinutes: Number(escalateMinutes), autoSignoutTime: autoOn ? autoTime : "", retentionDays }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save");
      setMessage({ text: data.deleted ? `Saved. ${data.deleted} old visit${data.deleted === 1 ? "" : "s"} deleted.` : "Saved.", error: false });
    } catch (err) {
      setMessage({ text: (err as Error).message, error: true });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card stack" onSubmit={save}>
      <h3 style={{ margin: 0 }}>Timings</h3>
      <label className="field">
        <span>Tell reception when a request waits this long (minutes)</span>
        <input type="number" min={1} max={60} inputMode="numeric" value={escalateMinutes} onChange={(e) => setEscalate(e.target.value)} required />
      </label>
      <label className="check"><input type="checkbox" checked={autoOn} onChange={(e) => setAutoOn(e.target.checked)} /> Sign everyone out automatically at the end of the day</label>
      {autoOn && (
        <label className="field">
          <span>Sign-out time</span>
          <input type="time" value={autoTime} onChange={(e) => setAutoTime(e.target.value)} required />
        </label>
      )}

      <h3 style={{ margin: "8px 0 0" }}>Privacy</h3>
      <label className="field">
        <span>Keep visit records for</span>
        <select value={retentionDays} onChange={(e) => setRetention(Number(e.target.value))}>
          {keepOptions.map((d) => <option key={d} value={d}>{d < 365 ? `${d} days` : `${d / 365} year${d === 365 ? "" : "s"}`}</option>)}
          <option value={0}>Keep forever</option>
        </select>
      </label>
      <p className="muted small" style={{ margin: 0 }}>
        Finished visits older than this are deleted with the visitor&apos;s details and photo. The visitor agreement and the{" "}
        <a href="/privacy" target="_blank">privacy notice</a> tell visitors how long you keep them.
      </p>
      {message && <p className={message.error ? "error" : "small"} role="status">{message.text}</p>}
      <button type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
    </form>
  );
}
