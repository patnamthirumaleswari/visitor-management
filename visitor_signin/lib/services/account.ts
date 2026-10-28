import type { NotificationChannel } from "../types";
import { hashPassword } from "../password";
import { updateHost } from "../repos/hosts";
import { randomToken } from "../token";

// An employee's own settings on My account: reception PIN, personal QR, how they hear about visitors.
// Each returns an error message, or the saved value.

// PINs everyone would try first.
const TOO_EASY = new Set(["1234", "12345", "123456", "0000", "1111", "4321", "1212", "0123"]);
const CHANNELS: NotificationChannel[] = ["email", "sms"];

export async function setOwnPin(hostId: string, pin: string): Promise<{ error: string; status: number } | { ok: true }> {
  if (!/^\d{4,6}$/.test(pin)) return { error: "Your PIN must be 4 to 6 digits.", status: 400 };
  if (TOO_EASY.has(pin) || /^(\d)\1+$/.test(pin)) return { error: "That PIN is too easy to guess. Choose another.", status: 400 };
  const host = await updateHost(hostId, { pinHash: hashPassword(pin), pinFailures: 0, pinLockedUntil: null });
  return host ? { ok: true } : { error: "Employee record not found.", status: 404 };
}

/** A new personal sign-in QR token; the old one stops working at once. */
export async function newOwnQrToken(hostId: string): Promise<string | null> {
  const token = randomToken();
  return (await updateHost(hostId, { qrToken: token })) ? token : null;
}

export async function setOwnNotifyBy(hostId: string, wanted: unknown): Promise<{ error: string; status: number } | { notifyBy: NotificationChannel[] }> {
  const notifyBy = Array.isArray(wanted) ? CHANNELS.filter((c) => wanted.includes(c)) : [];
  if (notifyBy.length === 0) return { error: "Choose email, SMS or both.", status: 400 };
  return (await updateHost(hostId, { notifyBy })) ? { notifyBy } : { error: "Host not found.", status: 404 };
}
