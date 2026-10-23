"use client";

// Clear a gate hold (Visitor Connect): the visitor's host, reception or an admin says security may
// release them, with an optional note.

import { useState } from "react";
import Icon from "./Icon";

export default function ClearHoldButton({ visitId, onDone }: { visitId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function clear() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/staff/visits/${visitId}/gate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear", reason: note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't clear the hold.");
      setOpen(false);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't clear the hold.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="decide">
      {open ? (
        <div className="decide-deny">
          <input aria-label="Note (optional)" placeholder="Note (optional), e.g. Checked the laptop with IT" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} autoFocus />
          <div className="decide-row">
            <button type="button" className="btn sm primary" onClick={clear} disabled={busy}><Icon name="shieldCheck" />Clear hold</button>
            <button type="button" className="btn sm line" onClick={() => setOpen(false)} disabled={busy}>Back</button>
          </div>
        </div>
      ) : (
        <div className="decide-row">
          <button type="button" className="btn sm primary" onClick={() => setOpen(true)}><Icon name="shieldCheck" />Clear hold</button>
        </div>
      )}
      {error && <p className="errmsg" role="alert" style={{ margin: 0 }}><Icon name="alert" />{error}</p>}
    </div>
  );
}
