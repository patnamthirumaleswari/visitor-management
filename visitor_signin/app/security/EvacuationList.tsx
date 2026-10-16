"use client";

import { useCallback, useEffect, useState } from "react";
import { LOCATION, VISITOR_TYPES } from "@/lib/config";

type OnsiteVisit = {
  id: string;
  name: string;
  company: string;
  phone: string;
  photo: string | null;
  host: string;
  visitorType: string;
  signedInAt: string;
};

export default function EvacuationList() {
  const [onsite, setOnsite] = useState<OnsiteVisit[]>([]);
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
      setOnsite((await res.json()).onsite);
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
          <h1>Visitors on site: {onsite.length}</h1>
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
              const type = VISITOR_TYPES.find((t) => t.id === v.visitorType);
              return (
                <tr key={v.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <td>{v.photo ? <img src={v.photo} alt="" /> : null}</td>
                  <td><strong>{v.name}</strong>{v.company && <div className="muted small">{v.company}</div>}</td>
                  <td><span style={{ color: type?.color, fontWeight: 600 }}>{type?.label ?? v.visitorType}</span></td>
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
    </main>
  );
}
