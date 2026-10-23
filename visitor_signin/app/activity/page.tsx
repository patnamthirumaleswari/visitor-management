import StaffShell from "../StaffShell";
import { ACCESS, requireStaffPage } from "@/lib/auth";
import ActivityFeed from "./ActivityFeed";

export const dynamic = "force-dynamic";

// Activity tracker for hosts (their own visitors) and for admins and reception (everyone's).
export default async function ActivityPage() {
  const staff = await requireStaffPage(ACCESS.decide, "/activity");
  return (
    <StaffShell staff={staff}>
      <ActivityFeed allVisitors={staff.role !== "host"} />
    </StaffShell>
  );
}
