"use client";

import { useRef, useState } from "react";
import Logo from "../../Logo";
import type { ResolvedBranding } from "@/lib/branding";

type Props = {
  initial: ResolvedBranding;
  defaults: { companyName: string; welcomeText: string; primaryColor: string };
};

// Logos are shrunk in the browser before upload, so a large photo or scan still saves quickly.
const MAX_LOGO_PX = 400;

export default function BrandingForm({ initial, defaults }: Props) {
  const [companyName, setCompanyName] = useState(initial.companyName);
  const [welcomeText, setWelcomeText] = useState(initial.welcomeText);
  const [primaryColor, setPrimaryColor] = useState(initial.primaryColor);
  const [logo, setLogo] = useState<string | null>(initial.logo);
  const [logoChanged, setLogoChanged] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const textOnPrimary = readableText(primaryColor);

  async function pickLogo(file: File | undefined) {
    if (!file) return;
    setMessage(null);
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      setMessage({ text: "Choose a PNG, JPG or WebP image.", error: true });
      return;
    }
    try {
      setLogo(await shrinkImage(file));
      setLogoChanged(true);
    } catch {
      setMessage({ text: "That image couldn't be read. Try another file.", error: true });
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/branding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, welcomeText, primaryColor, ...(logoChanged ? { logo } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save");
      setLogoChanged(false);
      setMessage({ text: "Saved. Reload any open reception screen to see the change.", error: false });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Could not save", error: true });
    } finally {
      setSaving(false);
    }
  }

  function resetToDefaults() {
    setCompanyName(defaults.companyName);
    setWelcomeText(defaults.welcomeText);
    setPrimaryColor(defaults.primaryColor);
    setLogo(null);
    setLogoChanged(true);
    setMessage({ text: "Defaults filled in. Click Save to keep them.", error: false });
  }

  return (
    <main className="admin branding-layout">
      <form onSubmit={save} className="card stack">
        <h1>Branding</h1>
        <p className="muted small" style={{ margin: 0 }}>Shown on the reception screen, visitor badges, invitation emails and buttons.</p>

        <div>
          <label htmlFor="companyName">Company name</label>
          <input id="companyName" value={companyName} maxLength={60} onChange={(e) => setCompanyName(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="welcomeText">Welcome text on the reception screen</label>
          <input id="welcomeText" value={welcomeText} maxLength={120} onChange={(e) => setWelcomeText(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="primaryColor">Main colour</label>
          <div className="row" style={{ alignItems: "center" }}>
            <input id="primaryColor" type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} style={{ flex: "0 0 64px", height: 48, padding: 4 }} />
            <span className="muted small">{primaryColor.toUpperCase()} · button text will be {textOnPrimary === "#ffffff" ? "white" : "dark"}</span>
          </div>
        </div>
        <div>
          <span className="label">Logo</span>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { pickLogo(e.target.files?.[0]); e.target.value = ""; }} />
          <div className="row">
            <button type="button" className="secondary" onClick={() => fileRef.current?.click()}>{logo ? "Change logo" : "Upload logo"}</button>
            {logo && <button type="button" className="secondary" onClick={() => { setLogo(null); setLogoChanged(true); }}>Remove logo</button>}
          </div>
          <p className="muted small" style={{ margin: "6px 0 0" }}>PNG, JPG or WebP. A wide logo on a transparent or white background works best. Without one, the company initials are shown.</p>
        </div>

        {message && <p className={message.error ? "error" : "small"} role="status">{message.text}</p>}
        <div className="row">
          <button type="button" className="secondary" onClick={resetToDefaults}>Use defaults</button>
          <button type="submit" disabled={saving} style={{ background: primaryColor, color: textOnPrimary }}>{saving ? "Saving…" : "Save"}</button>
        </div>
      </form>

      <section className="stack" aria-label="Preview">
        <span className="label">Preview: reception screen</span>
        <div className="card preview-kiosk">
          <div className="kiosk-brand">
            <Logo logo={logo} companyName={companyName || "?"} color={primaryColor} textColor={textOnPrimary} size={40} />
            <span>{companyName}</span>
          </div>
          <strong className="preview-welcome">{welcomeText}</strong>
          <span className="preview-qr" aria-hidden />
        </div>
        <span className="label">Preview: badge header</span>
        <div className="preview-badge-top" style={{ background: primaryColor, color: textOnPrimary }}>
          <Logo logo={logo} companyName={companyName || "?"} color={textOnPrimary} textColor={primaryColor} size={28} />
          <span>{companyName}</span>
        </div>
      </section>
    </main>
  );
}

/** Same rule as lib/branding.ts readableTextOn, repeated here so the preview updates as you pick. */
function readableText(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return 1.05 / (l + 0.05) >= (l + 0.05) / 0.0592 ? "#ffffff" : "#111827";
}

async function shrinkImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, MAX_LOGO_PX / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png"); // PNG keeps transparent backgrounds
  } finally {
    URL.revokeObjectURL(url);
  }
}
