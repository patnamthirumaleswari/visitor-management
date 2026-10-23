"use client";

import { useCallback, useEffect, useState } from "react";
import Icon, { type IconName } from "../Icon";
import RequestList, { StatusPill } from "../RequestList";
import type { RequestRow } from "@/lib/requests";

type OnsiteVisit = {
  id: string;
  no?: number;
  status: RequestRow["status"];
  name: string;
  company: string;
  phone: string;
  photo: string | null;
  host: string;
  visitorType: string;
  typeLabel: string;
  typeColor: string;
  source: string;
  signedInAt: string;
  answers: Array<{ questionId: string; label: string; value: string }>;
  notified: Array<{ channel: "email" | "sms"; status: "logged" | "sent" | "failed" }>;
};

const STATUS_TEXT = { sent: "sent", logged: "logged only", failed: "failed" } as const;

function NotifiedLine({ notified }: { notified: OnsiteVisit["notified"] }) {
  if (notified.length === 0) return <span className="muted">Host not notified yet</span>;
  return (
    <span>
      {notified.map((n, i) => (
        <span key={i} className={n.status === "failed" ? "error" : "muted"}>
          {i > 0 && " · "}
          {n.channel === "sms" ? "SMS" : "Email"} {STATUS_TEXT[n.status]}
        </span>
      ))}
    </span>
  );
}

type OnsiteEmployee = { id: string; name: string; department: string; phone: string; method: string; signedInAt: string };

const METHOD_TEXT: Record<string, string> = { pin: "PIN", qr: "QR code", portal: "portal" };

type ExpectedVisit = { id: string; name: string; company: string; phone: string; host: string; visitorType: string; typeLabel: string; typeColor: string };

export default function AdminDashboard({ firstName, locationName }: { firstName: string; locationName: string }) {
  const [onsite, setOnsite] = useState<OnsiteVisit[]>([]);
  const [employees, setEmployees] = useState<OnsiteEmployee[]>([]);
  const [expected, setExpected] = useState<ExpectedVisit[]>([]);
  const [pending, setPending] = useState<RequestRow[]>([]); // waiting for approval (Visitor Connect)
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const [onsiteRes, expectedRes, requestsRes] = await Promise.all([
        fetch("/api/admin/onsite", { cache: "no-store" }),
        fetch("/api/admin/expected", { cache: "no-store" }),
        fetch("/api/staff/requests", { cache: "no-store" }),
      ]);
      // Logged out (session ended after 8 h, or logged out in another tab): back to the login page.
      if (onsiteRes.status === 401 || expectedRes.status === 401) {
        window.location.href = "/login?next=/admin";
        return;
      }
      if (!onsiteRes.ok || !expectedRes.ok) return;
      const onsiteData = await onsiteRes.json();
      setOnsite(onsiteData.onsite);
      setEmployees(onsiteData.employees ?? []);
      setExpected((await expectedRes.json()).expected);
      if (requestsRes.ok) setPending((await requestsRes.json()).pending);
      setLoaded(true);
    } catch {
      /* keep showing the last list */
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const signOut = async (id: string, name: string, kind: "visit" | "employee" = "visit") => {
    if (!confirm(`Sign out ${name}?`)) return;
    const url = kind === "employee" ? `/api/admin/employee-visits/${id}/signout` : `/api/admin/visits/${id}/signout`;
    const res = await fetch(url, { method: "POST" });
    if (res.status === 401) {
      window.location.href = "/login?next=/admin";
      return;
    }
    load();
  };

  const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // Dashboard layout from the Visitor Connect design: number tiles, then panels of visitor rows.
  return (
    <main className="admin">
      <div className="ph-h">
        <div>
          <h2>{greeting}, {firstName}</h2>
          <p><span className="live-dot" />{locationName} · updates every 5 seconds</p>
        </div>
        <a className="btn primary sm" href="/pre-register"><Icon name="plus" />Pre-register a visitor</a>
      </div>

      <div className="tiles">
        <div className={`tile${pending.length ? " hot" : ""}`}><span className="ti"><Icon name="bell" /></span><b>{pending.length}</b><span>Need an answer</span></div>
        <div className="tile gold"><span className="ti"><Icon name="users" /></span><b>{onsite.length}</b><span>Visitors on site</span></div>
        <div className="tile"><span className="ti"><Icon name="badge" /></span><b>{employees.length}</b><span>Employees in</span></div>
        <div className="tile"><span className="ti"><Icon name="clock" /></span><b>{expected.length}</b><span>Expected today</span></div>
      </div>

      {/* Visitors at reception waiting for their host to approve entry; admins and reception can answer too */}
      {pending.length > 0 && (
        <section className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-h"><h3>Needs an answer</h3><span className="count">{pending.length}</span></div>
          <RequestList rows={pending} onDecided={load} showHost />
        </section>
      )}

      <div className="cols two">
        <section className="panel">
          <div className="panel-h"><h3>Visitors on site</h3><span className="count">{onsite.length}</span></div>
          {onsite.map((v) => {
            const alertFailed = (v.notified ?? []).some((n) => n.status === "failed");
            return (
              <div key={v.id} className={`vrow${alertFailed ? " alert" : ""}`}>
                <Avatar name={v.name} photo={v.photo} size={46} />
                <div className="main">
                  <div className="t">
                    <a className="namelink" href={`/visits/${v.id}`}><b>{v.name}</b></a>
                    <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {v.status !== "signed_in" && <StatusPill status={v.status} />}
                      <span className="pill" style={{ background: `${v.typeColor}1f`, color: v.typeColor }}>{v.typeLabel}</span>
                    </span>
                  </div>
                  <div className="meta">{v.company ? `${v.company} · ` : ""}for {v.host} · {v.phone}</div>
                  <div className="chips">
                    {v.no && <span className="tag mono">No. {v.no}</span>}
                    <span><Icon name="clock" /> in {time(v.signedInAt)} via {v.source}</span>
                    <NotifiedLine notified={v.notified ?? []} />
                  </div>
                  {(v.answers ?? []).map((a) => (
                    <div key={a.questionId} className="small answer"><span className="muted">{a.label}</span> {a.value}</div>
                  ))}
                  <div className="acts">
                    <a className="btn line sm" href={`/visits/${v.id}`}><Icon name="file" />Details</a>
                    <a className="btn line sm" href={`/admin/badge/${v.id}`} target="_blank" rel="noopener"><Icon name="badge" />Print badge</a>
                    <button className="btn line sm" onClick={() => signOut(v.id, v.name)}><Icon name="logout" />Sign out</button>
                  </div>
                </div>
              </div>
            );
          })}
          {loaded && onsite.length === 0 && <Empty icon="users" title="No visitors on site" text="Visitors appear here as soon as they sign in on their phone." />}
        </section>

        <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <section className="panel">
            <div className="panel-h"><h3>Expected today</h3><span className="count">{expected.length}</span></div>
            {expected.map((v) => (
              <div key={v.id} className="vrow">
                <Avatar name={v.name} photo={null} size={40} />
                <div className="main">
                  <div className="t"><b>{v.name}</b><span className="pill t-wait">Not arrived</span></div>
                  <div className="meta">{v.company ? `${v.company} · ` : ""}<span style={{ color: v.typeColor, fontWeight: 600 }}>{v.typeLabel}</span> · for {v.host}</div>
                </div>
              </div>
            ))}
            {loaded && expected.length === 0 && <Empty icon="check" title="No one else expected" text="Pre-registered visitors show here until they arrive." />}
          </section>

          <section className="panel">
            <div className="panel-h"><h3>Employees on site</h3><span className="count">{employees.length}</span></div>
            {employees.map((e) => (
              <div key={e.id} className="vrow">
                <Avatar name={e.name} photo={null} size={40} />
                <div className="main">
                  <div className="t"><b>{e.name}</b><span className="pill t-ok">In</span></div>
                  <div className="meta">{e.department} · since {time(e.signedInAt)} with {METHOD_TEXT[e.method] ?? e.method}</div>
                  <div className="acts">
                    <button className="btn line sm" onClick={() => signOut(e.id, e.name, "employee")}><Icon name="logout" />Sign out</button>
                  </div>
                </div>
              </div>
            ))}
            {loaded && employees.length === 0 && <Empty icon="badge" title="No employees signed in" text="Employees who sign in at reception show here." />}
          </section>
        </div>
      </div>
    </main>
  );
}

/** Photo, or initials when there's no photo (Visitor Connect avatar). */
function Avatar({ name, photo, size }: { name: string; photo: string | null; size: number }) {
  const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {photo ? <img src={photo} alt="" /> : initials}
    </span>
  );
}

function Empty({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  return <div className="empty"><Icon name={icon} /><b>{title}</b>{text}</div>;
}
