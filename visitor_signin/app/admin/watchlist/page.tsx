import StaffShell from "../../StaffShell";
import { ACCESS, requireStaffPage } from "@/lib/auth";
import { read } from "@/lib/db";
import WatchlistManager from "./WatchlistManager";

export const dynamic = "force-dynamic";

// Watchlist (FR-SEC-01..03): people held for an admin when they check in. Admins only.
export default async function WatchlistPage() {
  const staff = await requireStaffPage(ACCESS.watchlist, "/admin/watchlist");
  return (
    <StaffShell staff={staff}>
      <WatchlistManager initial={read((d) => d.watchlist ?? [])} />
    </StaffShell>
  );
}
