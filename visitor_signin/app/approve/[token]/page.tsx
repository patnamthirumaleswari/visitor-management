import DecisionButtons from "../../DecisionButtons";
import Icon from "../../Icon";
import Logo from "../../Logo";
import { minutesSince } from "@/lib/approvals";
import { getBranding } from "@/lib/branding";
import { LOCATION } from "@/lib/config";
import { read } from "@/lib/db";
import { readToken } from "@/lib/token";
import { typeDisplay } from "@/lib/visitorTypes";

export const dynamic = "force-dynamic";

// The page the Approve / Deny link in the host's email or SMS opens: who is waiting, and one tap to answer.
export default async function ApprovePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const brand = getBranding();
  const payload = readToken(token, "decision");
  const [visitId, hostId] = payload?.d.split(":") ?? [];

  const data = payload
    ? read((d) => {
        const visit = d.visits.find((v) => v.id === visitId && v.hostId === hostId);
        if (!visit) return null;
        return {
          visit,
          visitor: d.visitors.find((p) => p.id === visit.visitorId),
          host: d.hosts.find((h) => h.id === hostId),
          type: typeDisplay(d, visit.visitorType),
        };
      })
    : null;

  return (
    <main className="center">
      <div className="signin" style={{ width: "min(480px, 100%)" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Logo logo={brand.logo} companyName={brand.companyName} color={brand.primaryColor} textColor={brand.primaryText} size={40} />
          <div><b style={{ fontFamily: "var(--f-display)" }}>{brand.companyName}</b><div className="muted small">Visitor Connect · {LOCATION.name}</div></div>
        </div>

        {!data ? (
          <div className="status s-bad">
            <Icon name="alert" className="big" />
            <h1>This link doesn&apos;t work any more</h1>
            <p>It may have expired. Sign in to Visitor Connect to see your waiting visitors.</p>
            <a className="btn line" href="/login?role=host" style={{ marginTop: 12 }}>Sign in</a>
          </div>
        ) : (
          <>
            <div className="vrow" style={{ padding: 0, border: 0, background: "none" }}>
              <span className="avatar" style={{ width: 76, height: 76, fontSize: 26 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {data.visitor?.photo ? <img src={data.visitor.photo} alt="" /> : (data.visitor?.name ?? "?")[0]}
              </span>
              <div className="main">
                <div className="t"><b style={{ fontSize: 18 }}>{data.visitor?.name}</b>
                  <span className="pill" style={{ background: `${data.type.color}1f`, color: data.type.color }}>{data.type.label}</span></div>
                <div className="meta">{data.visitor?.company || "No company"} · {data.visitor?.phone}</div>
                <div className="chips">
                  <span className="tag mono">No. {data.visit.no}</span>
                  {data.visit.status === "pending" && <span className="wait"><Icon name="clock" /> waiting {minutesSince(data.visit.checkedInAt)} min</span>}
                </div>
              </div>
            </div>
            {(data.visit.answers ?? []).map((a) => (
              <div key={a.questionId} className="small"><span className="muted">{a.label}</span> {a.value}</div>
            ))}

            {data.visit.status === "pending" ? (
              <>
                <p style={{ margin: 0 }}>is waiting at reception to see <b>{data.host?.name}</b>. Let them in?</p>
                <DecisionButtons endpoint={`/api/approve/${token}`} size="lg" />
              </>
            ) : (
              <div className={`status ${data.visit.status === "denied" ? "s-bad" : "s-ok"}`}>
                <Icon name={data.visit.status === "denied" ? "x" : "shieldCheck"} className="big" />
                <h1>{data.visit.status === "denied" ? "Entry not approved" : "Approved"}</h1>
                <p>{data.visit.decidedBy ? `Answered by ${data.visit.decidedBy}.` : "This visit has been answered."}</p>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
