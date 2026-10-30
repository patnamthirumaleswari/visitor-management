import StaffShell from "../../StaffShell";
import { ACCESS, requireStaffPage } from "@/lib/auth";
import { DEFAULT_BRANDING } from "@/lib/branding";
import { getBranding } from "@/lib/services/branding";
import BrandingForm from "./BrandingForm";

export const dynamic = "force-dynamic";

// Company branding: logo, colour, company name, reception welcome text (FR-ADM-06, FR-KIO-03).
// Admins only (NFR-SEC-03).
export default async function BrandingPage() {
  const staff = await requireStaffPage(ACCESS.branding, "/admin/branding");
  return (
    <StaffShell staff={staff}>
      <BrandingForm initial={await getBranding()} defaults={DEFAULT_BRANDING} />
    </StaffShell>
  );
}
