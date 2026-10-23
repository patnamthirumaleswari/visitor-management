"use client";

import { useRef, useState } from "react";
import Icon from "../../Icon";
import SafetyBriefingView from "../../SafetyBriefingView";
import type { SafetyBriefing, SafetyRule } from "@/lib/db";
import { RULE_KINDS } from "@/lib/safetyRules";

const MAX_PLAN_PX = 1200; // exit-plan pictures are shrunk in the browser before upload

export default function SafetyForm({ initial }: { initial: SafetyBriefing }) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [emergencyPhone, setEmergencyPhone] = useState(initial.emergencyPhone);
  const [assemblyPoint, setAssemblyPoint] = useState(initial.assemblyPoint);
  const [notesText, setNotesText] = useState(initial.notes.join("\n"));
  const [rules, setRules] = useState<SafetyRule[]>(initial.rules);
  const [exitPlan, setExitPlan] = useState<string | null>(initial.exitPlan);
  const [planChanged, setPlanChanged] = useState(false);
  const [version, setVersion] = useState(initial.version);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const notes = notesText.split("\n").map((n) => n.trim()).filter(Boolean);
  const setRule = (i: number, patch: Partial<SafetyRule>) => setRules((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const moveRule = (i: number, by: -1 | 1) =>
    setRules((rs) => {
      if (i + by < 0 || i + by >= rs.length) return rs;
      const next = [...rs];
      [next[i], next[i + by]] = [next[i + by], next[i]];
      return next;
    });

  async function pickPlan(file: File | undefined) {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
      setMessage({ text: "Choose a PNG, JPG or WebP picture.", error: true });
      return;
    }
    try {
      setExitPlan(await shrink(file));
      setPlanChanged(true);
      setMessage(null);
    } catch {
      setMessage({ text: "That picture couldn't be read. Try another file.", error: true });
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/safety", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, emergencyPhone, assemblyPoint, notes, rules, ...(planChanged ? { exitPlan } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save");
      const savedVersion: number = data.briefing.version;
      setMessage({ text: savedVersion !== version ? `Saved as version ${savedVersion}. New visitors see it straight away.` : "Saved.", error: false });
      setVersion(savedVersion);
      setPlanChanged(false);
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Could not save", error: true });
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="admin">
      <div className="ph-h">
        <div>
          <h2>Safety briefing</h2>
          <p>Visitors read and accept this before they sign in · version {version}</p>
        </div>
      </div>

      <div className="branding-layout">
        <form className="card stack" onSubmit={save}>
          <label className="check">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            <span>Show the safety briefing at sign-in</span>
          </label>
          <div className="row" style={{ flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 180px" }}>
              <label htmlFor="emergency-phone">Emergency number</label>
              <input id="emergency-phone" value={emergencyPhone} maxLength={30} onChange={(e) => setEmergencyPhone(e.target.value)} />
            </div>
            <div style={{ flex: "1 1 180px" }}>
              <label htmlFor="assembly-point">Assembly point</label>
              <input id="assembly-point" value={assemblyPoint} maxLength={80} onChange={(e) => setAssemblyPoint(e.target.value)} />
            </div>
          </div>
          <div>
            <label htmlFor="safety-notes">&ldquo;Before you start&rdquo; notes, one per line (optional)</label>
            <textarea id="safety-notes" rows={3} value={notesText} onChange={(e) => setNotesText(e.target.value)}
              placeholder="e.g. A fire drill may take place this week." />
          </div>

          <fieldset className="editor-section">
            <legend>Site rules ({rules.length})</legend>
            {rules.map((r, i) => (
              <div key={i} className="rule-edit">
                <select aria-label={`Rule ${i + 1} type`} value={r.kind} onChange={(e) => setRule(i, { kind: e.target.value })}>
                  {Object.entries(RULE_KINDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <input aria-label={`Rule ${i + 1} text`} value={r.text} maxLength={200} onChange={(e) => setRule(i, { text: e.target.value })} />
                <div className="row-actions">
                  <button type="button" className="btn ghost sm" onClick={() => moveRule(i, -1)} disabled={i === 0} aria-label={`Move rule ${i + 1} up`}>↑</button>
                  <button type="button" className="btn ghost sm" onClick={() => moveRule(i, 1)} disabled={i === rules.length - 1} aria-label={`Move rule ${i + 1} down`}>↓</button>
                  <button type="button" className="btn ghost sm" onClick={() => setRules((rs) => rs.filter((_, j) => j !== i))} aria-label={`Remove rule ${i + 1}`}><Icon name="trash" /></button>
                </div>
              </div>
            ))}
            {rules.length < 20 && (
              <button type="button" className="btn line sm" style={{ justifySelf: "start" }} onClick={() => setRules((rs) => [...rs, { kind: "info", text: "" }])}>
                <Icon name="plus" />Add rule
              </button>
            )}
          </fieldset>

          <div>
            <span className="label">Exit plan picture (optional)</span>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { pickPlan(e.target.files?.[0]); e.target.value = ""; }} />
            <div className="row">
              <button type="button" className="secondary" onClick={() => fileRef.current?.click()}>{exitPlan ? "Change picture" : "Upload picture"}</button>
              {exitPlan && <button type="button" className="secondary" onClick={() => { setExitPlan(null); setPlanChanged(true); }}>Remove picture</button>}
            </div>
            <p className="muted small" style={{ margin: "6px 0 0" }}>A floor plan with exits and the assembly point marked. It&apos;s shown to visitors under the rules.</p>
          </div>

          {message && <p className={message.error ? "error" : "small"} role="status">{message.text}</p>}
          <button type="submit" className="btn primary lg" disabled={saving}><Icon name="check" />{saving ? "Saving…" : "Save briefing"}</button>
          <p className="muted small" style={{ margin: 0 }}>Saving a change publishes a new version. Each gate pass records the version the visitor accepted.</p>
        </form>

        <section className="stack" aria-label="Preview">
          <span className="label">Preview: what visitors see</span>
          <div className="card">
            <h3 style={{ marginBottom: 0 }}>Site safety briefing</h3>
            {enabled ? (
              <SafetyBriefingView briefing={{ emergencyPhone, assemblyPoint, notes, rules, exitPlan }} />
            ) : (
              <p className="muted" style={{ marginTop: 10 }}>Switched off: visitors won&apos;t see a briefing at sign-in.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

async function shrink(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, MAX_PLAN_PX / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}
