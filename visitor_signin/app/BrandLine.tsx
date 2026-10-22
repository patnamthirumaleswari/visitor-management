"use client";

// Small logo + "Company · Location" line at the top of the reception sign-in/out pages.

import { useEffect, useState } from "react";
import { LOCATION } from "@/lib/config";
import type { ResolvedBranding } from "@/lib/branding";
import Logo from "./Logo";

export default function BrandLine() {
  const [brand, setBrand] = useState<ResolvedBranding | null>(null);

  useEffect(() => {
    fetch("/api/branding")
      .then((r) => r.json())
      .then(setBrand)
      .catch(() => {
        /* keep the plain line */
      });
  }, []);

  return (
    <div className="brandline">
      {brand && <Logo logo={brand.logo} companyName={brand.companyName} color={brand.primaryColor} textColor={brand.primaryText} size={28} />}
      <span className="muted small">{brand?.companyName ?? LOCATION.company} · {LOCATION.name}</span>
    </div>
  );
}
