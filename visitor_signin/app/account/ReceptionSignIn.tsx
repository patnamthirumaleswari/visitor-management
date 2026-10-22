"use client";

// The employee's personal QR code and PIN for signing in at reception (FR-EMP-01).

import { useState } from "react";

export default function ReceptionSignIn({ qr: initialQr }: { qr: string | null }) {
  const [qr, setQr] = useState(initialQr);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinMessage, setPinMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [qrMessage, setQrMessage] = useState<string | null>(null);
  const [confirmingNewQr, setConfirmingNewQr] = useState(false);
  const [busy, setBusy] = useState(false);

  async function savePin(e: React.FormEvent) {
    e.preventDefault();
    if (pin !== confirmPin) {
      setPinMessage({ text: "The two PINs don't match.", error: true });
      return;
    }
    setBusy(true);
    setPinMessage(null);
    try {
      const res = await fetch("/api/account/pin", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save the PIN");
      setPin("");
      setConfirmPin("");
      setPinMessage({ text: "PIN changed.", error: false });
    } catch (err) {
      setPinMessage({ text: err instanceof Error ? err.message : "Could not save the PIN", error: true });
    } finally {
      setBusy(false);
    }
  }

  async function newQr() {
    setBusy(true);
    setQrMessage(null);
    try {
      const res = await fetch("/api/account/qr", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not make a new QR code");
      setQr(data.qr);
      setQrMessage("New QR code made. The old one no longer works.");
    } catch (err) {
      setQrMessage(err instanceof Error ? err.message : "Could not make a new QR code");
    } finally {
      setBusy(false);
      setConfirmingNewQr(false);
    }
  }

  const digitsOnly = (v: string) => v.replace(/\D/g, "").slice(0, 6);

  return (
    <>
      <div className="stack" style={{ textAlign: "center" }}>
        <h3 style={{ margin: 0 }}>My QR code</h3>
        {qr && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qr} alt="Your personal sign-in QR code" width={200} height={200} style={{ margin: "0 auto", display: "block" }} />
        )}
        <p className="small muted">
          Show this to the camera on the reception screen to sign in or out. Save a screenshot or print it. Keep it to
          yourself: anyone with it can sign in as you.
        </p>
        {qrMessage && <p className="small" role="status">{qrMessage}</p>}
        {confirmingNewQr ? (
          <div className="row">
            <button className="secondary" onClick={() => setConfirmingNewQr(false)} disabled={busy}>Keep this one</button>
            <button className="danger" onClick={newQr} disabled={busy}>{busy ? "Making…" : "Yes, replace it"}</button>
          </div>
        ) : (
          <button className="secondary" onClick={() => setConfirmingNewQr(true)}>Lost it? Make a new QR code</button>
        )}
      </div>

      <form onSubmit={savePin} className="stack">
        <h3 style={{ margin: 0 }}>Change my PIN</h3>
        <p className="small muted" style={{ margin: 0 }}>4 to 6 digits. Used with your name on the reception screen.</p>
        <div>
          <label htmlFor="new-pin">New PIN</label>
          <input id="new-pin" type="password" inputMode="numeric" autoComplete="new-password" value={pin} onChange={(e) => setPin(digitsOnly(e.target.value))} />
        </div>
        <div>
          <label htmlFor="confirm-pin">Type it again</label>
          <input id="confirm-pin" type="password" inputMode="numeric" autoComplete="new-password" value={confirmPin} onChange={(e) => setConfirmPin(digitsOnly(e.target.value))} />
        </div>
        {pinMessage && <p className={pinMessage.error ? "error" : "small"} role="status">{pinMessage.text}</p>}
        <button type="submit" disabled={busy || pin.length < 4 || confirmPin.length < 4}>Save PIN</button>
      </form>
    </>
  );
}
