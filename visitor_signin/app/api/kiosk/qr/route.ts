import QRCode from "qrcode";
import { NextResponse } from "next/server";
import { publicBaseUrl } from "@/lib/baseUrl";
import { LOCATION, QR_ROTATE_SECONDS, QR_TTL_SECONDS } from "@/lib/config";
import { makeToken } from "@/lib/token";

export const dynamic = "force-dynamic";

// Called by the reception display every QR_ROTATE_SECONDS for a fresh code.
export async function GET() {
  const token = makeToken("qr", QR_TTL_SECONDS, LOCATION.id);
  const url = `${publicBaseUrl()}/s/${token}`;
  const qr = await QRCode.toDataURL(url, { margin: 1, width: 600, errorCorrectionLevel: "M" });
  return NextResponse.json({ qr, url, baseUrl: publicBaseUrl(), refreshInSeconds: QR_ROTATE_SECONDS });
}
