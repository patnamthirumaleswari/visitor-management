import StaffShell from "../../StaffShell";
import { ACCESS, CHANGE_PASSWORD_PATH, homeFor, requireStaffPage } from "@/lib/auth";
import PasswordForm from "./PasswordForm";

export const dynamic = "force-dynamic";

// Change your own password. Staff given a temporary password by an admin land here first.
export default async function PasswordPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const staff = await requireStaffPage(ACCESS.account, CHANGE_PASSWORD_PATH);
  const asked = (await searchParams).next;
  // Only go on to a page on this site afterwards.
  const next = asked && /^\/(?![/\\])/.test(asked) && !asked.startsWith(CHANGE_PASSWORD_PATH) ? asked : homeFor(staff.role);
  return (
    <StaffShell staff={staff}>
      <main className="phone">
        <PasswordForm temporary={!!staff.mustChangePassword} next={next} />
      </main>
    </StaffShell>
  );
}
