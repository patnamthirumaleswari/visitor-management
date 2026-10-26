import { newId, read, write, type Host, type Notification, type NotificationChannel, type Visit, type Visitor } from "./db";
import { escapeHtml, sendEmail, sendSms, type SendResult } from "./channels";
import { LOCATION } from "./config";
import { publicBaseUrl } from "./baseUrl";
import { getSettings } from "./settings";
import { formatDay } from "./dates";
import { makeToken } from "./token";
import { getBranding } from "./branding";
import { typeDisplay } from "./visitorTypes";

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
  const type = read((d) => typeDisplay(d, visit.visitorType).label);
  // The visitor type's questions and answers (FR-KIO-05), e.g. "What work are you doing today?"
  const answers: Array<[string, string]> = (visit.answers ?? []).map((a) => [a.label, a.value]);
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
            ...answers.map(([q, a]) => `${q} ${a}`),
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
              ...answers,
            ])}
            <p style="margin:16px 0 0">Please come to reception to meet them.</p>`),
          inlineImage: photo,
        }),
      );
    }),
  );
}

// The Approve / Deny link in the host's message works for a day, and only for that visit and host.
const DECISION_LINK_SECONDS = 24 * 60 * 60;

/** The link that opens the one-tap Approve / Deny page for this visit (no sign-in needed). */
export function decisionLink(visit: Visit): string {
  return `${publicBaseUrl()}/approve/${makeToken("decision", DECISION_LINK_SECONDS, `${visit.id}:${visit.hostId}`)}`;
}

/**
 * A walk-in is waiting at reception (Visitor Connect host approval): the host gets the visitor's
 * details and an Approve / Deny link, by email, SMS or both as they chose (FR-NOT-06).
 */
export async function notifyHostApproval(host: Host, visitor: Visitor, visit: Visit) {
  const channels: NotificationChannel[] = host.notifyBy?.length ? host.notifyBy : ["email"];
  const who = `${visitor.name}${visitor.company ? ` (${visitor.company})` : ""}`;
  const type = read((d) => typeDisplay(d, visit.visitorType).label);
  const link = decisionLink(visit);
  const answers: Array<[string, string]> = (visit.answers ?? []).map((a) => [a.label, a.value]);
  const record = { kind: "approval", visitId: visit.id, hostId: host.id } as const;

  await Promise.all(
    channels.map((channel) => {
      if (channel === "sms") {
        return deliver({ ...record, channel, to: host.phone }, () =>
          sendSms(host.phone, `${who} is waiting at ${LOCATION.name} reception to see you (${type}). Approve or deny: ${link}`),
        );
      }
      const photo = visitor.photo ? { dataUrl: visitor.photo, contentId: "visitor-photo" } : undefined;
      return deliver({ ...record, channel, to: host.email }, () =>
        sendEmail({
          to: host.email,
          subject: `${visitor.name} is waiting at reception`,
          text: [
            `${who} is waiting at ${LOCATION.name} reception to see you.`,
            "",
            `Type: ${type}`,
            `Phone: ${visitor.phone}`,
            `Visitor no. ${visit.no ?? ""}`,
            ...answers.map(([q, a]) => `${q} ${a}`),
            "",
            `Approve or deny entry: ${link}`,
            `If you don't answer within ${getSettings().escalateMinutes} minutes, reception is told.`,
          ].join("\n"),
          html: emailLayout(`
            <h2 style="margin:0 0 12px">${escapeHtml(visitor.name)} is waiting at reception</h2>
            ${photo ? `<img src="cid:${photo.contentId}" alt="" width="120" height="120" style="border-radius:30%;object-fit:cover;display:block;margin:0 0 16px">` : ""}
            ${detailsTable([["Visitor", who], ["Type", type], ["Phone", visitor.phone], ["Visitor no.", String(visit.no ?? "")], ...answers])}
            <p style="margin:20px 0">
              <a href="${escapeHtml(link)}" style="background:#059669;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:700">Approve or deny</a>
            </p>
            <p style="margin:0;color:#6b7280">If you don't answer within ${getSettings().escalateMinutes} minutes, reception is told.</p>`),
          inlineImage: photo,
        }),
      );
    }),
  );
}

/** The visitor wants to leave: the host confirms the visit is finished (or says "not yet"). */
export async function notifyHostCheckout(host: Host, visitor: Visitor, visit: Visit) {
  const channels: NotificationChannel[] = host.notifyBy?.length ? host.notifyBy : ["email"];
  const link = decisionLink(visit);
  const text = `${visitor.name} (visitor no. ${visit.no ?? ""}) wants to check out. Confirm their visit is finished: ${link}`;
  const record = { kind: "checkout", visitId: visit.id, hostId: host.id } as const;
  await Promise.all(
    channels.map((channel) =>
      channel === "sms"
        ? deliver({ ...record, channel, to: host.phone }, () => sendSms(host.phone, text))
        : deliver({ ...record, channel, to: host.email }, () =>
            sendEmail({
              to: host.email,
              subject: `${visitor.name} wants to check out`,
              text,
              html: emailLayout(`
                <h2 style="margin:0 0 12px">${escapeHtml(visitor.name)} wants to check out</h2>
                <p>Confirm their visit is finished, and security will let them out at the gate.</p>
                <p style="margin:20px 0"><a href="${escapeHtml(link)}" style="background:#059669;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:700">Confirm checkout</a></p>`),
            }),
          ),
    ),
  );
}

/** Security is holding the visitor at the gate: tell the host so they (or an admin) can clear it. */
export async function notifyHostHold(host: Host, visitor: Visitor, visit: Visit) {
  const reason = visit.hold?.reason ?? "";
  const text = `${visitor.name} (visitor no. ${visit.no ?? ""}) is held at the gate by security: ${reason}. Sign in to Visitor Connect to clear the hold.`;
  return deliver({ kind: "hold", visitId: visit.id, hostId: host.id, channel: "email", to: host.email }, () =>
    sendEmail({
      to: host.email,
      subject: `${visitor.name} is held at the gate`,
      text,
      html: emailLayout(`<h2 style="margin:0 0 12px">${escapeHtml(visitor.name)} is held at the gate</h2><p>${escapeHtml(text)}</p>`),
    }),
  );
}

/** Watchlist match at check-in: tell admins (via RECEPTION_EMAIL), not the host. */
export async function notifyWatchlistMatch(visitor: Visitor, visit: Visit) {
  const to = process.env.RECEPTION_EMAIL?.trim() || "admins (RECEPTION_EMAIL not set)";
  const text = `Watchlist match: ${visitor.name} (visitor no. ${visit.no ?? ""}) has checked in and is waiting for an admin. Reason on the list: ${visit.watch?.reason ?? ""}. Sign in as an admin to approve or deny.`;
  return deliver({ kind: "watchlist", visitId: visit.id, channel: "email", to }, () =>
    sendEmail({
      to: process.env.RECEPTION_EMAIL?.trim() || "reception@localhost",
      subject: `Watchlist match: ${visitor.name} needs an admin's decision`,
      text,
      html: emailLayout(`<h2 style="margin:0 0 12px">Watchlist match: ${escapeHtml(visitor.name)}</h2><p>${escapeHtml(text)}</p>`),
    }),
  );
}

/** Nobody answered in time: tell reception (RECEPTION_EMAIL in .env.local), or log it. */
export async function notifyReceptionEscalated(visit: Visit, visitorName: string, hostName: string) {
  const to = process.env.RECEPTION_EMAIL?.trim() || "reception (RECEPTION_EMAIL not set)";
  const what = visit.status === "checkout" ? "confirm their checkout" : "approve entry";
  const text = `${visitorName} (visitor no. ${visit.no ?? ""}) has waited ${getSettings().escalateMinutes}+ minutes for ${hostName} to ${what}. Answer here: ${decisionLink(visit)}`;
  return deliver({ kind: "escalation", visitId: visit.id, channel: "email", to }, () =>
    sendEmail({
      to: process.env.RECEPTION_EMAIL?.trim() || "reception@localhost",
      subject: `Escalated: ${visitorName} is still waiting`,
      text,
      html: emailLayout(`<h2 style="margin:0 0 12px">${escapeHtml(visitorName)} is still waiting</h2><p>${escapeHtml(text)}</p>`),
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
