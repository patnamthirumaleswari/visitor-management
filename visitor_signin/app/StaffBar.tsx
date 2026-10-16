"use client";

// Top bar on staff pages: who is logged in, links for their role, and log out.

import type { StaffRole } from "@/lib/db";

type Props = { name: string; role: StaffRole; roleLabel: string; isHost?: boolean };

const LINKS: Array<{ href: string; label: string; roles: StaffRole[] }> = [
  { href: "/admin", label: "On site", roles: ["admin", "receptionist"] },
  { href: "/pre-register", label: "Pre-register", roles: ["admin", "receptionist", "host"] },
  { href: "/security", label: "Evacuation list", roles: ["admin", "receptionist", "security"] },
];

export default function StaffBar({ name, role, roleLabel, isHost }: Props) {
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <nav className="staffbar">
      <div className="staffbar-links">
        {LINKS.filter((l) => l.roles.includes(role)).map((l) => (
          <a key={l.href} href={l.href}>{l.label}</a>
        ))}
        {isHost && <a href="/account">My notifications</a>}
      </div>
      <div className="staffbar-user">
        <span><strong>{name}</strong> <span className="muted small">· {roleLabel}</span></span>
        <button className="secondary" onClick={logout}>Log out</button>
      </div>
    </nav>
  );
}
