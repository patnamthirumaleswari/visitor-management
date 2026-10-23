"use client";

// "Find my visit" (Visitor Connect): reopen your visit screen with your visit code and mobile number.

import { useState } from "react";
import Icon from "../Icon";
import { BADGE_STORAGE_KEY } from "@/lib/storageKeys";

export default function FindMyVisit() {
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function find(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/visits/find", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't find your visit.");
      try {
        localStorage.setItem(BADGE_STORAGE_KEY, JSON.stringify({ href: data.href, date: new Date().toDateString() }));
      } catch {
        /* the visit screen still opens without storage */
      }
      window.location.href = data.href;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't find your visit.");
      setBusy(false);
    }
  }

  return (
    <main className="phone">
      <form className="card stack" onSubmit={find}>
        <h1>Find my visit</h1>
        <p className="muted" style={{ margin: 0 }}>Enter the 4-digit visit code from your check-in and the mobile number you used.</p>
        <div>
          <label htmlFor="find-code">Visit code</label>
          <input id="find-code" className="find-code" inputMode="numeric" autoComplete="off" maxLength={4} value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))} />
        </div>
        <div>
          <label htmlFor="find-phone">Mobile number</label>
          <input id="find-phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        {error && <p className="errmsg" role="alert" style={{ margin: 0 }}><Icon name="alert" />{error}</p>}
        <button type="submit" className="btn primary lg full" disabled={busy || code.length !== 4}>{busy ? "Looking…" : "Open my visit"}</button>
        <a className="btn ghost full" href="/visit"><Icon name="back" />Back</a>
      </form>
    </main>
  );
}
