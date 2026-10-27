"use client";

import { useState } from "react";

export default function PasswordForm({ temporary, next }: { temporary: boolean; next: string }) {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (password !== again) {
      setMessage({ text: "The two new passwords don't match.", error: true });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current, next: password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not change your password");
      if (temporary) {
        window.location.href = next;
        return;
      }
      setCurrent("");
      setPassword("");
      setAgain("");
      setMessage({ text: "Password changed.", error: false });
    } catch (err) {
      setMessage({ text: (err as Error).message, error: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card stack" onSubmit={save}>
      <h1>{temporary ? "Choose your password" : "Change password"}</h1>
      {temporary && <p className="notice" style={{ margin: 0 }}>You signed in with a temporary password. Choose your own to continue.</p>}
      <label className="field">
        <span>{temporary ? "Temporary password" : "Current password"}</span>
        <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
      </label>
      <label className="field">
        <span>New password</span>
        <input type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
      </label>
      <label className="field">
        <span>New password again</span>
        <input type="password" autoComplete="new-password" minLength={8} value={again} onChange={(e) => setAgain(e.target.value)} required />
      </label>
      <p className="muted small" style={{ margin: 0 }}>At least 8 characters.</p>
      {message && <p className={message.error ? "error" : "small"} role="status">{message.text}</p>}
      <button type="submit" disabled={busy}>{busy ? "Saving…" : temporary ? "Save and continue" : "Change password"}</button>
    </form>
  );
}
