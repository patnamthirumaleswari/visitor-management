"use client";

// The actions that fit a visit right now, on the visitor details page.

import { useRouter } from "next/navigation";
import { useState } from "react";
import ClearHoldButton from "../../ClearHoldButton";
import DecisionButtons from "../../DecisionButtons";
import Icon from "../../Icon";
import ReapproveButton from "../../ReapproveButton";

type Props = {
  visitId: string;
  status: string;
  canDecide: boolean;
  reapprovable: boolean;
  reapproveNote: string | null; // why "approve after all" isn't possible, for a denied visit
  canClearHold: boolean;
  canSignOut: boolean; // staff can end the visit (on site or still waiting)
};

export default function VisitActions({ visitId, status, canDecide, reapprovable, reapproveNote, canClearHold, canSignOut }: Props) {
  const router = useRouter();
  const refresh = () => router.refresh();
  const [signingOut, setSigningOut] = useState(false);
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    await fetch(`/api/admin/visits/${visitId}/signout`, { method: "POST" });
    setBusy(false);
    setSigningOut(false);
    refresh();
  }


  return (
    <div className="stack">
      {status === "review" && canDecide && <DecisionButtons endpoint={`/api/staff/visits/${visitId}/decide`} onDone={refresh} />}
      {status === "pending" && canDecide && <DecisionButtons endpoint={`/api/staff/visits/${visitId}/decide`} onDone={refresh} />}
      {status === "checkout" && canDecide && (
        <DecisionButtons endpoint={`/api/staff/visits/${visitId}/decide`} onDone={refresh}
          labels={{ approve: "Approve checkout", deny: "Not yet", confirmDeny: "Keep them on site", notePlaceholder: "Note for the visitor (optional)" }} />
      )}
      {status === "denied" && (reapprovable
        ? <ReapproveButton visitId={visitId} onDone={refresh} />
        : reapproveNote && <p className="muted small" style={{ margin: 0 }}>{reapproveNote}</p>)}
      {status === "hold" && canClearHold && <ClearHoldButton visitId={visitId} onDone={refresh} />}
      {canSignOut && (signingOut ? (
        <div className="decide-row">
          <button type="button" className="btn sm danger" onClick={signOut} disabled={busy}><Icon name="logout" />Yes, sign them out now</button>
          <button type="button" className="btn sm line" onClick={() => setSigningOut(false)} disabled={busy}>Back</button>
        </div>
      ) : (
        <div className="decide-row">
          <button type="button" className="btn sm line" onClick={() => setSigningOut(true)}><Icon name="logout" />Sign out</button>
        </div>
      ))}
    </div>
  );
}
