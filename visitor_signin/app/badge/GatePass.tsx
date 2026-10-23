// The digital gate pass (Visitor Connect), shared by the visitor's phone and the staff screens.
// It fills in by itself as the visit goes on: registered, approved, checkout approved, released.

import Icon from "../Icon";
import Logo from "../Logo";
import { StatusPill } from "../RequestList";
import { passSteps, type PassData } from "@/lib/gatepass";
import { LOCATION } from "@/lib/config";

const fmt = (iso?: string) =>
  iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: LOCATION.timezone }) : "Pending";

export default function GatePass({ pass }: { pass: PassData }) {
  const { visit, visitor, branding } = pass;
  const initials = visitor.name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
  return (
    <article className="pass glass" aria-label={`Gate pass for ${visitor.name}`}>
      <div className="pass-h">
        <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
          <Logo logo={branding.logo} companyName={branding.companyName} color={branding.primaryColor} textColor={branding.primaryText} size={34} />
          <div style={{ minWidth: 0 }}><b>Visitor Gate Pass</b><small>{pass.locationName}</small></div>
        </div>
        <div className="pass-no"><small>Visitor no.</small><b>{visit.no ?? "—"}</b></div>
      </div>
      <div className="pass-b">
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span className="avatar" style={{ width: 76, height: 76, fontSize: 26 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {visitor.photo ? <img src={visitor.photo} alt="" /> : initials}
          </span>
          <div style={{ minWidth: 0 }}>
            <b style={{ fontFamily: "var(--f-display)", fontSize: 18 }}>{visitor.name}</b>
            {visitor.company && <div className="muted small">{visitor.company}</div>}
            <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
              <StatusPill status={visit.status} />
              {visit.code && <span className="tag mono">Code {visit.code}</span>}
            </div>
          </div>
        </div>
        <dl className="kv">
          <dt>Mobile</dt><dd>{visitor.phone}</dd>
          {visitor.email && <><dt>Email</dt><dd>{visitor.email}</dd></>}
          <dt>Purpose</dt><dd>{pass.typeLabel}{visit.purpose ? ` · ${visit.purpose}` : ""}</dd>
          <dt>To meet</dt><dd>{pass.hostName}{pass.hostDepartment ? `, ${pass.hostDepartment}` : ""}</dd>
          <dt>Gate</dt><dd>Main gate</dd>
        </dl>
        <div>
          <div className="secth" style={{ marginTop: 0 }}>Visit record</div>
          <ol className="tl">
            {passSteps(visit).map((s) => (
              <li key={s.label} className={s.done ? "on" : ""}>
                <i>{s.done && <Icon name="check" />}</i>
                <span><b>{s.label}</b><small>{fmt(s.at)}{s.by ? ` · ${s.by}` : ""}</small></span>
              </li>
            ))}
          </ol>
        </div>
        {visit.hold && (
          <p className="errmsg" style={{ margin: 0 }}><Icon name="shieldAlert" />Held at the gate: {visit.hold.reason} ({visit.hold.by})</p>
        )}
        {visit.signature && (
          <div>
            <div className="secth" style={{ marginTop: 0 }}>Agreement</div>
            <div className="pass-agree">
              <div className="small" style={{ display: "grid", gap: 4 }}>
                <span><Icon name="check" /> Visitor agreement{visit.agreementVersion ? ` v${visit.agreementVersion}` : ""}</span>
                <span className="muted">Signed {fmt(visit.checkedInAt)}</span>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <div className="sigbox"><img src={visit.signature} alt="Visitor signature" /></div>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
