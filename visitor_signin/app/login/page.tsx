import { redirect } from "next/navigation";
import { getStaff, homeFor } from "@/lib/auth";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const staff = await getStaff();
  if (staff) redirect(homeFor(staff.role)); // already logged in

  return <LoginForm next={next ?? ""} />;
}
