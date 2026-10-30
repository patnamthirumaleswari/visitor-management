"use client";

import { useState } from "react";
import type { FieldMode, Question, QuestionKind, StandardField, VisitorType } from "@/lib/types";

type Props = { initialTypes: VisitorType[]; usage: Record<string, number> };

// A question being edited: options are typed one per line, turned into a list on save.
type DraftQuestion = Omit<Question, "options"> & { optionsText: string };
type Draft = Omit<VisitorType, "questions" | "fields"> & { fields: Record<StandardField, FieldMode>; questions: DraftQuestion[] };

const FIELDS: Array<{ key: StandardField; label: string }> = [
  { key: "company", label: "Company" },
  { key: "email", label: "Email" },
  { key: "purpose", label: "Purpose of visit" },
];
const KIND_LABELS: Record<QuestionKind, string> = { text: "Text", select: "Dropdown", yesno: "Yes / No", date: "Date" };
const MODE_LABELS: Record<FieldMode, string> = { hidden: "Don't ask", optional: "Optional", required: "Required" };

const NEW_ID = "__new__";

function toDraft(t: VisitorType): Draft {
  return {
    ...t,
    fields: { company: t.fields?.company ?? "optional", email: t.fields?.email ?? "optional", purpose: t.fields?.purpose ?? "optional" },
    questions: t.questions.map(({ options, ...q }) => ({ ...q, optionsText: (options ?? []).join("\n") })),
  };
}

function blankDraft(): Draft {
  return {
    id: NEW_ID, label: "", description: "", color: "#0ea5e9", photoRequired: true, agreementRequired: true, active: true,
    fields: { company: "optional", email: "optional", purpose: "optional" }, questions: [],
  };
}

export default function VisitorTypesManager({ initialTypes, usage }: Props) {
  const [types, setTypes] = useState(initialTypes);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isNew = draft?.id === NEW_ID;
  const used = draft && !isNew ? usage[draft.id] ?? 0 : 0;

  function open(d: Draft) {
    setDraft(d);
    setError(null);
    setNotice(null);
    setConfirmDelete(false);
    window.scrollTo({ top: 0, behavior: "smooth" }); // the editor opens at the top of the page
  }

  const update = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const updateQuestion = (i: number, patch: Partial<DraftQuestion>) =>
    setDraft((d) => (d ? { ...d, questions: d.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) } : d));
  const moveQuestion = (i: number, by: -1 | 1) =>
    setDraft((d) => {
      if (!d || i + by < 0 || i + by >= d.questions.length) return d;
      const questions = [...d.questions];
      [questions[i], questions[i + by]] = [questions[i + by], questions[i]];
      return { ...d, questions };
    });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setSaving(true);
    setError(null);
    const body = {
      ...draft,
      questions: draft.questions.map(({ optionsText, ...q }) => ({
        ...q,
        ...(q.kind === "select" ? { options: optionsText.split("\n").map((o) => o.trim()).filter(Boolean) } : {}),
      })),
    };
    try {
      const res = await fetch(isNew ? "/api/admin/visitor-types" : `/api/admin/visitor-types/${draft.id}`, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save");
      const saved: VisitorType = data.type;
      setTypes((list) => (isNew ? [...list, saved] : list.map((t) => (t.id === saved.id ? saved : t))));
      setDraft(null);
      setNotice(`${saved.label} saved. Visitors see the change the next time they scan the reception QR.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!draft || isNew) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/visitor-types/${draft.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not delete");
      setTypes((list) => list.filter((t) => t.id !== draft.id));
      setNotice(`${draft.label} deleted.`);
      setDraft(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete");
      setConfirmDelete(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="admin stack">
      <div className="row" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 260px" }}>
          <h1>{draft ? (isNew ? "New visitor type" : `Edit ${draft.label || "visitor type"}`) : "Visitor types"}</h1>
          {!draft && (
            <p className="muted small" style={{ margin: 0 }}>
              What visitors choose from when they sign in, and what each type is asked.
            </p>
          )}
        </div>
        {/* Hidden while editing: one type at a time, so unsaved changes aren't lost by opening another. */}
        {!draft && (
          <button onClick={() => open(blankDraft())} style={{ flex: "0 0 auto", width: "auto" }}>
            Add visitor type
          </button>
        )}
      </div>
      {notice && <p className="notice" role="status" style={{ margin: 0 }}>{notice}</p>}

      {draft && (
        // Two columns on wide screens (settings | questions) with the buttons pinned at the bottom,
        // so the whole editor fits on a laptop screen without scrolling.
        <form className="card type-editor" onSubmit={save}>
          <div className="editor-columns">
            <div className="editor-col">
              <div className="editor-basics">
                <div>
                  <label htmlFor="type-label">Name</label>
                  <input id="type-label" value={draft.label} maxLength={40} placeholder="e.g. Delivery" onChange={(e) => update({ label: e.target.value })} required />
                </div>
                <div>
                  <label htmlFor="type-color">Colour</label>
                  <input id="type-color" type="color" value={draft.color} onChange={(e) => update({ color: e.target.value })} className="color-input" />
                </div>
                <div className="span-2">
                  <label htmlFor="type-description">Short description</label>
                  <input id="type-description" value={draft.description} maxLength={80} placeholder="Shown under the name at sign-in" onChange={(e) => update({ description: e.target.value })} />
                </div>
              </div>

              <fieldset className="editor-section steps-grid">
                <legend>Sign-in steps</legend>
                <label className="check compact">
                  <input type="checkbox" checked={draft.photoRequired} onChange={(e) => update({ photoRequired: e.target.checked })} />
                  <span>Take a photo</span>
                </label>
                <label className="check compact">
                  <input type="checkbox" checked={draft.agreementRequired} onChange={(e) => update({ agreementRequired: e.target.checked })} />
                  <span>Sign the visitor agreement</span>
                </label>
                <label className="check compact">
                  <input type="checkbox" checked={draft.approvalRequired !== false} onChange={(e) => update({ approvalRequired: e.target.checked })} />
                  <span title="The visitor waits at reception until their host approves entry.">Host approves entry</span>
                </label>
                <label className="check compact">
                  <input type="checkbox" checked={draft.active} onChange={(e) => update({ active: e.target.checked })} />
                  <span title="Untick to hide this type at sign-in. Past visits keep it.">Offer at sign-in</span>
                </label>
              </fieldset>

              <fieldset className="editor-section">
                <legend>Details form</legend>
                {FIELDS.map((f) => (
                  <div key={f.key} className="field-mode">
                    <span>{f.label}</span>
                    <div className="segmented" role="radiogroup" aria-label={f.label}>
                      {(["hidden", "optional", "required"] as FieldMode[]).map((m) => (
                        <button key={m} type="button" role="radio" aria-checked={draft.fields[f.key] === m}
                          className={draft.fields[f.key] === m ? "on" : ""}
                          onClick={() => update({ fields: { ...draft.fields, [f.key]: m } })}>
                          {MODE_LABELS[m]}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <p className="muted small" style={{ margin: 0 }}>Name and mobile number are always asked.</p>
              </fieldset>
            </div>

            <fieldset className="editor-section editor-questions">
              <legend>Extra questions ({draft.questions.length}/10)</legend>
              <div className="questions-scroll">
                {draft.questions.length === 0 && <p className="muted small" style={{ margin: 0 }}>No extra questions. Visitors of this type go straight from the host to the next step.</p>}
                {draft.questions.map((q, i) => (
                  <div key={q.id || i} className="question-edit">
                    <div className="question-edit-top">
                      <input aria-label={`Question ${i + 1} text`} value={q.label} maxLength={200} placeholder={`Question ${i + 1}, e.g. Do you have a safety induction?`}
                        onChange={(e) => updateQuestion(i, { label: e.target.value })} />
                      <div className="row-actions">
                        <button type="button" className="secondary" onClick={() => moveQuestion(i, -1)} disabled={i === 0} aria-label={`Move question ${i + 1} up`}>↑</button>
                        <button type="button" className="secondary" onClick={() => moveQuestion(i, 1)} disabled={i === draft.questions.length - 1} aria-label={`Move question ${i + 1} down`}>↓</button>
                        <button type="button" className="secondary" onClick={() => update({ questions: draft.questions.filter((_, j) => j !== i) })} aria-label={`Remove question ${i + 1}`}>✕</button>
                      </div>
                    </div>
                    <div className="question-edit-options">
                      <select aria-label={`Question ${i + 1} answer type`} value={q.kind} onChange={(e) => updateQuestion(i, { kind: e.target.value as QuestionKind })}>
                        {(Object.keys(KIND_LABELS) as QuestionKind[]).map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
                      </select>
                      <label className="check compact">
                        <input type="checkbox" checked={q.required} onChange={(e) => updateQuestion(i, { required: e.target.checked })} />
                        <span>Required</span>
                      </label>
                    </div>
                    {q.kind === "select" && (
                      <div>
                        <label htmlFor={`options-${i}`} className="small">Options, one per line</label>
                        <textarea id={`options-${i}`} rows={3} value={q.optionsText} placeholder={"Parcel\nDocuments\nFood"}
                          onChange={(e) => updateQuestion(i, { optionsText: e.target.value })} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {draft.questions.length < 10 && (
                <button type="button" className="secondary" onClick={() => update({ questions: [...draft.questions, { id: "", label: "", kind: "text", required: false, optionsText: "" }] })}>
                  Add question
                </button>
              )}
            </fieldset>
          </div>

          <div className="editor-footer">
            <div className="editor-footer-left">
              {error ? (
                <p className="error" role="alert" style={{ margin: 0 }}>{error}</p>
              ) : isNew ? null : used > 0 ? (
                <p className="muted small" style={{ margin: 0 }}>
                  Used for {used} {used === 1 ? "visit" : "visits"}, so it can&apos;t be deleted. Untick &quot;Offer at sign-in&quot; to hide it.
                </p>
              ) : confirmDelete ? (
                <div className="row-actions" style={{ justifyContent: "flex-start" }}>
                  <button type="button" className="secondary" onClick={() => setConfirmDelete(false)} disabled={saving}>Keep it</button>
                  <button type="button" className="danger" onClick={remove} disabled={saving}>Yes, delete {draft.label}</button>
                </div>
              ) : (
                <button type="button" className="link-button" onClick={() => setConfirmDelete(true)}>Delete this type</button>
              )}
            </div>
            <div className="row-actions">
              <button type="button" className="secondary" onClick={() => setDraft(null)} disabled={saving}>Cancel</button>
              <button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </form>
      )}

      {!draft && <div className="type-list">
        {types.map((t) => (
          <article key={t.id} className={`card type-card${t.active ? "" : " type-hidden"}`}>
            <div className="type-card-head">
              <span className="dot" style={{ background: t.color }} aria-hidden />
              <strong>{t.label}</strong>
              {!t.active && <span className="pill">Hidden</span>}
            </div>
            {t.description && <p className="muted small" style={{ margin: 0 }}>{t.description}</p>}
            <ul className="type-facts small">
              <li>{t.photoRequired ? "Photo" : "No photo"} · {t.agreementRequired ? "Agreement" : "No agreement"}</li>
              <li>{t.approvalRequired === false ? "Goes straight in" : "Host approves entry"}</li>
              <li>{t.questions.length === 0 ? "No extra questions" : `${t.questions.length} extra ${t.questions.length === 1 ? "question" : "questions"}`}</li>
              <li className="muted">{usage[t.id] ?? 0} visits</li>
            </ul>
            <button className="secondary" onClick={() => open(toDraft(t))}>Edit</button>
          </article>
        ))}
      </div>}
    </main>
  );
}
