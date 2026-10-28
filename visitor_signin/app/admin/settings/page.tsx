import StaffShell from "../../StaffShell";
import Icon, { type IconName } from "../../Icon";
import { ACCESS, requireStaffPage } from "@/lib/auth";
import { getSettings } from "@/lib/services/settings";
import SettingsForm from "./SettingsForm";

export const dynamic = "force-dynamic";

const MORE: { href: string; icon: IconName; title: string; text: string }[] = [
  { href: "/admin/people", icon: "users", title: "People", text: "Hosts, reception, security and admins" },
  { href: "/admin/visitor-types", icon: "list", title: "Visitor types", text: "Purposes of visit, their questions, photo and agreement" },
  { href: "/admin/safety", icon: "shieldCheck", title: "Safety briefing", text: "Emergency number, assembly point, rules" },
  { href: "/admin/branding", icon: "sparkle", title: "Branding", text: "Logo, colour, company name, welcome message" },
  { href: "/admin/watchlist", icon: "shieldAlert", title: "Watchlist", text: "People held for an admin at check-in" },
  { href: "/kiosk", icon: "qr", title: "Reception screen", text: "The QR code visitors scan to check in" },
];

// Site settings (Visitor Connect): timings and privacy here, with links to the other admin pages.
export default async function SettingsPage() {
  const staff = await requireStaffPage(ACCESS.settings, "/admin/settings");
  return (
    <StaffShell staff={staff}>
      <main className="admin">
        <div className="ph-h">
          <div>
            <h2>Settings</h2>
            <p>Timings and privacy for this site</p>
          </div>
        </div>
        <div className="cols two">
          <SettingsForm initial={await getSettings()} />
          <section className="panel">
            <div className="panel-h"><h3>More settings</h3></div>
            {MORE.map((m) => (
              <a key={m.href} href={m.href} className="prow" style={{ textDecoration: "none", color: "inherit" }}>
                <span className="ti" style={{ width: 38, height: 38, borderRadius: 12, display: "grid", placeItems: "center", background: "var(--gold-soft)", color: "var(--primary)", flex: "none" }}><Icon name={m.icon} /></span>
                <span className="main"><b>{m.title}</b><small>{m.text}</small></span>
                <Icon name="chev" />
              </a>
            ))}
          </section>
        </div>
      </main>
    </StaffShell>
  );
}
