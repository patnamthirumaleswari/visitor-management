"use client";

import { useCallback, useEffect, useState } from "react";
import { VISITOR_TYPES } from "@/lib/config";

type OnsiteVisit = {
  id: string;
  name: string;
  company: string;
  phone: string;
  photo: string | null;
  host: string;
  visitorType: string;
  source: string;
  signedInAt: string;
  notified: Array<{ channel: "email" | "sms"; status: "logged" | "sent" | "failed" }>;
};

const STATUS_TEXT = { sent: "sent", logged: "logged only", failed: "failed" } as const;

function NotifiedLine({ notified }: { notified: OnsiteVisit["notified"] }) {
  if (notified.length === 0) return <div className="muted small">Not notified yet</div>;
  return (
    <div className="small">
      {notified.map((n, i) => (
        <span key={i} className={n.status === "failed" ? "error" : "muted"}>
          {i > 0 && " · "}
          {n.channel === "sms" ? "SMS" : "Email"} {STATUS_TEXT[n.status]}
        </span>
      ))}
    </div>
  );
}

type OnsiteEmployee = { id: string; name: string; department: string; phone: string; method: string; signedInAt: string };

const METHOD_TEXT: Record<string, string> = { pin: "PIN", qr: "QR code", portal: "portal" };

type ExpectedVisit = { id: string; name: string; company: string; phone: string; host: string; visitorType: string };

export default function AdminDashboard() {
  const [onsite, setOnsite] = useState<OnsiteVisit[]>([]);
  const [employees, setEmployees] = useState<OnsiteEmployee[]>([]);
  const [expected, setExpected] = useState<ExpectedVisit[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const [onsiteRes, expectedRes] = await Promise.all([
        fetch("/api/admin/onsite", { cache: "no-store" }),
        fetch("/api/admin/expected", { cache: "no-store" }),
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

  return (
    <main className="admin stack">
      <div className="row" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 260px" }}>
          <h1>Visitors on site now ({onsite.length})</h1>
          <p className="muted small">Refreshes every 5 seconds.</p>
        </div>
        <a className="button" href="/pre-register" style={{ flex: "0 0 auto", width: "auto" }}>Pre-register a visitor</a>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th></th><th>Visitor</th><th>Type</th><th>Host</th><th>Signed in</th><th>Phone</th><th></th></tr>
          </thead>
          <tbody>
            {onsite.map((v) => {
              const type = VISITOR_TYPES.find((t) => t.id === v.visitorType);
              return (
                <tr key={v.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <td>{v.photo ? <img src={v.photo} alt="" /> : null}</td>
                  <td><strong>{v.name}</strong>{v.company && <div className="muted small">{v.company}</div>}</td>
                  <td><span style={{ color: type?.color, fontWeight: 600 }}>{type?.label ?? v.visitorType}</span></td>
                  <td>{v.host}<NotifiedLine notified={v.notified ?? []} /></td>
                  <td>{new Date(v.signedInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} <span className="muted small">via {v.source}</span></td>
                  <td>{v.phone}</td>
                  <td>
                    <div className="row-actions">
                      <a className="button secondary" href={`/admin/badge/${v.id}`} target="_blank" rel="noopener">Print badge</a>
                      <button className="secondary" onClick={() => signOut(v.id, v.name)}>Sign out</button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {loaded && onsite.length === 0 && (
              <tr><td colSpan={7} className="muted">No one is signed in.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <h2>Employees on site ({employees.length})</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Employee</th><th>Signed in</th><th>Phone</th><th></th></tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id}>
                <td><strong>{e.name}</strong>{e.department && <div className="muted small">{e.department}</div>}</td>
                <td>{new Date(e.signedInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} <span className="muted small">with {METHOD_TEXT[e.method] ?? e.method}</span></td>
                <td>{e.phone}</td>
                <td><button className="secondary" onClick={() => signOut(e.id, e.name, "employee")}>Sign out</button></td>
              </tr>
            ))}
            {loaded && employees.length === 0 && (
              <tr><td colSpan={4} className="muted">No employees have signed in at reception.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <h2>Expected today, not arrived yet ({expected.length})</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Visitor</th><th>Type</th><th>Host</th><th>Phone</th></tr>
          </thead>
          <tbody>
            {expected.map((v) => {
              const type = VISITOR_TYPES.find((t) => t.id === v.visitorType);
              return (
                <tr key={v.id}>
                  <td><strong>{v.name}</strong>{v.company && <div className="muted small">{v.company}</div>}</td>
                  <td><span style={{ color: type?.color, fontWeight: 600 }}>{type?.label ?? v.visitorType}</span></td>
                  <td>{v.host}</td>
                  <td>{v.phone}</td>
                </tr>
              );
            })}
            {loaded && expected.length === 0 && (
              <tr><td colSpan={4} className="muted">No one else is expected today.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
