import StaffBar from "../../StaffBar";
import { ACCESS, requireStaffPage, ROLE_LABELS } from "@/lib/auth";
import { DEFAULT_BRANDING, getBranding } from "@/lib/branding";
import BrandingForm from "./BrandingForm";

export const dynamic = "force-dynamic";

// Company branding: logo, colour, company name, reception welcome text (FR-ADM-06, FR-KIO-03).
// Admins only (NFR-SEC-03).
export default async function BrandingPage() {
  const staff = await requireStaffPage(ACCESS.branding, "/admin/branding");
  return (
    <>
      <StaffBar name={staff.name} role={staff.role} roleLabel={ROLE_LABELS[staff.role]} isHost={!!staff.hostId} />
      <BrandingForm initial={getBranding()} defaults={DEFAULT_BRANDING} />
    </>
  );
}
