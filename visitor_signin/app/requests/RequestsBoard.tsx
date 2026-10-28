"use client";

// Host home (Visitor Connect): visitors waiting for your answer, and who came to see you today.

import { useCallback, useEffect, useState } from "react";
import Icon from "../Icon";
import RequestList from "../RequestList";
import type { RequestRow } from "@/lib/services/requests";

export default function RequestsBoard({ firstName, locationName }: { firstName: string; locationName: string }) {
  const [pending, setPending] = useState<RequestRow[]>([]);
  const [today, setToday] = useState<RequestRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/staff/requests", { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = "/login?next=/requests";
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      setPending(data.pending);
      setToday(data.today);
      setLoaded(true);
    } catch {
      /* keep the last list */
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const onSite = today.filter((r) => r.status === "signed_in").length;

  return (
    <main className="admin">
      <div className="ph-h">
        <div>
          <h2>{greeting}, {firstName}</h2>
          <p><span className="live-dot" />{locationName} · updates by itself</p>
        </div>
        <a className="btn line sm" href="/pre-register"><Icon name="send" />Invite a visitor</a>
      </div>

      <div className="tiles">
        <div className={`tile${pending.length ? " hot" : ""}`}><span className="ti"><Icon name="bell" /></span><b>{pending.length}</b><span>Need your answer</span></div>
        <div className="tile"><span className="ti"><Icon name="users" /></span><b>{onSite}</b><span>With you on site</span></div>
        <div className="tile"><span className="ti"><Icon name="badge" /></span><b>{today.length + pending.length}</b><span>Visitors today</span></div>
      </div>

      <div className="cols two">
        <section className="panel">
          <div className="panel-h"><h3>Needs your answer</h3><span className="count">{pending.length}</span></div>
          <RequestList rows={pending} onDecided={load} />
          {loaded && pending.length === 0 && (
            <div className="empty"><Icon name="check" /><b>All caught up</b>New visitors appear here the moment they check in.</div>
          )}
        </section>
        <section className="panel">
          <div className="panel-h"><h3>Your visitors today</h3><span className="count">{today.length}</span></div>
          <RequestList rows={today} onDecided={load} />
          {loaded && today.length === 0 && (
            <div className="empty"><Icon name="users" /><b>No visitors yet today</b>People you approve show here.</div>
          )}
        </section>
      </div>
    </main>
  );
}
