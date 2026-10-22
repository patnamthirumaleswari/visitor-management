// Frame around every staff page (Visitor Connect design): a glass sidebar on desktop, and a top bar
// with a bottom menu on phones. Server component; the links and sign-out button are small client parts.

import Logo from "./Logo";
import { NavLink, SignOutButton } from "./StaffNav";
import type { IconName } from "./Icon";
import Icon from "./Icon";
import { ROLE_LABELS, type Staff } from "@/lib/auth";
import { getBranding } from "@/lib/branding";
import { LOCATION } from "@/lib/config";
import type { StaffRole } from "@/lib/db";

type NavItem = { href: string; label: string; short: string; icon: IconName; roles: StaffRole[]; hostOnly?: boolean };

const NAV: NavItem[] = [
  { href: "/admin", label: "Home", short: "Home", icon: "home", roles: ["admin", "receptionist"] },
  { href: "/pre-register", label: "Pre-register", short: "Invite", icon: "send", roles: ["admin", "receptionist", "host"] },
  { href: "/security", label: "Evacuation list", short: "Evacuation", icon: "siren", roles: ["admin", "receptionist", "security"] },
  { href: "/admin/visitor-types", label: "Visitor types", short: "Types", icon: "list", roles: ["admin"] },
  { href: "/admin/branding", label: "Branding", short: "Branding", icon: "settings", roles: ["admin"] },
  { href: "/account", label: "My account", short: "Account", icon: "user", roles: ["admin", "receptionist", "host", "security"], hostOnly: true },
];

export default function StaffShell({ staff, children }: { staff: Staff; children: React.ReactNode }) {
  const brand = getBranding();
  const nav = NAV.filter((n) => n.roles.includes(staff.role) && (!n.hostOnly || !!staff.hostId));
  const initials = staff.name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");

  return (
    <div className="shell">
      <aside className="side" aria-label="Staff menu">
        <a className="side-brand" href={nav[0]?.href ?? "/"}>
          <Logo logo={brand.logo} companyName={brand.companyName} color={brand.primaryColor} textColor={brand.primaryText} size={40} />
          <span>
            <b>{brand.companyName}</b>
            <span className="muted small" style={{ fontWeight: 600 }}>Visitor Connect</span>
          </span>
        </a>
        <div className="locsw">
          <span className="lic"><Icon name="pin" /></span>
          <span style={{ flex: 1, minWidth: 0 }}><small>Location</small><b>{LOCATION.name}</b></span>
        </div>
        <nav className="navlist">
          {nav.map((n) => (
            <NavLink key={n.href} href={n.href}><Icon name={n.icon} />{n.label}</NavLink>
          ))}
        </nav>
        <div className="me">
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span className="avatar" style={{ width: 38, height: 38, fontSize: 14 }}>{initials}</span>
            <div style={{ minWidth: 0 }}>
              <b>{staff.name}</b>
              <span className="muted">{ROLE_LABELS[staff.role]}</span>
            </div>
          </div>
          <SignOutButton className="btn line sm full" />
        </div>
      </aside>

      <div style={{ minWidth: 0 }}>
        <header className="topbar glass">
          <Logo logo={brand.logo} companyName={brand.companyName} color={brand.primaryColor} textColor={brand.primaryText} size={32} />
          <b>Visitor Connect</b>
          <span className="locpill"><Icon name="pin" />{LOCATION.name}</span>
          <SignOutButton className="btn ghost sm" iconOnly />
        </header>
        <div className="content">
          <div className="s-main fadein">{children}</div>
        </div>
        {nav.length > 1 && (
          <nav className="bottomnav" aria-label="Staff menu">
            {nav.slice(0, 5).map((n) => (
              <NavLink key={n.href} href={n.href}><Icon name={n.icon} /><span>{n.short}</span></NavLink>
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}
