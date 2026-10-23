"use client";

// The visitor's Check out button (Visitor Connect). Their host confirms the visit is finished, then
// security lets them out at the gate.

import { useRouter } from "next/navigation";
import { useState } from "react";
import Icon from "../../Icon";

export default function CheckoutButton({ visitId, token }: { visitId: string; token: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkout() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/visits/${visitId}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't check you out. Please try again or ask reception.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't check you out. Please try again or ask reception.");
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <>
      {confirming ? (
        <div className="row">
          <button className="secondary" onClick={() => setConfirming(false)} disabled={busy}>Not yet</button>
          <button className="primary" onClick={checkout} disabled={busy}>{busy ? "Checking out…" : "Yes, I'm leaving"}</button>
        </div>
      ) : (
        <button className="btn primary lg full" onClick={() => setConfirming(true)}><Icon name="logout" />Check out</button>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </>
  );
}
