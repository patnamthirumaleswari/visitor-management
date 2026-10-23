"use client";

// "Approve after all": the host changes their mind about a visitor they didn't approve (same day).

import { useState } from "react";
import Icon from "./Icon";

export default function ReapproveButton({ visitId, onDone }: { visitId: string; onDone: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reapprove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/staff/visits/${visitId}/reapprove`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't approve. Please try again.");
      setConfirming(false);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't approve. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="decide">
      {confirming ? (
        <div className="decide-deny">
          <span className="small">Let them in after all? Their phone will show &ldquo;You are approved&rdquo;.</span>
          <div className="decide-row">
            <button type="button" className="btn sm ok" onClick={reapprove} disabled={busy}><Icon name="check" />Yes, approve</button>
            <button type="button" className="btn sm line" onClick={() => setConfirming(false)} disabled={busy}>Back</button>
          </div>
        </div>
      ) : (
        <div className="decide-row">
          <button type="button" className="btn sm line" onClick={() => setConfirming(true)}><Icon name="refresh" />Approve after all</button>
        </div>
      )}
      {error && <p className="errmsg" role="alert" style={{ margin: 0 }}><Icon name="alert" />{error}</p>}
    </div>
  );
}
