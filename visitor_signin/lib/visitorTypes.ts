import crypto from "node:crypto";
import {
  read,
  type Answer,
  type Data,
  type FieldMode,
  type Question,
  type QuestionKind,
  type StandardField,
  type VisitorType,
} from "./db";

// Visitor types and their questions (FR-KIO-04/05/07), stored in data/db.json and edited on
// /admin/visitor-types.

/** Types offered at sign-in and pre-registration (hidden ones left out). */
export function getActiveVisitorTypes(): VisitorType[] {
  return read((d) => d.visitorTypes.filter((t) => t.active));
}

/** Any type by id, hidden or not: past visits and badges still need their label and colour. */
export function findVisitorType(d: Data, id: string): VisitorType | undefined {
  return d.visitorTypes.find((t) => t.id === id);
}

/** Label and colour for showing a visit, with a grey fallback if the type was deleted. */
export function typeDisplay(d: Data, id: string): { label: string; color: string } {
  const type = findVisitorType(d, id);
  return { label: type?.label ?? id, color: type?.color ?? "#6b7280" };
}

const MAX_ANSWER = 300;

/**
 * Checks the visitor's answers against the type's questions: required ones answered, dropdown
 * answers one of the options, yes/no is "Yes" or "No", dates look like dates. Returns the answers
 * to store (with each question's wording), or an error to show the visitor.
 */
export function checkAnswers(type: VisitorType, raw: unknown): { answers: Answer[] } | { error: string } {
  const given = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const answers: Answer[] = [];

  for (const q of type.questions) {
    const value = typeof given[q.id] === "string" ? (given[q.id] as string).trim().slice(0, MAX_ANSWER) : "";
    if (!value) {
      if (q.required) return { error: `Please answer: ${q.label}` };
      continue;
    }
    if (q.kind === "yesno" && value !== "Yes" && value !== "No") return { error: `Choose Yes or No for: ${q.label}` };
    if (q.kind === "select" && !(q.options ?? []).includes(value)) return { error: `Choose one of the options for: ${q.label}` };
    if (q.kind === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return { error: `Enter a date for: ${q.label}` };
    answers.push({ questionId: q.id, label: q.label, value });
  }
  return { answers };
}

export const STANDARD_FIELDS: StandardField[] = ["company", "email", "purpose"];
const FIELD_MODES: FieldMode[] = ["hidden", "optional", "required"];

/** Whether this type asks for company, email or purpose (FR-KIO-05). Optional unless set. */
export function fieldMode(type: Pick<VisitorType, "fields">, field: StandardField): FieldMode {
  return type.fields?.[field] ?? "optional";
}

// --- Checks for what an admin saves on /admin/visitor-types ---

const KINDS: QuestionKind[] = ["text", "select", "yesno", "date"];
const MAX_QUESTIONS = 10;
const MAX_OPTIONS = 20;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Turns what the admin page sent into a clean visitor type, or explains what's wrong. */
export function cleanVisitorType(raw: unknown, id: string): { type: VisitorType } | { error: string } {
  const body = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const label = str(body.label, 40);
  const description = str(body.description, 80);
  const color = str(body.color, 7);
  if (label.length < 2) return { error: "Give the visitor type a name." };
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return { error: "Choose a colour." };

  const rawFields = body.fields && typeof body.fields === "object" ? (body.fields as Record<string, unknown>) : {};
  const fields: Partial<Record<StandardField, FieldMode>> = {};
  for (const f of STANDARD_FIELDS) fields[f] = FIELD_MODES.find((m) => m === rawFields[f]) ?? "optional";

  const rawQuestions = Array.isArray(body.questions) ? body.questions : [];
  if (rawQuestions.length > MAX_QUESTIONS) return { error: `A visitor type can have at most ${MAX_QUESTIONS} questions.` };

  const questions: Question[] = [];
  const seenIds = new Set<string>();
  for (const [i, item] of rawQuestions.entries()) {
    const q = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const qLabel = str(q.label, 200);
    const kind = KINDS.find((k) => k === q.kind);
    if (qLabel.length < 2) return { error: `Question ${i + 1} needs some text.` };
    if (!kind) return { error: `Choose an answer type for question ${i + 1}.` };

    // Keep the question's id when editing, so past answers still line up with it.
    let qId = typeof q.id === "string" && /^[\w-]{1,40}$/.test(q.id) ? q.id : "";
    if (!qId || seenIds.has(qId)) qId = `q-${crypto.randomUUID().slice(0, 8)}`;
    seenIds.add(qId);

    const question: Question = { id: qId, label: qLabel, kind, required: q.required === true };
    if (kind === "select") {
      const options = [...new Set((Array.isArray(q.options) ? q.options : []).map((o) => str(o, 60)).filter(Boolean))];
      if (options.length < 2) return { error: `Question ${i + 1} is a dropdown, so it needs at least 2 options.` };
      if (options.length > MAX_OPTIONS) return { error: `Question ${i + 1} can have at most ${MAX_OPTIONS} options.` };
      question.options = options;
    }
    questions.push(question);
  }

  return {
    type: {
      id,
      label,
      description,
      color: color.toLowerCase(),
      fields,
      photoRequired: body.photoRequired === true,
      agreementRequired: body.agreementRequired === true,
      questions,
      active: body.active !== false,
    },
  };
}

/** A readable, unique id for a new type, e.g. "delivery" or "delivery-2". */
export function newVisitorTypeId(d: Data, label: string): string {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "type";
  let id = base;
  for (let n = 2; d.visitorTypes.some((t) => t.id === id); n++) id = `${base}-${n}`;
  return id;
}
