import QRCode from "qrcode";
import StaffBar from "../StaffBar";
import { ACCESS, requireStaffPage, ROLE_LABELS } from "@/lib/auth";
import { EMPLOYEE_QR_PREFIX, LOCATION } from "@/lib/config";
import { read } from "@/lib/db";
import { openEmployeeVisit } from "@/lib/employees";
import NotificationSettings from "./NotificationSettings";
import ReceptionSignIn from "./ReceptionSignIn";

export const dynamic = "force-dynamic";

// The logged-in employee's own settings: how they hear about their visitors (FR-NOT-06),
// and their PIN and personal QR for signing in at reception (FR-EMP-01).
export default async function AccountPage() {
  const staff = await requireStaffPage(ACCESS.account, "/account");
  const found = staff.hostId
    ? read((d) => {
        const host = d.hosts.find((h) => h.id === staff.hostId);
        return host ? { host, open: openEmployeeVisit(d, host.id) } : undefined;
      })
    : undefined;

  const bar = <StaffBar name={staff.name} role={staff.role} roleLabel={ROLE_LABELS[staff.role]} isHost={!!staff.hostId} />;

  if (!found) {
    return (
      <>
        {bar}
        <main className="phone">
          <div className="card stack">
            <h1>My account</h1>
            <p className="muted">
              Your account isn&apos;t linked to an employee record, so visitors can&apos;t choose you and you can&apos;t sign
              in at reception.
            </p>
          </div>
        </main>
      </>
    );
  }

  const { host, open } = found;
  const qr = host.qrToken
    ? await QRCode.toDataURL(EMPLOYEE_QR_PREFIX + host.qrToken, { margin: 1, width: 400, errorCorrectionLevel: "M" })
    : null;
  const signedInSince = open
    ? new Date(open.signedInAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: LOCATION.timezone })
    : null;

  return (
    <>
      {bar}
      <main className="phone stack">
        <div className="card stack">
          <h1>Signing in at reception</h1>
          <p className={signedInSince ? "notice" : "muted"} style={{ margin: 0 }}>
            {signedInSince ? `You're signed in at ${LOCATION.name} since ${signedInSince}.` : "You're not signed in right now."}
          </p>
          <ReceptionSignIn qr={qr} />
        </div>

        <div className="card stack">
          <h2>My notifications</h2>
          <NotificationSettings email={host.email} phone={host.phone} notifyBy={host.notifyBy?.length ? host.notifyBy : ["email"]} />
        </div>
      </main>
    </>
  );
}
