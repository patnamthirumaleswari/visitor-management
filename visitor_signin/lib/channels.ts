// Sends one email (SendGrid) or one SMS (Twilio). Both use the providers' HTTP APIs with fetch,
// so no extra npm package is needed. When a provider isn't configured in .env.local, the message
// is printed to the server console instead and recorded as "logged", so the app works in dev.

// The host should hear within 5 seconds of sign-in (NFR-PER-02), so never wait longer on a provider.
const PROVIDER_TIMEOUT_MS = 5000;

export type SendResult = { status: "sent" | "logged" };

export type Email = {
  to: string;
  subject: string;
  text: string;
  html: string;
  // Inline image shown in the HTML as <img src="cid:...">. Gmail and Outlook block data: URLs.
  inlineImage?: { dataUrl: string; contentId: string };
};

export async function sendEmail(email: Email): Promise<SendResult> {
  const apiKey = process.env.SENDGRID_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    console.log(`[email] (not sent: SendGrid not configured) to ${email.to}\n  ${email.subject}\n  ${email.text.replace(/\n/g, "\n  ")}`);
    return { status: "logged" };
  }

  const attachments = email.inlineImage ? [inlineAttachment(email.inlineImage)].filter(Boolean) : [];
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: email.to }] }],
      from: { email: from, name: process.env.EMAIL_FROM_NAME || undefined },
      subject: email.subject,
      content: [
        { type: "text/plain", value: email.text },
        { type: "text/html", value: email.html },
      ],
      ...(attachments.length ? { attachments } : {}),
    }),
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`SendGrid ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return { status: "sent" };
}

export async function sendSms(to: string, body: string): Promise<SendResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  const number = toE164(to);
  if (!sid || !token || !from) {
    console.log(`[sms] (not sent: Twilio not configured) to ${number}: ${body}`);
    return { status: "logged" };
  }

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: number, From: from, Body: body }),
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return { status: "sent" };
}

/** Twilio needs numbers like +919876543210. Local numbers get DEFAULT_COUNTRY_CODE in front. */
function toE164(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+")) return cleaned;
  const country = process.env.DEFAULT_COUNTRY_CODE || "+91";
  return `${country}${cleaned.replace(/^0+/, "")}`;
}

function inlineAttachment({ dataUrl, contentId }: { dataUrl: string; contentId: string }) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  const [, type, content] = match;
  return { content, type, filename: `${contentId}.${type.split("/")[1]}`, disposition: "inline", content_id: contentId };
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
