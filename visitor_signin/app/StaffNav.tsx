"use client";

// The interactive bits of the staff menu: links that know which page is open, and sign out.

import { usePathname } from "next/navigation";
import Icon from "./Icon";

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const path = usePathname();
  // "/admin" is only current on itself; deeper links like "/admin/branding" also match their sub-pages.
  const current = href === "/admin" ? path === "/admin" : path === href || path.startsWith(`${href}/`);
  return (
    <a href={href} aria-current={current ? "page" : undefined}>
      {children}
    </a>
  );
}

export function SignOutButton({ className, iconOnly }: { className: string; iconOnly?: boolean }) {
  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }
  return (
    <button type="button" className={className} onClick={signOut} aria-label="Sign out" title="Sign out">
      <Icon name="logout" />
      {!iconOnly && "Sign out"}
    </button>
  );
}
