"use client";

// Visitor sign-out on the reception screen (FR-KIO-10): type your name and pick it,
// or show the QR code on your badge to the camera.

import { useEffect, useState } from "react";
import InviteScanner from "@/app/visit/InviteScanner";
import { LOCATION } from "@/lib/config";

type Match = { id: string; name: string; host: string };
type Step = "search" | "confirm" | "scan" | "done";

// Back to the main reception screen if nobody touches this one, so a chosen name
// isn't left on the screen for the next person.
const IDLE_SECONDS = 45;
const DONE_SECONDS = 5;

export default function VisitorSignOut() {
  const [step, setStep] = useState<Step>("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Match[]>([]);
  const [chosen, setChosen] = useState<Match | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ firstName: string; already: boolean } | null>(null);
  const [lastTouch, setLastTouch] = useState(() => Date.now());

  // Name search as you type.
  useEffect(() => {
    if (step !== "search" || query.trim().length < 2) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/kiosk/onsite?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
        setResults((await res.json()).visitors ?? []);
      } catch {
        /* typing again retries */
      }
    }, 200);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query, step]);

  useEffect(() => {
    const wait = step === "done" ? DONE_SECONDS : IDLE_SECONDS;
    const t = setTimeout(() => (window.location.href = "/kiosk"), wait * 1000);
    return () => clearTimeout(t);
  }, [step, lastTouch]);

  async function signOut(body: { visitId: string } | { badge: string }) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/kiosk/signout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again or ask reception.");
      setDone(data);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again or ask reception.");
    } finally {
      setBusy(false);
    }
  }

  function startOver() {
    setStep("search");
    setChosen(null);
    setQuery("");
    setError(null);
  }

  return (
    <main className="phone" onPointerDown={() => setLastTouch(Date.now())} onKeyDown={() => setLastTouch(Date.now())}>
      <div className="card stack">
        <p className="muted small" style={{ margin: 0 }}>{LOCATION.company} · {LOCATION.name}</p>

        {step === "search" && (
          <>
            <h1>Signing out?</h1>
            <div>
              <label htmlFor="signout-search">Your name</label>
              <input
                id="signout-search"
                autoFocus
                autoComplete="off"
                placeholder="Start typing your name"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            {results.length > 0 && (
              <div className="list">
                {results.map((m) => (
                  <button key={m.id} onClick={() => { setChosen(m); setError(null); setStep("confirm"); }}>
                    <span>{m.name}</span>
                    <span className="muted small">visiting {m.host}</span>
                  </button>
                ))}
              </div>
            )}
            {query.trim().length >= 2 && results.length === 0 && (
              <p className="muted small">No one signed in with that name. You may already be signed out.</p>
            )}
            <button className="secondary" onClick={() => { setError(null); setStep("scan"); }}>Scan my badge instead</button>
            <a className="button secondary" href="/kiosk">Back</a>
          </>
        )}

        {step === "confirm" && chosen && (
          <>
            <h1>Sign out {chosen.name}?</h1>
            <p className="muted" style={{ margin: 0 }}>Visiting {chosen.host}</p>
            {error && <p className="error" role="alert">{error}</p>}
            <button className="danger" onClick={() => signOut({ visitId: chosen.id })} disabled={busy}>
              {busy ? "Signing out…" : "Yes, sign me out"}
            </button>
            <button className="secondary" onClick={startOver}>That&apos;s not me</button>
          </>
        )}

        {step === "scan" && (
          <>
            <h1>Scan your badge</h1>
            <InviteScanner what="the QR code on your badge" onDetected={(text) => signOut({ badge: text })} />
            {busy && <p className="muted">Signing out…</p>}
            {error && <p className="error" role="alert">{error}</p>}
            <button className="secondary" onClick={startOver}>Search for my name instead</button>
          </>
        )}

        {step === "done" && done && (
          <div className="stack" style={{ textAlign: "center" }} role="status">
            <h1>Goodbye, {done.firstName}</h1>
            <p>{done.already ? "You were already signed out." : "You're signed out. Thanks for visiting!"}</p>
            <a className="button" href="/kiosk">Done</a>
          </div>
        )}
      </div>
    </main>
  );
}
