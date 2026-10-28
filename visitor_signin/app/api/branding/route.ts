import { NextResponse } from "next/server";
import { getBranding } from "@/lib/services/branding";

export const dynamic = "force-dynamic";

// Public: the reception screens and visitor pages show the logo and company name.
export async function GET() {
  return NextResponse.json(await getBranding());
}
