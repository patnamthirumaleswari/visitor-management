"use client";

// Activity tracker: everything that happened with your visitors, newest first, grouped by day.
// Tap an entry to open that visitor's details.

import { useCallback, useEffect, useState } from "react";
import Icon, { type IconName } from "../Icon";
import type { ActivityItem } from "@/lib/activity";

/** Icon and colour for an event, from how its text starts. */
function look(event: string): { icon: IconName; tone: string } {
  const e = event.toLowerCase();
  if (e.startsWith("checked in")) return { icon: "user", tone: "r-info" };
  if (e.startsWith("entry approved") || e.startsWith("entry started")) return { icon: "check", tone: "r-safe" };
  if (e.startsWith("entry not approved")) return { icon: "x", tone: "r-stop" };
  if (e.startsWith("no reply") || e.includes("not answered")) return { icon: "bell", tone: "r-warn" };
  if (e.startsWith("checkout requested")) return { icon: "logout", tone: "r-warn" };
  if (e.startsWith("checkout declined")) return { icon: "hourglass", tone: "r-warn" };
  if (e.startsWith("checkout approved") || e.startsWith("cleared for exit")) return { icon: "door", tone: "r-must" };
  if (e.startsWith("held at the gate")) return { icon: "shieldAlert", tone: "r-stop" };
  if (e.startsWith("hold cleared")) return { icon: "shieldCheck", tone: "r-safe" };
  if (e.startsWith("released") || e.startsWith("signed out")) return { icon: "check", tone: "r-info" };
  return { icon: "info", tone: "r-info" };
}

export default function ActivityFeed({ allVisitors }: { allVisitors: boolean }) {
  const [days, setDays] = useState<1 | 7>(1);
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/staff/activity?days=${days}`, { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = "/login?next=/activity";
        return;
      }
      if (!res.ok) return;
      setItems((await res.json()).items);
      setLoaded(true);
    } catch {
      /* keep the last list */
    }
  }, [days]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const term = q.trim().toLowerCase();
  const shown = term ? items.filter((i) => `${i.visitorName} ${i.company} ${i.event} ${i.by} ${i.no ?? ""}`.toLowerCase().includes(term)) : items;
  const dayLabel = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date(Date.now() - 864e5);
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" });
  };

  let lastDay = "";
  return (
    <main className="admin">
      <div className="ph-h">
        <div>
          <h2>Activity</h2>
          <p><span className="live-dot" />{allVisitors ? "Everything happening with visitors" : "Everything happening with your visitors"} · updates by itself</p>
        </div>
        <div className="tabs" style={{ margin: 0 }}>
          <button type="button" className="tab" aria-pressed={days === 1} onClick={() => setDays(1)}>Today</button>
          <button type="button" className="tab" aria-pressed={days === 7} onClick={() => setDays(7)}>Last 7 days</button>
        </div>
      </div>
      <div className="toolbar">
        <div className="grow" style={{ position: "relative" }}>
          <input aria-label="Search activity" placeholder="Search by visitor, company, action or number" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 38 }} />
          <span style={{ position: "absolute", left: 12, top: 12, color: "var(--faint)" }}><Icon name="search" /></span>
        </div>
      </div>

      <section className="panel">
        <div className="panel-h"><h3>{shown.length} {shown.length === 1 ? "event" : "events"}</h3></div>
        {shown.length > 0 ? (
          <ul className="feed">
            {shown.map((i, n) => {
              const day = dayLabel(i.at);
              const header = day !== lastDay ? day : null;
              lastDay = day;
              const { icon, tone } = look(i.event);
              return (
                <li key={`${i.visitId}-${i.at}-${n}`}>
                  {header && <div className="feed-day">{header}</div>}
                  <a href={`/visits/${i.visitId}`}>
                    <span className={`fi ${tone}`}><Icon name={icon} /></span>
                    <span className="main">
                      <b>{i.visitorName}</b>{i.company ? <span className="muted"> · {i.company}</span> : null}
                      <small>{i.event} · by {i.by}{allVisitors ? ` · for ${i.host}` : ""}</small>
                    </span>
                    <span className="when">{new Date(i.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        ) : (
          loaded && <div className="empty"><Icon name="scroll" /><b>No activity {days === 1 ? "today" : "this week"}</b>Check-ins, approvals and checkouts appear here as they happen.</div>
        )}
      </section>
    </main>
  );
}
