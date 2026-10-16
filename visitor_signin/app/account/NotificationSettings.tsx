"use client";

import { useState } from "react";
import type { NotificationChannel } from "@/lib/db";

type Props = { email: string; phone: string; notifyBy: NotificationChannel[] };

export default function NotificationSettings({ email, phone, notifyBy }: Props) {
  const [channels, setChannels] = useState<NotificationChannel[]>(notifyBy);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  function toggle(channel: NotificationChannel) {
    setMessage(null);
    setChannels((current) => (current.includes(channel) ? current.filter((c) => c !== channel) : [...current, channel]));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/account/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notifyBy: channels }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save");
      setMessage({ text: "Saved.", error: false });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Could not save", error: true });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="stack">
      <p className="muted">When one of your visitors signs in, tell me by:</p>
      <label className="check">
        <input type="checkbox" checked={channels.includes("email")} onChange={() => toggle("email")} />
        <span>Email <span className="muted small">to {email}</span></span>
      </label>
      <label className="check">
        <input type="checkbox" checked={channels.includes("sms")} onChange={() => toggle("sms")} />
        <span>SMS <span className="muted small">to {phone}</span></span>
      </label>

      {channels.length === 0 && <p className="error">Choose at least one, or you won&apos;t know when visitors arrive.</p>}
      {message && <p className={message.error ? "error" : "small"} role="status">{message.text}</p>}
      <button type="submit" disabled={saving || channels.length === 0}>{saving ? "Saving…" : "Save"}</button>
    </form>
  );
}
