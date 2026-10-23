"use client";

import { useCallback, useEffect, useState } from "react";
import { LOCATION } from "@/lib/config";

type OnsiteVisit = {
  id: string;
  name: string;
  company: string;
  phone: string;
  photo: string | null;
  host: string;
  visitorType: string;
  typeLabel: string;
  typeColor: string;
  signedInAt: string;
};

type WaitingVisitor = { id: string; name: string; company: string; phone: string; host: string; checkedInAt?: string };

type OnsiteEmployee = { id: string; name: string; department: string; phone: string; signedInAt: string };

export default function EvacuationList() {
  const [onsite, setOnsite] = useState<OnsiteVisit[]>([]);
  const [employees, setEmployees] = useState<OnsiteEmployee[]>([]);
  const [waiting, setWaiting] = useState<WaitingVisitor[]>([]); // at reception, waiting for approval
  const [loaded, setLoaded] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/onsite", { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = "/login?next=/security";
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      setOnsite(data.onsite);
      setEmployees(data.employees ?? []);
      setWaiting(data.waiting ?? []);
      setLoaded(true);
      setUpdatedAt(new Date());
    } catch {
      /* keep showing the last list */
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const time = (iso: string | Date) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <main className="admin stack">
      <div className="row" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 260px" }}>
          <h1>On site: {onsite.length + employees.length + waiting.length}</h1>
          <p style={{ margin: "0 0 4px" }}>{onsite.length} visitors · {employees.length} employees signed in at reception</p>
          <p className="muted small">
            {LOCATION.name}{updatedAt && ` · updated ${time(updatedAt)}`}. Use this list to check everyone is out during an evacuation.
          </p>
        </div>
        <button className="no-print" onClick={() => window.print()} style={{ flex: "0 0 auto", width: "auto" }}>Print list</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th></th><th>Visitor</th><th>Type</th><th>Host</th><th>Signed in</th><th>Phone</th></tr>
          </thead>
          <tbody>
            {onsite.map((v) => {
              return (
                <tr key={v.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <td>{v.photo ? <img src={v.photo} alt="" /> : null}</td>
                  <td><strong>{v.name}</strong>{v.company && <div className="muted small">{v.company}</div>}</td>
                  <td><span style={{ color: v.typeColor, fontWeight: 600 }}>{v.typeLabel}</span></td>
                  <td>{v.host}</td>
                  <td>{time(v.signedInAt)}</td>
                  <td>{v.phone}</td>
                </tr>
              );
            })}
            {loaded && onsite.length === 0 && (
              <tr><td colSpan={6} className="muted">No visitors are on site.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {waiting.length > 0 && (
        <>
          <h2>Waiting at reception: {waiting.length}</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Visitor</th><th>Host</th><th>Arrived</th><th>Phone</th></tr></thead>
              <tbody>
                {waiting.map((w) => (
                  <tr key={w.id}>
                    <td><strong>{w.name}</strong>{w.company && <div className="muted small">{w.company}</div>}</td>
                    <td>{w.host}</td>
                    <td>{w.checkedInAt ? time(w.checkedInAt) : ""}</td>
                    <td>{w.phone}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2>Employees on site: {employees.length}</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Employee</th><th>Signed in</th><th>Phone</th></tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id}>
                <td><strong>{e.name}</strong>{e.department && <div className="muted small">{e.department}</div>}</td>
                <td>{time(e.signedInAt)}</td>
                <td>{e.phone}</td>
              </tr>
            ))}
            {loaded && employees.length === 0 && (
              <tr><td colSpan={3} className="muted">No employees have signed in at reception.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
