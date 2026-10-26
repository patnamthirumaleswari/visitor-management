import StaffShell from "../StaffShell";
import { ACCESS, requireStaffPage } from "@/lib/auth";
import InboxList from "./InboxList";

export const dynamic = "force-dynamic";

// Inbox: approval requests and alerts sent to you. Hosts, reception and admins.
export default async function InboxPage() {
  const staff = await requireStaffPage(ACCESS.inbox, "/inbox");
  return (
    <StaffShell staff={staff}>
      <InboxList />
    </StaffShell>
  );
}
