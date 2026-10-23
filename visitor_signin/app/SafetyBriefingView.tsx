// The site safety briefing as visitors see it (Visitor Connect): who to call, where to gather,
// notes, site rules with icons, and the exit plan. No hooks, so it renders on the server, in the
// phone sign-in, and as the live preview on /admin/safety.

import Icon from "./Icon";
import { RULE_KINDS } from "@/lib/safetyRules";
import type { SafetyBriefing } from "@/lib/db";

export default function SafetyBriefingView({ briefing }: { briefing: Pick<SafetyBriefing, "emergencyPhone" | "assemblyPoint" | "notes" | "rules" | "exitPlan"> }) {
  return (
    <div className="briefing">
      <div className="emerg">
        <div className="h"><Icon name="siren" />In an emergency</div>
        <div className="g">
          <div className="it">
            <i style={{ background: "var(--bad)" }}><Icon name="call" /></i>
            <span><small>Call site security</small><b className="mono">{briefing.emergencyPhone || "—"}</b></span>
          </div>
          <div className="it">
            <i style={{ background: "var(--ok)" }}><Icon name="users" /></i>
            <span><small>Assembly point</small><b>{briefing.assemblyPoint || "—"}</b></span>
          </div>
        </div>
      </div>

      {briefing.notes.filter(Boolean).length > 0 && (
        <>
          <div className="secth">Before you start</div>
          <div className="notice" style={{ display: "grid", gap: 6 }}>
            {briefing.notes.filter(Boolean).map((n, i) => (
              <div key={i} style={{ display: "flex", gap: 8 }}><Icon name="info" /><span>{n}</span></div>
            ))}
          </div>
        </>
      )}

      {briefing.rules.length > 0 && (
        <>
          <div className="secth">Site rules</div>
          <div className="rules">
            {briefing.rules.map((r, i) => {
              const k = RULE_KINDS[r.kind] ?? RULE_KINDS.info;
              return (
                <div key={i} className="rule">
                  <span className={`ri r-${k.tone}`}><Icon name={k.icon} /></span>
                  <span style={{ paddingTop: 2 }}>{r.text}</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {briefing.exitPlan && (
        <>
          <div className="secth">Emergency exit plan</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="exit-plan" src={briefing.exitPlan} alt="Emergency exit plan" />
        </>
      )}
    </div>
  );
}
