"use client";

import { useEffect, useState } from "react";
import { INVITE_STORAGE_KEY } from "@/lib/storageKeys";

/** Remembers the invite on this phone so the sign-in flow can skip the form on arrival. */
export default function SaveInvite({ token }: { token: string }) {
  const [saved, setSaved] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(INVITE_STORAGE_KEY, token);
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }, [token]);

  if (saved === false) {
    return <p className="small muted">Tip: when you sign in, enter the mobile number you were invited with.</p>;
  }
  return saved ? <p className="small muted">✓ Invitation saved on this phone.</p> : null;
}
