import { NextResponse } from "next/server";
import { audit } from "@/lib/services/audit";
import { ACCESS, requireStaffApi } from "@/lib/auth";
import { isHexColor } from "@/lib/branding";
import { saveBranding } from "@/lib/services/branding";

export const dynamic = "force-dynamic";

// The page resizes logos to at most 400 px before uploading, so they are ~20-80 KB.
const MAX_LOGO_CHARS = 400_000;

type Body = { companyName?: unknown; welcomeText?: unknown; primaryColor?: unknown; logo?: unknown };

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// Admin saves the company branding (FR-ADM-06). Admins only (NFR-SEC-03).
export async function PUT(req: Request) {
  const staff = await requireStaffApi(ACCESS.branding);
  if (staff instanceof NextResponse) return staff;

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const companyName = clean(body.companyName, 60);
  const welcomeText = clean(body.welcomeText, 120);
  if (companyName.length < 2) return bad("Enter the company name.");
  if (welcomeText.length < 2) return bad("Enter the welcome text.");
  if (!isHexColor(body.primaryColor)) return bad("Choose a colour.");

  // null = remove the logo; a string = new logo; undefined = keep the current one.
  let logo: string | null | undefined;
  if (body.logo === null) logo = null;
  else if (typeof body.logo === "string") {
    // PNG, JPEG or WebP only. SVG can carry scripts, so it isn't accepted.
    if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(body.logo)) return bad("The logo must be a PNG, JPG or WebP image.");
    if (body.logo.length > MAX_LOGO_CHARS) return bad("The logo is too large. Use an image under 300 KB.");
    logo = body.logo;
  }

  const saved = await saveBranding({ companyName, welcomeText, primaryColor: body.primaryColor as string, logo });
  await audit(req, staff, "Branding changed", `${companyName}${logo === null ? " · logo removed" : logo ? " · new logo" : ""}`);
  return NextResponse.json(saved);
}

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}
