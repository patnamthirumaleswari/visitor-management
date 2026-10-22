import { newId, write, type Host, type Notification, type NotificationChannel, type Visit, type Visitor } from "./db";
import { escapeHtml, sendEmail, sendSms, type SendResult } from "./channels";
import { LOCATION, VISITOR_TYPES } from "./config";
import { formatDay } from "./dates";
import { getBranding } from "./branding";

/** The company name from /admin/branding, so emails match the reception screen and badge. */
const companyName = () => getBranding().companyName;

/**
 * Tells the host their visitor has arrived (FR-NOT-01/02), by email, SMS or both,
 * whichever the host chose (FR-NOT-06). Channels are sent in parallel.
 * Call it after the sign-in response is sent (next/server `after`), so the visitor never waits.
 */
export async function notifyHost(host: Host, visitor: Visitor, visit: Visit) {
  const channels: NotificationChannel[] = host.notifyBy?.length ? host.notifyBy : ["email"];
  const who = `${visitor.name}${visitor.company ? ` (${visitor.company})` : ""}`;
  const type = VISITOR_TYPES.find((t) => t.id === visit.visitorType)?.label ?? visit.visitorType;
  const time = new Date(visit.signedInAt ?? Date.now()).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: LOCATION.timezone,
  });
  const message = `${who} has arrived at ${LOCATION.name} to see you.`;

  const record = { kind: "arrival", visitId: visit.id, hostId: host.id } as const;

  await Promise.all(
    channels.map((channel) => {
      if (channel === "sms") {
        return deliver({ ...record, channel, to: host.phone }, () => sendSms(host.phone, `${message} (${type}, ${time})`));
      }

      const photo = visitor.photo ? { dataUrl: visitor.photo, contentId: "visitor-photo" } : undefined;
      return deliver({ ...record, channel, to: host.email }, () =>
        sendEmail({
          to: host.email,
          subject: `${visitor.name} has arrived to see you`,
          text: [
            message,
            "",
            `Visitor: ${who}`,
            `Type: ${type}`,
            `Phone: ${visitor.phone}`,
            `Signed in: ${time}`,
            `Location: ${LOCATION.name}, ${LOCATION.address}`,
          ].join("\n"),
          html: emailLayout(`
            <h2 style="margin:0 0 12px">${escapeHtml(visitor.name)} has arrived</h2>
            ${photo ? `<img src="cid:${photo.contentId}" alt="" width="120" height="120" style="border-radius:50%;object-fit:cover;display:block;margin:0 0 16px">` : ""}
            ${detailsTable([
              ["Visitor", who],
              ["Type", type],
              ["Phone", visitor.phone],
              ["Signed in", time],
              ["Location", `${LOCATION.name}, ${LOCATION.address}`],
            ])}
            <p style="margin:16px 0 0">Please come to reception to meet them.</p>`),
          inlineImage: photo,
        }),
      );
    }),
  );
}

/**
 * Sends the visitor their invitation (FR-PRE-02): the link, the date, who invited them,
 * the address and a map link. By email when they gave one, otherwise by SMS.
 */
export async function notifyVisitorInvited(visitor: Visitor, host: Host, visit: Visit, inviteUrl: string) {
  const day = visit.expectedDate ? formatDay(visit.expectedDate) : "your visit day";
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(LOCATION.address)}`;
  const record = { kind: "invitation", visitId: visit.id } as const;

  if (!visitor.email) {
    const text = `${host.name} has invited you to ${companyName()}, ${LOCATION.name} on ${day}. Open your invite: ${inviteUrl}`;
    return deliver({ ...record, channel: "sms", to: visitor.phone }, () => sendSms(visitor.phone, text));
  }

  return deliver({ ...record, channel: "email", to: visitor.email }, () =>
    sendEmail({
      to: visitor.email,
      subject: `You're invited to ${companyName()} on ${day}`,
      text: [
        `Hi ${visitor.name},`,
        "",
        `${host.name} has invited you to ${companyName()}, ${LOCATION.name} on ${day}.`,
        "",
        `Your invitation: ${inviteUrl}`,
        `Address: ${LOCATION.address}`,
        `Map: ${mapUrl}`,
        "",
        "When you arrive, scan the QR code on the screen at reception with your phone. You won't need to fill in a form.",
      ].join("\n"),
      html: emailLayout(`
        <h2 style="margin:0 0 12px">You're invited, ${escapeHtml(visitor.name)}</h2>
        <p style="margin:0 0 16px">${escapeHtml(host.name)} has invited you to ${escapeHtml(companyName())}.</p>
        ${detailsTable([
          ["Date", day],
          ["Host", host.name],
          ["Address", LOCATION.address],
        ])}
        <p style="margin:20px 0">
          <a href="${escapeHtml(inviteUrl)}" style="background:#2563eb;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Open your invitation</a>
          &nbsp; <a href="${escapeHtml(mapUrl)}">Get directions</a>
        </p>
        <p style="margin:0;color:#6b7280">When you arrive, scan the QR code on the screen at reception with your phone. You won't need to fill in a form.</p>`),
    }),
  );
}

/** Sends one message and records the result, including failures, in db.json. Never throws. */
async function deliver(
  record: Pick<Notification, "kind" | "visitId" | "hostId" | "channel" | "to">,
  send: () => Promise<SendResult>,
) {
  let status: Notification["status"];
  let error: string | undefined;
  try {
    status = (await send()).status;
  } catch (e) {
    status = "failed";
    error = e instanceof Error ? e.message : String(e);
    console.error(`[notify] ${record.channel} to ${record.to} failed:`, error);
  }

  write((d) => {
    d.notifications.push({ id: newId(), ...record, status, ...(error ? { error } : {}), sentAt: new Date().toISOString() });
  });
}

function emailLayout(body: string) {
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.5;color:#111827;max-width:520px;margin:0 auto;padding:24px">
${body}
<p style="margin:24px 0 0;font-size:13px;color:#6b7280">${escapeHtml(companyName())} · Visitor Management</p>
</div>`;
}

function detailsTable(rows: Array<[string, string]>) {
  return `<table style="border-collapse:collapse">${rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 16px 4px 0;color:#6b7280;vertical-align:top">${escapeHtml(label)}</td><td style="padding:4px 0">${escapeHtml(value)}</td></tr>`,
    )
    .join("")}</table>`;
}
