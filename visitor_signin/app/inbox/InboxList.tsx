"use client";

import { useCallback, useEffect, useState } from "react";
import Icon, { type IconName } from "../Icon";
import type { InboxItem } from "@/lib/services/inbox";

const LOOK: Record<string, { icon: IconName; tone: string }> = {
  arrival: { icon: "user", tone: "r-info" },
  approval: { icon: "bell", tone: "r-warn" },
  checkout: { icon: "logout", tone: "r-warn" },
  hold: { icon: "shieldAlert", tone: "r-stop" },
  watchlist: { icon: "shieldAlert", tone: "r-stop" },
  escalation: { icon: "clock", tone: "r-stop" },
};

export default function InboxList() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/staff/inbox", { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = "/login?next=/inbox";
        return;
      }
      if (!res.ok) return;
      setItems((await res.json()).items);
      setLoaded(true);
    } catch {
      /* keep the last list */
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [load]);

  async function mark(body: { ids: string[] } | { all: true }) {
    const res = await fetch("/api/staff/inbox", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), keepalive: true });
    if (res.ok) setItems((await res.json()).items);
  }

  async function open(e: React.MouseEvent<HTMLAnchorElement>, item: InboxItem) {
    if (item.read) return;
    e.preventDefault();
    await mark({ ids: item.ids }).catch(() => {});
    window.location.href = `/visits/${item.visitId}`;
  }

  const unread = items.filter((i) => !i.read).length;
  return (
    <main className="admin">
      <div className="ph-h">
        <div>
          <h2>Inbox</h2>
          <p>Approval requests and alerts sent to you, also kept here in case an email or SMS goes astray.</p>
        </div>
        {unread > 0 && <button type="button" className="secondary" style={{ width: "auto" }} onClick={() => mark({ all: true })}>Mark all read</button>}
      </div>
      <section className="panel">
        <div className="panel-h"><h3>Messages</h3>{unread > 0 && <span className="count">{unread} unread</span>}</div>
        {items.length > 0 ? (
          <ul className="feed">
            {items.map((i) => {
              const { icon, tone } = LOOK[i.kind] ?? { icon: "mail", tone: "r-info" };
              return (
                <li key={i.ids[0]}>
                  <a href={`/visits/${i.visitId}`} onClick={(e) => open(e, i)} style={i.read ? undefined : { background: "var(--gold-soft)" }}>
                    <span className={`fi ${tone}`}><Icon name={icon} /></span>
                    <span className="main">
                      <b style={{ fontWeight: i.read ? 600 : 800 }}>{i.subject}</b>
                      <small>{i.detail}</small>
                    </span>
                    <span className="when">
                      {new Date(i.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        ) : (
          loaded && <div className="empty"><Icon name="mail" /><b>No messages yet</b>Approval requests arrive here the moment a visitor checks in.</div>
        )}
      </section>
    </main>
  );
}
