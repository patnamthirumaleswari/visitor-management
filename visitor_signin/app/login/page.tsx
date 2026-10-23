import { redirect } from "next/navigation";
import { getStaff, homeFor } from "@/lib/auth";
import { getBranding } from "@/lib/branding";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

const TITLES: Record<string, string> = { host: "Employee (host) sign in", security: "Security sign in", admin: "Admin sign in" };

// Starting accounts from lib/db.ts, shown as tap-to-fill chips while developing only (never in production).
const DEV_ACCOUNTS: Record<string, Array<[string, string]>> = {
  host: [["host", "Priya · host"]],
  security: [["security", "Security officer"]],
  admin: [["admin", "Admin"], ["reception", "Reception"]],
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; role?: string }> }) {
  const { next, role } = await searchParams;
  const staff = await getStaff();
  if (staff) redirect(homeFor(staff.role)); // already logged in

  const brand = getBranding();
  const key = role && TITLES[role] ? role : "";
  const devAccounts = process.env.NODE_ENV === "production" ? [] : key ? DEV_ACCOUNTS[key] : Object.values(DEV_ACCOUNTS).flat();

  return (
    <LoginForm
      next={next ?? ""}
      title={TITLES[key] ?? "Staff sign in"}
      brand={{ logo: brand.logo, companyName: brand.companyName, color: brand.primaryColor, textColor: brand.primaryText }}
      devAccounts={devAccounts}
    />
  );
}
