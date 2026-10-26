import StaffShell from "../../StaffShell";
import Icon, { type IconName } from "../../Icon";
import { getAnalytics, RANGES, type Range } from "@/lib/analytics";
import { ACCESS, requireStaffPage } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Analytics (FR-REP-01): visit numbers, approval and stay times, busiest days and hours, top hosts and
// visitor types for the last 7, 14 or 30 days, with a CSV download (FR-REP-02). Admins only.
export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const staff = await requireStaffPage(ACCESS.reports, "/admin/analytics");
  const asked = Number((await searchParams).days);
  const days: Range = RANGES.includes(asked as Range) ? (asked as Range) : 7;
  const a = getAnalytics(days);

  return (
    <StaffShell staff={staff}>
      <main className="admin">
        <div className="ph-h">
          <div>
            <h2>Analytics</h2>
            <p>Visits that started in the last {days} days, today included</p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <nav className="tabs" style={{ margin: 0 }} aria-label="Date range">
              {RANGES.map((r) => (
                <a key={r} href={`/admin/analytics?days=${r}`} aria-current={r === days ? "page" : undefined}>{r} days</a>
              ))}
            </nav>
            <a className="button secondary" href={`/api/admin/reports/visits?days=${days}`} style={{ width: "auto" }}><Icon name="download" /> Download CSV</a>
          </div>
        </div>

        <div className="tiles">
          <Tile icon="users" value={String(a.total)} label="Visits" gold />
          <Tile icon="clock" value={duration(a.avgApprovalMin)} label="Average time to approve" />
          <Tile icon="hourglass" value={duration(a.avgStayMin)} label="Average stay" />
          <Tile icon="x" value={a.notApprovedPct == null ? "—" : `${Math.round(a.notApprovedPct)}%`} label="Not approved" hot={(a.notApprovedPct ?? 0) >= 20} />
        </div>

        <div className="cols two">
          <section className="panel">
            <div className="panel-h"><h3>Visits per day</h3></div>
            <div style={{ padding: 18 }}>
              <Bars
                values={a.perDay.map((p) => p.count)}
                labels={a.perDay.map((p) => p.day.slice(8).replace(/^0/, ""))}
                titles={a.perDay.map((p) => `${p.day}: ${p.count} ${p.count === 1 ? "visit" : "visits"}`)}
                every={days > 14 ? 3 : 1}
              />
            </div>
          </section>
          <section className="panel">
            <div className="panel-h"><h3>Busiest hours</h3></div>
            <div style={{ padding: 18 }}>
              <Bars
                values={a.perHour.slice(7, 21)}
                labels={a.perHour.slice(7, 21).map((_, i) => String(i + 7))}
                titles={a.perHour.slice(7, 21).map((n, i) => `${i + 7}:00–${i + 8}:00: ${n} ${n === 1 ? "visit" : "visits"}`)}
                every={2}
              />
              <p className="small muted" style={{ margin: "8px 0 0" }}>7 am to 9 pm, by check-in time</p>
            </div>
          </section>
          <section className="panel">
            <div className="panel-h"><h3>Top hosts</h3></div>
            <Ranked rows={a.topHosts.map((h) => ({ label: h.name, count: h.count }))} />
          </section>
          <section className="panel">
            <div className="panel-h"><h3>Visitor types</h3></div>
            <Ranked rows={a.byType.map((t) => ({ label: t.label, count: t.count, color: t.color }))} />
          </section>
        </div>
      </main>
    </StaffShell>
  );
}

function Tile({ icon, value, label, gold, hot }: { icon: IconName; value: string; label: string; gold?: boolean; hot?: boolean }) {
  return (
    <div className={`tile${gold ? " gold" : ""}${hot ? " hot" : ""}`}>
      <span className="ti"><Icon name={icon} /></span>
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}

/** 42 → "42 min", 135 → "2 h 15 min" */
function duration(min: number | null): string {
  if (min == null) return "—";
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}`;
}

/** A simple bar chart. `every` labels every nth bar so the axis doesn't crowd. */
function Bars({ values, labels, titles, every }: { values: number[]; labels: string[]; titles: string[]; every: number }) {
  const W = 600;
  const H = 180;
  const max = Math.max(1, ...values);
  const slot = W / values.length;
  const bar = Math.max(2, slot * 0.62);
  return (
    <svg viewBox={`0 0 ${W} ${H + 22}`} width="100%" role="img" aria-label={titles.join("; ")} style={{ display: "block" }}>
      <line x1="0" x2={W} y1={H} y2={H} stroke="var(--line)" />
      {values.map((v, i) => {
        const h = (v / max) * (H - 18);
        const x = i * slot + (slot - bar) / 2;
        return (
          <g key={i}>
            <title>{titles[i]}</title>
            <rect x={x} y={H - h} width={bar} height={Math.max(h, v ? 2 : 0)} rx="4" fill="var(--primary)" opacity={v ? 0.9 : 0} />
            {v > 0 && <text x={x + bar / 2} y={H - h - 5} textAnchor="middle" fontSize="11" fill="var(--muted)">{v}</text>}
            {i % every === 0 && <text x={x + bar / 2} y={H + 16} textAnchor="middle" fontSize="11" fill="var(--muted)">{labels[i]}</text>}
          </g>
        );
      })}
    </svg>
  );
}

function Ranked({ rows }: { rows: { label: string; count: number; color?: string }[] }) {
  if (!rows.length) return <div className="empty"><Icon name="chart" /><b>No visits yet</b>Nothing in this date range.</div>;
  const max = Math.max(...rows.map((r) => r.count));
  return (
    <div>
      {rows.map((r) => (
        <div key={r.label} className="prow">
          <div className="main">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <b>{r.label}</b>
              <span className="mono small">{r.count}</span>
            </div>
            <div style={{ height: 6, borderRadius: 99, background: "var(--sunken)", marginTop: 6 }}>
              <div style={{ width: `${(r.count / max) * 100}%`, height: "100%", borderRadius: 99, background: r.color ?? "var(--primary)" }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
