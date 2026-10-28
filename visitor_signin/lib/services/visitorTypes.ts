import type { VisitorType } from "../types";
import {
  createVisitorType,
  deleteVisitorType,
  findVisitorTypeById,
  listVisitorTypes,
  updateVisitorType,
  visitCountsByType,
} from "../repos/visitorTypes";
import { cleanVisitorType, newVisitorTypeId } from "../visitorTypes";

// Visitor types (FR-KIO-04/05/07), edited by admins on /admin/visitor-types. The checks on a type's
// fields and questions are in lib/visitorTypes.ts; this file stores and loads them.

export { listVisitorTypes };

const NEED_ONE = "At least one visitor type must stay available, or visitors can't sign in.";
const GONE = "That visitor type doesn't exist any more.";

/** Types offered at sign-in and pre-registration (hidden ones left out). */
export async function getActiveVisitorTypes(): Promise<VisitorType[]> {
  return (await listVisitorTypes()).filter((t) => t.active);
}

/** Any type by id, hidden or not: past visits and badges still need their label and colour. */
export const findVisitorType = (id: string) => findVisitorTypeById(id);

/** All types with how many visits used each (the admin page shows it and blocks deleting used ones). */
export async function typesWithUsage(): Promise<{ types: VisitorType[]; usage: Record<string, number> }> {
  const [types, usage] = await Promise.all([listVisitorTypes(), visitCountsByType()]);
  return { types, usage };
}

export async function addVisitorType(body: unknown): Promise<{ error: string } | { type: VisitorType }> {
  const label = body && typeof body === "object" && typeof (body as { label?: unknown }).label === "string" ? (body as { label: string }).label : "";
  const ids = (await listVisitorTypes()).map((t) => t.id);
  const cleaned = cleanVisitorType(body, newVisitorTypeId(ids, label));
  if ("error" in cleaned) return cleaned;
  return { type: await createVisitorType(cleaned.type) };
}

export async function changeVisitorType(id: string, body: unknown): Promise<{ error: string; status: number } | { type: VisitorType }> {
  const types = await listVisitorTypes();
  if (!types.some((t) => t.id === id)) return { error: GONE, status: 404 };
  const cleaned = cleanVisitorType(body, id);
  if ("error" in cleaned) return { error: cleaned.error, status: 400 };
  if (!cleaned.type.active && !types.some((t) => t.id !== id && t.active)) return { error: NEED_ONE, status: 400 };
  return { type: await updateVisitorType(cleaned.type) };
}

/** Only a type no visit has used can be deleted; otherwise it's hidden, so past visits keep its name and colour. */
export async function removeVisitorType(id: string): Promise<{ error: string; status: number } | { ok: true }> {
  const [types, usage] = await Promise.all([listVisitorTypes(), visitCountsByType()]);
  const type = types.find((t) => t.id === id);
  if (!type) return { error: GONE, status: 404 };
  if (usage[id]) return { error: `${type.label} has been used for visits, so it can't be deleted. Hide it instead.`, status: 409 };
  if (type.active && !types.some((t) => t.id !== id && t.active)) return { error: NEED_ONE, status: 400 };
  await deleteVisitorType(id);
  return { ok: true };
}
