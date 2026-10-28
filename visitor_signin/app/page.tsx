import Icon from "./Icon";
import Logo from "./Logo";
import { isOnSite } from "@/lib/approvals";
import { getBranding } from "@/lib/services/branding";
import { LOCATION } from "@/lib/config";
import { todayAtLocation } from "@/lib/dates";
import { read } from "@/lib/db";

export const dynamic = "force-dynamic";

// Landing page (Visitor Connect design): what the app is, live numbers, and the way in for
// visitors (the reception screen) and for each kind of staff.
export default async function Home() {
  const brand = await getBranding();
  const today = todayAtLocation();
  const dayOf = (iso?: string) =>
    iso ? new Intl.DateTimeFormat("en-CA", { timeZone: LOCATION.timezone }).format(new Date(iso)) : "";

  const stats = read((d) => ({
    onSite: d.visits.filter(isOnSite).length,
    today: d.visits.filter((v) => dayOf(v.signedInAt) === today).length,
    expected: d.visits.filter((v) => v.status === "expected" && v.expectedDate === today).length,
  }));

  const roles = [
    { href: "/login?role=host", icon: "users" as const, label: "Employee", hint: "Hosts: approve your visitors" },
    { href: "/login?role=security", icon: "door" as const, label: "Security", hint: "Release at the gate" },
    { href: "/login?role=admin", icon: "shield" as const, label: "Admin", hint: "Reports and settings" },
  ];

  return (
    <main className="landing">
      <div className="land-in">
        <div className="land-copy">
          <Logo logo={brand.logo} companyName={brand.companyName} color={brand.primaryColor} textColor={brand.primaryText} size={76} />
          <div><span className="eyebrow"><i />{brand.companyName}</span></div>
          <h1>{brand.companyName.split(" ")[0]}<br /><span>Visitor Connect</span></h1>
          <p className="lead">
            Visitor check-in, host alerts and a live list of who is on site at {LOCATION.name}. Visitors use their own
            phone; hosts hear the moment they arrive.
          </p>
          <div className="stats">
            <div><b>{stats.onSite}</b><small>On site now</small></div>
            <div><b>{stats.today}</b><small>Visitors today</small></div>
            <div><b>{stats.expected}</b><small>Expected today</small></div>
          </div>
        </div>

        <div className="land-card">
          <a className="btn primary lg full" href="/kiosk"><Icon name="qr" />Visitor check-in</a>
          <p className="hint">Visitors scan the QR code on the reception screen with their phone camera.</p>
          <a className="btn line full" href="/kiosk/staff"><Icon name="clock" />Staff attendance at reception (clock in / out)</a>
          <div className="or">Staff sign in</div>
          <div className="rolegrid">
            {roles.map((r) => (
              <a key={r.label} className="rolebtn" href={r.href}>
                <span className="ri"><Icon name={r.icon} /></span>
                {r.label}
                <small>{r.hint}</small>
              </a>
            ))}
          </div>
        </div>
      </div>
      <p className="land-foot">{brand.companyName} · Visitor Connect</p>
    </main>
  );
}
