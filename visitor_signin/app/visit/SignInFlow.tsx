"use client";

import { useEffect, useRef, useState } from "react";
import type { ResolvedBranding } from "@/lib/branding";
import type { AGREEMENT, LOCATION } from "@/lib/config";
import type { FieldMode, Question, StandardField, VisitorType } from "@/lib/db";
import { BADGE_STORAGE_KEY, INVITE_STORAGE_KEY } from "@/lib/storageKeys";
import Icon from "../Icon";
import Logo from "../Logo";
import ExistingBadgeLink from "./ExistingBadgeLink";
import InviteScanner from "./InviteScanner";

type Props = {
  location: typeof LOCATION;
  brand: ResolvedBranding; // company name, logo and colour from /admin/branding
  visitorTypes: VisitorType[];
  agreement: typeof AGREEMENT;
};

type HostOption = { id: string; name: string; department: string };
type Invitation = { token: string; visitorName: string; hostName: string; visitorType: string; type: VisitorType | null };
type Step = "welcome" | "scan" | "type" | "details" | "host" | "invite" | "questions" | "photo" | "agreement";
type ScanState = { attempt: number; checking: boolean; error: string | null };

const STEP_LABELS: Record<Step, string> = {
  welcome: "Welcome", scan: "Scan your invite", type: "Visitor type", details: "Your details", host: "Who you are visiting",
  invite: "Your invitation", questions: "A few questions", photo: "Selfie", agreement: "Agreement",
};

export default function SignInFlow({ location, brand, visitorTypes, agreement }: Props) {
  // null until we've checked whether this phone already holds an invite, so the welcome
  // question doesn't flash up for someone who is about to be recognised.
  const [step, setStep] = useState<Step | null>(null);
  const [scan, setScan] = useState<ScanState>({ attempt: 0, checking: false, error: null });
  const [type, setType] = useState<VisitorType | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({}); // question id -> answer (FR-KIO-05)
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [details, setDetails] = useState({ name: "", phone: "", email: "", company: "", purpose: "" });
  const [returning, setReturning] = useState(false);
  const [host, setHost] = useState<HostOption | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Invited visitors skip the form and host search (requirements §6 flow: "QR invite? yes: skip the form").
  // "welcome" and "scan" come before either path, so they aren't counted in the progress bar.
  const steps: Step[] = invitation ? ["invite"] : ["type", "details", "host"];
  if (type?.questions.length) steps.push("questions");
  if (type?.photoRequired) steps.push("photo");
  if (type?.agreementRequired) steps.push("agreement");
  const stepIndex = step ? steps.indexOf(step) : -1;
  const isLast = stepIndex === steps.length - 1;

  // Whether the chosen type asks for company, email or purpose (FR-KIO-05); optional if not set.
  const modeOf = (field: StandardField): FieldMode => type?.fields?.[field] ?? "optional";
  const labelFor = (text: string, field: StandardField) => (modeOf(field) === "required" ? text : `${text} (optional)`);

  const next = () => (isLast ? submit() : setStep(steps[stepIndex + 1]));
  const back = () => setStep(steps[Math.max(0, stepIndex - 1)]);

  const applyInvitation = (inv: Invitation) => {
    setInvitation(inv);
    setType(inv.type ?? visitorTypes.find((t) => t.id === inv.visitorType) ?? visitorTypes[0]);
    setAnswers({});
    setStep("invite");
  };

  const dropInvitation = () => {
    setInvitation(null);
    setType(null);
    setAnswers({});
    setStep("type");
    try {
      localStorage.removeItem(INVITE_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  };

  const findInvitation = async (query: string): Promise<Invitation | null> => {
    try {
      const res = await fetch(`/api/invitations/match?${query}`);
      if (!res.ok) return null;
      return ((await res.json()) as { invitation: Invitation | null }).invitation;
    } catch {
      return null;
    }
  };

  // If this phone opened an invite link earlier, recognise the visitor straight away.
  useEffect(() => {
    let token: string | null = null;
    try {
      token = localStorage.getItem(INVITE_STORAGE_KEY);
    } catch {
      /* storage blocked — phone-number matching still works */
    }
    if (!token) return setStep("welcome");
    findInvitation(`token=${encodeURIComponent(token)}`).then((inv) => (inv ? applyInvitation(inv) : setStep("welcome")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The visitor scanned the QR in their invitation (FR-KIO-09).
  const onScanned = async (text: string) => {
    const retry = (error: string) => setScan((s) => ({ attempt: s.attempt + 1, checking: false, error }));
    const token = inviteTokenFrom(text);
    if (!token) {
      return retry(
        /\/s\/[^/]+$/.test(text)
          ? "That's the reception sign-in code. Please scan the QR code in your invitation instead."
          : "That QR code isn't a visitor invitation. Please scan the code from your invitation.",
      );
    }
    setScan((s) => ({ ...s, checking: true, error: null }));
    const inv = await findInvitation(`token=${encodeURIComponent(token)}`);
    if (!inv) {
      return retry(
        "This invitation can't be used right now. It may be for another day or another office, or it has already been used. You can still sign in without it.",
      );
    }
    setScan({ attempt: 0, checking: false, error: null });
    applyInvitation(inv);
  };

  // Once the phone number looks complete: an invitation for today wins; otherwise pre-fill a
  // returning visitor's name/company (FR-KIO-08).
  const lookupPhone = async (phone: string) => {
    if (phone.replace(/\D/g, "").length < 8) return;
    const inv = await findInvitation(`phone=${encodeURIComponent(phone)}`);
    if (inv) return applyInvitation(inv);
    try {
      const res = await fetch(`/api/visitors/lookup?phone=${encodeURIComponent(phone)}`);
      if (!res.ok) return;
      const { visitor } = (await res.json()) as { visitor: { name: string; company: string } | null };
      if (visitor) {
        setReturning(true);
        setDetails((d) => ({ ...d, name: d.name || visitor.name, company: d.company || visitor.company }));
      }
    } catch {
      /* lookup is a convenience only */
    }
  };

  const submit = async () => {
    if (!type || (!invitation && !host)) return;
    setSubmitting(true);
    setError(null);
    try {
      const body = invitation
        ? { invitationToken: invitation.token, photo, signature, agreed, answers }
        : { visitorType: type.id, ...details, hostId: host!.id, photo, signature, agreed, answers };
      const res = await fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sign-in failed");
      const href = `/badge/${data.id}?t=${data.badgeToken}`;
      try {
        localStorage.setItem(BADGE_STORAGE_KEY, JSON.stringify({ href, date: new Date().toDateString() }));
        localStorage.removeItem(INVITE_STORAGE_KEY);
      } catch {
        /* the badge page still works without storage */
      }
      window.location.replace(href);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
      setSubmitting(false);
    }
  };

  const canContinue =
    step === "type" ? !!type :
    step === "details" ? details.name.trim().length > 1 && details.phone.replace(/\D/g, "").length >= 8 &&
      (["email", "company", "purpose"] as const).every((f) => modeOf(f) !== "required" || !!details[f].trim()) :
    step === "host" ? !!host :
    step === "invite" ? true :
    step === "questions" ? !!type && type.questions.every((q) => !q.required || !!answers[q.id]?.trim()) :
    step === "photo" ? !!photo :
    agreed && !!signature;

  if (!step) {
    return (
      <main className="phone">
        <p className="muted" role="status">Loading…</p>
      </main>
    );
  }

  return (
    <main className="phone">
      {/* Header from the Visitor Connect design: brand, location, and the step you're on */}
      <header className="v-top">
        <div className="v-top-row">
          <span className="mark">
            <Logo logo={brand.logo} companyName={brand.companyName} color={brand.primaryColor} textColor={brand.primaryText} size={30} />
            {brand.companyName}
          </span>
          <span className="loc"><Icon name="pin" />{location.name}</span>
        </div>
        {stepIndex >= 0 && (
          <>
            <div className="steps" aria-hidden>
              {steps.map((s, i) => <i key={s} className={i <= stepIndex ? "on" : ""} />)}
            </div>
            <div className="steplbl">Step {stepIndex + 1} of {steps.length} · {STEP_LABELS[steps[stepIndex]]}</div>
          </>
        )}
      </header>

      <div className="card stack">
        {step === "welcome" && (
          <>
            <h1>Welcome to {brand.companyName}!</h1>
            <p>Do you have a QR invite?</p>
            <button onClick={() => { setScan({ attempt: 0, checking: false, error: null }); setStep("scan"); }}>
              Yes, scan my invite
            </button>
            <button className="secondary" onClick={() => setStep("type")}>No, sign in as a visitor</button>
            <ExistingBadgeLink />
          </>
        )}

        {step === "scan" && (
          <>
            <h1>Scan your invite</h1>
            {scan.checking ? (
              <p className="muted" role="status">Checking your invitation…</p>
            ) : (
              <InviteScanner key={scan.attempt} onDetected={onScanned} />
            )}
            {scan.error && <p className="error" role="alert">{scan.error}</p>}
            <p className="muted small">
              Can't scan it? Sign in without it and enter the mobile number you were invited with. We'll find your invitation.
            </p>
            <div className="row">
              <button className="secondary" onClick={() => setStep("welcome")} disabled={scan.checking}>Back</button>
              <button className="secondary" onClick={() => setStep("type")} disabled={scan.checking}>Sign in without it</button>
            </div>
          </>
        )}

        {step === "type" && (
          <>
            <h1>What brings you in?</h1>
            {visitorTypes.map((t) => (
              <button
                key={t.id}
                className="choice"
                style={type?.id === t.id ? { outline: `2px solid ${t.color}` } : undefined}
                onClick={() => { if (type?.id !== t.id) setAnswers({}); setType(t); setStep("details"); }}
              >
                <span className="dot" style={{ background: t.color }} />
                <span>{t.label}<small>{t.description}</small></span>
              </button>
            ))}
            <button className="secondary" onClick={() => setStep("welcome")}>Back</button>
          </>
        )}

        {step === "details" && (
          <>
            <h1>Your details</h1>
            <Field label="Mobile number" type="tel" autoComplete="tel" inputMode="tel" value={details.phone}
              onChange={(v) => setDetails({ ...details, phone: v })} onBlur={() => lookupPhone(details.phone)} />
            {returning && <p className="notice">Welcome back! We've filled in your details from last time.</p>}
            <Field label="Full name" autoComplete="name" value={details.name} onChange={(v) => setDetails({ ...details, name: v })} />
            {/* Each type chooses which of these it asks, and which are required (FR-KIO-05). */}
            {modeOf("email") !== "hidden" && (
              <Field label={labelFor("Email", "email")} type="email" autoComplete="email" value={details.email} onChange={(v) => setDetails({ ...details, email: v })} />
            )}
            {modeOf("company") !== "hidden" && (
              <Field label={labelFor("Company", "company")} autoComplete="organization" value={details.company} onChange={(v) => setDetails({ ...details, company: v })} />
            )}
            {modeOf("purpose") !== "hidden" && (
              <Field label={labelFor("Purpose of visit", "purpose")} value={details.purpose} onChange={(v) => setDetails({ ...details, purpose: v })} />
            )}
          </>
        )}

        {step === "host" && <HostPicker selected={host} onSelect={setHost} />}

        {step === "invite" && invitation && (
          <>
            <h1>Welcome, {invitation.visitorName.split(" ")[0]}!</h1>
            <p><strong>{invitation.hostName}</strong> is expecting you today. Your details are already filled in.</p>
            <button onClick={next} disabled={submitting}>
              {submitting ? "Signing in…" : isLast ? "Sign in" : "That's me, continue"}
            </button>
            <button className="secondary" onClick={dropInvitation} disabled={submitting}>
              Not {invitation.visitorName.split(" ")[0]}? Sign in as a walk-in
            </button>
          </>
        )}

        {step === "questions" && type && (
          <QuestionsStep questions={type.questions} answers={answers} onChange={(id, value) => setAnswers((a) => ({ ...a, [id]: value }))} />
        )}

        {step === "photo" && <PhotoStep photo={photo} onPhoto={setPhoto} />}

        {step === "agreement" && (
          <>
            <h1>{agreement.title}</h1>
            <ul className="small" style={{ paddingLeft: 18, margin: 0 }}>
              {agreement.text.map((line) => <li key={line} style={{ marginBottom: 8 }}>{line}</li>)}
            </ul>
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontWeight: 400 }}>
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ width: 22, height: 22, flex: "none" }} />
              I have read and agree to the above.
            </label>
            <div>
              <label>Sign with your finger</label>
              <SignaturePad onChange={setSignature} />
            </div>
          </>
        )}

        {error && <p className="error" role="alert">{error}</p>}

        {/* Not on the first step of either path ("type"/"invite"), nor on "welcome"/"scan" (index -1),
            which have their own buttons. */}
        {stepIndex > 0 && (
          <div className="row">
            <button className="secondary" onClick={back} disabled={submitting}>Back</button>
            <button onClick={next} disabled={!canContinue || submitting}>
              {submitting ? "Signing in…" : isLast ? "Sign in" : "Continue"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

/**
 * Invite QRs hold the invite link, e.g. http://192.168.0.111:3000/invite/<token>. Only the path
 * matters: the host may have been on a different address when they created it.
 */
function inviteTokenFrom(text: string): string | null {
  try {
    return new URL(text.trim()).pathname.match(/^\/invite\/([\w-]+)\/?$/)?.[1] ?? null;
  } catch {
    return null;
  }
}

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  type?: string;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  const id = props.label.toLowerCase().replace(/\W+/g, "-");
  return (
    <div>
      <label htmlFor={id}>{props.label}</label>
      <input id={id} type={props.type ?? "text"} autoComplete={props.autoComplete} inputMode={props.inputMode}
        value={props.value} onChange={(e) => props.onChange(e.target.value)} onBlur={props.onBlur} />
    </div>
  );
}

/** The visitor type's own questions (FR-KIO-05): text, dropdown, yes/no or date. */
function QuestionsStep({ questions, answers, onChange }: {
  questions: Question[];
  answers: Record<string, string>;
  onChange: (id: string, value: string) => void;
}) {
  return (
    <>
      <h1>A few questions</h1>
      {questions.map((q) => {
        const id = `question-${q.id}`;
        const label = `${q.label}${q.required ? "" : " (optional)"}`;
        const value = answers[q.id] ?? "";
        if (q.kind === "yesno") {
          return (
            <fieldset key={q.id} className="question">
              <legend>{label}</legend>
              <div className="row">
                {["Yes", "No"].map((option) => (
                  <button key={option} type="button" className={value === option ? "primary" : "secondary"} aria-pressed={value === option}
                    onClick={() => onChange(q.id, option)}>
                    {option}
                  </button>
                ))}
              </div>
            </fieldset>
          );
        }
        return (
          <div key={q.id}>
            <label htmlFor={id}>{label}</label>
            {q.kind === "select" ? (
              <select id={id} value={value} onChange={(e) => onChange(q.id, e.target.value)}>
                <option value="">Choose one</option>
                {(q.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input id={id} type={q.kind === "date" ? "date" : "text"} maxLength={300} value={value} onChange={(e) => onChange(q.id, e.target.value)} />
            )}
          </div>
        );
      })}
    </>
  );
}

function HostPicker({ selected, onSelect }: { selected: HostOption | null; onSelect: (h: HostOption) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<HostOption[]>([]);

  // Type-ahead over the employee directory (FR-KIO-06).
  useEffect(() => {
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/hosts?q=${encodeURIComponent(query)}`);
        const { hosts } = (await res.json()) as { hosts: HostOption[] };
        setResults(hosts);
      } catch {
        setResults([]);
      }
    }, 200);
    return () => clearTimeout(handle);
  }, [query]);

  return (
    <>
      <h1>Who are you visiting?</h1>
      <div>
        <label htmlFor="host-search">Search by name</label>
        <input id="host-search" type="search" autoComplete="off" placeholder="Start typing a name…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="list" role="listbox" aria-label="Employees">
        {results.map((h) => (
          <button key={h.id} role="option" aria-selected={selected?.id === h.id}
            className={selected?.id === h.id ? "selected" : ""} onClick={() => onSelect(h)}>
            <span>{h.name}</span>
            <span className="muted small">{h.department}</span>
          </button>
        ))}
        {results.length === 0 && <p className="muted small" style={{ padding: 12, margin: 0 }}>No one found. Try another spelling.</p>}
      </div>
    </>
  );
}

function PhotoStep({ photo, onPhoto }: { photo: string | null; onPhoto: (p: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  // capture="user" opens the phone's front camera. It works over plain HTTP, unlike getUserMedia,
  // which needs HTTPS — so this works on the office Wi-Fi during development too.
  const onFile = async (file: File | undefined) => {
    if (file) onPhoto(await resizeImage(file));
  };

  return (
    <>
      <h1>Take a quick photo</h1>
      <p className="muted">It's printed on your badge and shown to your host.</p>
      {photo
        // eslint-disable-next-line @next/next/no-img-element
        ? <img className="photo-preview" src={photo} alt="Your photo" />
        : <div className="photo-preview" style={{ background: "#f3f4f6" }} />}
      <input ref={inputRef} type="file" accept="image/*" capture="user" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      <button className="secondary" onClick={() => inputRef.current?.click()}>
        {photo ? "Retake photo" : "Open camera"}
      </button>
    </>
  );
}

/** Shrinks the camera image to ~480px JPEG so uploads are quick on mobile data. */
async function resizeImage(file: File, max = 480): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.8);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111827";
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const ctx = e.currentTarget.getContext("2d")!;
    const { x, y } = point(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = e.currentTarget.getContext("2d")!;
    const { x, y } = point(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    hasInk.current = true;
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (hasInk.current) onChange(canvasRef.current!.toDataURL("image/png"));
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    hasInk.current = false;
    onChange(null);
  };

  return (
    <>
      <canvas ref={canvasRef} className="signature" aria-label="Signature area"
        onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onPointerLeave={end} />
      <button className="secondary" style={{ marginTop: 8, minHeight: 40 }} onClick={clear}>Clear signature</button>
    </>
  );
}
