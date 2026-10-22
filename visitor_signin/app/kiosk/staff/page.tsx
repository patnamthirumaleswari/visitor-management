"use client";

// Employee sign-in / sign-out on the reception screen (FR-EMP-01): choose your name and type
// your PIN, or show your personal QR code. The same steps sign you in or out.

import { useEffect, useRef, useState } from "react";
import BrandLine from "@/app/BrandLine";
import InviteScanner from "@/app/visit/InviteScanner";
import { LOCATION } from "@/lib/config";

type Employee = { id: string; name: string; department: string };
type Done = { action: "signed_in" | "signed_out" | "already_signed_in"; firstName: string; at: string };
type Step = "search" | "pin" | "scan" | "done";

// Back to the visitor screen if nobody touches this one, so a half-finished sign-in
// (a name already chosen) isn't left on the screen for the next person.
const IDLE_SECONDS = 45;
const DONE_SECONDS = 5;

export default function EmployeeKiosk() {
  const [step, setStep] = useState<Step>("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Employee[]>([]);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const [lastTouch, setLastTouch] = useState(() => Date.now());
  const pinRef = useRef<HTMLInputElement>(null);

  // Name search as you type.
  useEffect(() => {
    if (step !== "search" || query.trim().length < 2) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/kiosk/employees?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
        setResults((await res.json()).employees ?? []);
      } catch {
        /* typing again retries */
      }
    }, 200);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query, step]);

  // Leave after a few seconds on the result, or after a while with nobody using the screen.
  useEffect(() => {
    const wait = step === "done" ? DONE_SECONDS : IDLE_SECONDS;
    const t = setTimeout(() => (window.location.href = "/kiosk"), wait * 1000);
    return () => clearTimeout(t);
  }, [step, lastTouch]);

  useEffect(() => {
    if (step === "pin") pinRef.current?.focus();
  }, [step]);

  async function submit(body: { hostId: string; pin: string } | { qr: string }) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/kiosk/employee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
      setDone(data);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setPin("");
    } finally {
      setBusy(false);
    }
  }

  function choose(e: Employee) {
    setEmployee(e);
    setPin("");
    setError(null);
    setStep("pin");
  }

  function startOver() {
    setStep("search");
    setEmployee(null);
    setPin("");
    setQuery("");
    setError(null);
  }

  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: LOCATION.timezone });

  return (
    <main className="phone" onPointerDown={() => setLastTouch(Date.now())} onKeyDown={() => setLastTouch(Date.now())}>
      <div className="card stack">
        <BrandLine />

        {step === "search" && (
          <>
            <h1>Employee sign in / out</h1>
            <div>
              <label htmlFor="employee-search">Your name</label>
              <input
                id="employee-search"
                autoFocus
                autoComplete="off"
                placeholder="Start typing your name"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            {results.length > 0 && (
              <div className="list">
                {results.map((e) => (
                  <button key={e.id} onClick={() => choose(e)}>
                    <span>{e.name}</span>
                    <span className="muted small">{e.department}</span>
                  </button>
                ))}
              </div>
            )}
            {query.trim().length >= 2 && results.length === 0 && <p className="muted small">No one found with that name.</p>}
            <button className="secondary" onClick={() => { setError(null); setStep("scan"); }}>Scan my QR code instead</button>
            <a className="button secondary" href="/kiosk">Back</a>
          </>
        )}

        {step === "pin" && employee && (
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              submit({ hostId: employee.id, pin });
            }}
          >
            <h1>Hi {employee.name.split(" ")[0]}</h1>
            <div>
              <label htmlFor="employee-pin">Your PIN</label>
              <input
                id="employee-pin"
                ref={pinRef}
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                className="pin-input"
              />
            </div>
            {error && <p className="error" role="alert">{error}</p>}
            <button type="submit" disabled={busy || pin.length < 4}>{busy ? "Checking…" : "Continue"}</button>
            <button type="button" className="secondary" onClick={startOver}>That&apos;s not me</button>
          </form>
        )}

        {step === "scan" && (
          <>
            <h1>Scan your QR code</h1>
            <InviteScanner what="your personal QR code (from My account, or a printout)" onDetected={(text) => submit({ qr: text })} />
            {busy && <p className="muted">Checking…</p>}
            {error && <p className="error" role="alert">{error}</p>}
            <button className="secondary" onClick={startOver}>Use my name and PIN instead</button>
          </>
        )}

        {step === "done" && done && (
          <div className="stack" style={{ textAlign: "center" }} role="status">
            {done.action === "signed_out" ? (
              <>
                <h1>Goodbye, {done.firstName}</h1>
                <p>You signed out at <strong>{time(done.at)}</strong>.</p>
              </>
            ) : (
              <>
                <h1>Welcome, {done.firstName}</h1>
                <p>
                  {done.action === "already_signed_in" ? "You're already signed in, since " : "You signed in at "}
                  <strong>{time(done.at)}</strong>.
                </p>
              </>
            )}
            <a className="button" href="/kiosk">Done</a>
          </div>
        )}
      </div>
    </main>
  );
}
