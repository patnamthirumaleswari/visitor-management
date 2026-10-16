"use client";

import { useEffect, useState } from "react";
import { BADGE_STORAGE_KEY } from "@/lib/storageKeys";

/** Shows "View my badge" if this phone signed in earlier today. */
export default function ExistingBadgeLink() {
  const [href, setHref] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(BADGE_STORAGE_KEY) || "null") as { href: string; date: string } | null;
      if (saved && saved.date === new Date().toDateString()) setHref(saved.href);
    } catch {
      /* storage blocked — nothing to show */
    }
  }, []);

  if (!href) return null;
  return (
    <a className="button secondary" href={href}>
      Already signed in? View my badge
    </a>
  );
}
