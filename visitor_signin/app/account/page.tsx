import StaffBar from "../StaffBar";
import { ACCESS, requireStaffPage, ROLE_LABELS } from "@/lib/auth";
import { read } from "@/lib/db";
import NotificationSettings from "./NotificationSettings";

export const dynamic = "force-dynamic";

// The logged-in employee's own settings: how they hear about their visitors (FR-NOT-06).
export default async function AccountPage() {
  const staff = await requireStaffPage(ACCESS.account, "/account");
  const host = staff.hostId ? read((d) => d.hosts.find((h) => h.id === staff.hostId)) : undefined;

  return (
    <>
      <StaffBar name={staff.name} role={staff.role} roleLabel={ROLE_LABELS[staff.role]} isHost={!!staff.hostId} />
      <main className="phone">
        <div className="card stack">
          <h1>My notifications</h1>
          {host ? (
            <NotificationSettings email={host.email} phone={host.phone} notifyBy={host.notifyBy?.length ? host.notifyBy : ["email"]} />
          ) : (
            <p className="muted">Your account isn&apos;t linked to a host, so visitors can&apos;t choose you and you won&apos;t get arrival messages.</p>
          )}
        </div>
      </main>
    </>
  );
}
