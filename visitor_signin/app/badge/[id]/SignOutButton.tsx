"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SignOutButton({ visitId, token }: { visitId: string; token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signOut = async () => {
    if (!confirm("Sign out now?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/visits/${visitId}/signout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setError("Couldn't sign you out. Please try again or ask reception.");
      setBusy(false);
    }
  };

  return (
    <>
      <button className="danger" onClick={signOut} disabled={busy}>{busy ? "Signing out…" : "Sign out"}</button>
      {error && <p className="error" role="alert">{error}</p>}
    </>
  );
}
