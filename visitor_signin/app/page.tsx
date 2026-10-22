import Link from "next/link";

export default function Home() {
  return (
    <main className="phone stack">
      <h1>Visitor Management</h1>
      <p className="muted">Prototype: touchless sign-in (FR-KIO-13) and pre-registration (FR-PRE-01/02, FR-KIO-09).</p>
      <Link className="button" href="/kiosk">Reception display (shows the QR)</Link>
      <Link className="button secondary" href="/kiosk/staff">Employee sign in / out (reception screen)</Link>
      <Link className="button secondary" href="/login">Staff login (admin, reception, host, security)</Link>
    </main>
  );
}
