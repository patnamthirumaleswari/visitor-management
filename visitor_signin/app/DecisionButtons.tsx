"use client";

// One-tap Approve / Deny for a waiting visitor (Visitor Connect). Deny asks for an optional note,
// which the visitor sees on their phone. Used on the staff lists and the page the email link opens.

import { useRouter } from "next/navigation";
import { useState } from "react";
import Icon from "./Icon";

type Props = {
  endpoint: string; // POST { decision, note }
  onDone?: () => void; // default: refresh the page
  size?: "sm" | "lg";
};

export default function DecisionButtons({ endpoint, onDone, size = "sm" }: Props) {
  const router = useRouter();
  const [denying, setDenying] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(decision: "approve" | "deny") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note: decision === "deny" ? note : "" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't save your answer. Please try again.");
      setDenying(false);
      setNote("");
      if (onDone) onDone();
      else router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your answer. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const cls = size === "lg" ? "btn lg" : "btn sm";

  return (
    <div className="decide">
      {denying ? (
        <div className="decide-deny">
          <input
            aria-label="Note for the visitor (optional)"
            placeholder="Note for the visitor (optional), e.g. Please come back after 3 pm"
            value={note}
            maxLength={200}
            onChange={(e) => setNote(e.target.value)}
            autoFocus
          />
          <div className="decide-row">
            <button type="button" className={`${cls} danger`} onClick={() => send("deny")} disabled={busy}><Icon name="x" />Don&apos;t approve</button>
            <button type="button" className={`${cls} line`} onClick={() => setDenying(false)} disabled={busy}>Back</button>
          </div>
        </div>
      ) : (
        <div className="decide-row">
          <button type="button" className={`${cls} ok`} onClick={() => send("approve")} disabled={busy}><Icon name="check" />Approve</button>
          <button type="button" className={`${cls} line`} onClick={() => setDenying(true)} disabled={busy}><Icon name="x" />Deny</button>
        </div>
      )}
      {error && <p className="errmsg" role="alert" style={{ margin: 0 }}><Icon name="alert" />{error}</p>}
    </div>
  );
}
