"use client";

// Staff sign-in (Visitor Connect design). Based on the staff login from the Vite client
// (client/src/login/Login.jsx); the password check happens on the server (/api/auth/login).

import { useState } from "react";
import Icon from "../Icon";
import Logo from "../Logo";

type Props = {
  next: string;
  title: string;
  brand: { logo: string | null; companyName: string; color: string; textColor: string };
  devAccounts: Array<[string, string]>; // [username, label]; empty in production
};

export default function LoginForm({ next, title, brand, devAccounts }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
      if (!res.ok) throw new Error(data.error || "Could not sign in");
      // Full page load so the server pages see the new cookie.
      window.location.href = data.redirect;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
      setSubmitting(false);
    }
  }

  return (
    <main className="center">
      <div className="signin">
        <a className="backlink" href="/"><Icon name="back" />Home</a>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <Logo logo={brand.logo} companyName={brand.companyName} color={brand.color} textColor={brand.textColor} size={52} />
          <div>
            <h2 style={{ fontSize: 24, margin: 0 }}>{title}</h2>
            <div className="muted" style={{ fontWeight: 600 }}>{brand.companyName} Visitor Connect</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
          <div>
            <label htmlFor="username">Username</label>
            <input id="username" autoComplete="username" autoCapitalize="off" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="password">Password</label>
            <div className="pw">
              <input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <button type="button" className="pw-toggle" onClick={() => setShowPassword((s) => !s)} aria-label={showPassword ? "Hide password" : "Show password"}>
                <Icon name={showPassword ? "eyeOff" : "eye"} />
              </button>
            </div>
          </div>

          {error && <p className="errmsg" role="alert" style={{ margin: 0 }}><Icon name="alert" />{error}</p>}
          <button type="submit" className="btn primary lg full" disabled={submitting}>{submitting ? "Signing in…" : "Sign in"}</button>
        </form>

        {devAccounts.length > 0 && (
          <div>
            <div className="muted" style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 7 }}>
              Starting accounts (development only) · tap to fill · password is the username + 123
            </div>
            <div className="democreds">
              {devAccounts.map(([user, label]) => (
                <button key={user} type="button" className="chip" onClick={() => { setUsername(user); setPassword(""); }}>{label}</button>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
