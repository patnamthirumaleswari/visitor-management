import { getBranding } from "@/lib/branding";
import KioskDisplay from "./KioskDisplay";

export const dynamic = "force-dynamic";

// Reception display (FR-KIO-13), with the company logo and welcome text (FR-KIO-03).
export default function KioskPage() {
  return <KioskDisplay branding={getBranding()} />;
}
