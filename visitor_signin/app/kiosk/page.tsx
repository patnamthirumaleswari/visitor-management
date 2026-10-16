"use client";

import { useEffect, useState } from "react";
import { LOCATION } from "@/lib/config";

type QrResponse = { qr: string; url: string; baseUrl: string; refreshInSeconds: number };

export default function KioskDisplay() {
  const [qr, setQr] = useState<QrResponse | null>(null);
  const [error, setError] = useState(false);
  const [welcome, setWelcome] = useState<string | null>(null);

  // Rotate the QR so a photo of it can't be used to sign in from elsewhere.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const res = await fetch("/api/kiosk/qr", { cache: "no-store" });
        const data: QrResponse = await res.json();
        setQr(data);
        setError(false);
        timer = setTimeout(load, data.refreshInSeconds * 1000);
      } catch {
        setError(true);
        timer = setTimeout(load, 5000);
      }
    };
    load();
    return () => clearTimeout(timer);
  }, []);

  // Greet visitors as they finish signing in on their phones.
  useEffect(() => {
    const seen = new Set<string>();
    const poll = setInterval(async () => {
      try {
        const res = await fetch("/api/kiosk/recent", { cache: "no-store" });
        const { arrivals } = (await res.json()) as { arrivals: { id: string; firstName: string }[] };
        const fresh = arrivals.find((a) => !seen.has(a.id));
        arrivals.forEach((a) => seen.add(a.id));
        if (fresh) {
          setWelcome(`Welcome, ${fresh.firstName}! Your host has been notified.`);
          setTimeout(() => setWelcome(null), 6000);
        }
      } catch {
        /* display keeps working without greetings */
      }
    }, 3000);
    return () => clearInterval(poll);
  }, []);

  return (
    <main className="kiosk">
      <div>
        <p className="muted" style={{ fontSize: "1.2rem" }}>{LOCATION.company}</p>
        <h1>{LOCATION.welcomeText}</h1>
        <p className="muted">Open your phone camera and point it at the code.</p>
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="qr" src={qr.qr} alt="Scan this QR code with your phone camera to sign in" />
        ) : (
          <div className="qr" />
        )}
        {error && <p className="error">Can't reach the server — retrying…</p>}
        {qr && <p className="muted small">Phones connect to {qr.baseUrl} · code refreshes every {qr.refreshInSeconds}s</p>}
      </div>
      {welcome && <div className="welcome" role="status">{welcome}</div>}
    </main>
  );
}
