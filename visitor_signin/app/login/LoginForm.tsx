"use client";

// Based on the staff login from the Vite client (client/src/login/Login.jsx).
// The password check now happens on the server (/api/auth/login) instead of in the browser.

import { useState } from "react";

export default function LoginForm({ next }: { next: string }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not log in");
      // Full page load so the server pages see the new cookie.
      window.location.href = data.redirect;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not log in");
      setSubmitting(false);
    }
  }

  return (
    <main className="phone">
      <div className="card">
        <h1>Staff login</h1>
        <p className="muted">Admins, receptionists, hosts and security officers.</p>

        <form onSubmit={handleSubmit} className="stack">
          <div>
            <label htmlFor="username">Username</label>
            <input id="username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="password">Password</label>
            <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>

          {error && <p className="error" role="alert">{error}</p>}
          <button type="submit" disabled={submitting}>{submitting ? "Logging in…" : "Log in"}</button>
        </form>
      </div>
    </main>
  );
}
