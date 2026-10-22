# Visitor Sign-In (touchless)

Next.js (React + Node) prototype of **touchless sign-in** (FR-KIO-13): the visitor scans a QR code at
reception and does the whole sign-in on their own phone.

## How it works

```
Reception screen (/kiosk)            Visitor's phone
-------------------------            -----------------------------------------------
Shows a QR that changes      scan -> /s/<token>   checks the token, gives the phone a
every 30 s (signed, valid             one-time session cookie, redirects to /visit
for 90 s)                            /visit       type -> details -> host -> photo -> sign
                                     POST /api/visits  creates the visit, notifies host
"Welcome, Priya!"      <- polls --   /badge/<id>  digital badge + "Sign out" button
```

- **Why the QR rotates:** a static poster can be photographed and used to sign in from anywhere.
  A code that expires in 90 s proves the visitor is standing at reception.
- **One scan = one sign-in:** the session is consumed when the visit is created.
- **Camera:** the photo uses `<input type="file" capture="user">`, which opens the front camera
  and works over plain HTTP on the office Wi-Fi (the `getUserMedia` API would need HTTPS).
- **Returning visitors:** typing a known mobile number pre-fills name and company.

## Pre-registration (FR-PRE-01/02, FR-KIO-09)

```
Host: /pre-register  ->  invitation saved on the server  ->  invite link + QR to send to the visitor
Visitor opens link   ->  /invite/<code>  "You're expected on 15 Oct" (invite remembered on the phone)
On arrival: scans the reception QR  ->  "Welcome Ravi, Priya is expecting you"  ->  photo + sign  ->  badge
```

- Invited visitors **skip the details form and host search** — the invitation already has them.
- After the reception scan, the phone asks **"Do you have a QR invite?"**. *Yes* scans the QR from the
  invitation (email, printout, another phone) and goes straight to "Welcome Ravi". *No* opens the
  normal walk-in form. Phones that opened the invite link earlier skip the question.
- Scanning uses the live camera on HTTPS/localhost. On plain HTTP (office Wi-Fi in dev) browsers block
  live camera access, so the visitor takes a photo of the QR instead, decoded with `jsqr`.
  **Upload QR image** also accepts a screenshot from the gallery, for invites received on the same phone.
- If they never opened the link, typing their invited mobile number in the form finds today's invitation.
- An invitation works only on its visit date, only once, and only after scanning the reception QR
  (so it still proves the visitor is on site).
- `/admin` lists who is expected today and hasn't arrived.

Pre-registration started as a separate Vite app (`client/`, branch `feature/pre-registration-and-qr-codes`)
that kept invitations in the host's browser `localStorage`; it now lives here and saves to the server so
reception can recognise the visitor.

| Page | Who uses it |
|---|---|
| `/kiosk` | Tablet/TV at reception |
| `/kiosk/signout` | Reception screen: visitors sign out by name or by scanning their badge QR |
| `/visit` | Visitor's phone (after scanning) |
| `/badge/<id>?t=...` | Visitor's phone: badge and sign-out |
| `/login` | Staff: log in (sends each role to its own page) |
| `/pre-register` | Host, reception, admin: invite a visitor |
| `/invite/<code>` | Visitor's phone: their invitation |
| `/admin` | Reception, admin: who is on site, who is expected, manual sign-out |
| `/account` | Hosts: choose email, SMS or both for arrival messages |
| `/security` | Security, reception, admin: printable evacuation list of everyone on site |

## Notifications (FR-NOT-01/02/06, FR-PRE-02)

| When | Who gets it | How |
|---|---|---|
| A visitor signs in | Their host | Email, SMS or both, as the host chose on `/account`. The email has the visitor's name, company, type, phone, photo, time and location |
| A host pre-registers someone | The visitor | Email with the invite link, date, host, address and a map link. SMS with the link if no email was given |

- Messages are sent after the sign-in response, using Next.js `after()`, so the visitor never waits.
  Each provider call times out after 5 seconds (NFR-PER-02).
- Email uses SendGrid and SMS uses Twilio, called with `fetch` (`lib/channels.ts`), so no extra package is needed.
  Put the keys in `.env.local` (see `.env.example`). **Without keys, messages are printed in the terminal
  running `npm run dev`** and recorded as "logged only".
- Every attempt is saved in `notifications` in `data/db.json` with its status: sent, logged or failed (with the error).
  `/admin` shows it under the host's name, for example "Email sent · SMS failed".

## Staff login (NFR-SEC-02/03)

Based on the staff login from the Vite client (`client/src/login/`), moved to the server:
passwords are stored as scrypt hashes in `data/db.json` and checked in `/api/auth/login`, which sets an
httpOnly cookie valid for 8 hours. Every staff page and API checks the role again on each request
(`lib/auth.ts`, `ACCESS`).

| Username | Password | Role | Lands on | Can open |
|---|---|---|---|---|
| `admin` | `admin123` | Admin | `/admin` | everything |
| `reception` | `reception123` | Receptionist | `/admin` | everything |
| `host` | `host123` | Host (Priya Nair) | `/pre-register` | pre-register, only for themselves |
| `security` | `security123` | Security | `/security` | evacuation list |

These starting accounts are added to `data/db.json` the first time the app runs. Change them before
anyone else can reach the app.

## Signing out (FR-KIO-10)

A visitor can sign out in four ways. `signedOutBy` in `data/db.json` records which one was used.

| How | Where | `signedOutBy` |
|---|---|---|
| Tap **Sign out** on the badge | Visitor's phone | `badge` |
| **Signing out?** → type your name → pick it → confirm | Reception screen, `/kiosk/signout` | `kiosk` |
| **Signing out?** → **Scan my badge** → show the badge QR to the camera | Reception screen, `/kiosk/signout` | `kiosk` |
| Staff click **Sign out** | `/admin` | `portal` |
| Nobody did: signed out automatically at the end of the day | none | `auto` |

- The name search needs 2 letters and only shows "Ravi K. · visiting Priya", because the screen is in a public area.
- **Automatic sign-out:** anyone still signed in at `AUTO_SIGNOUT_TIME` (`lib/config.ts`, default `20:00`
  location time) is signed out, with the sign-out time set to 20:00. Set it to `null` to turn it off.
  The prototype has no scheduler, so the check runs whenever the reception screen, `/admin` or a badge
  loads (the reception screen asks every 30 s). In production, run `sweepAutoSignOut()` from a cron job.

## Run it

Needs Node.js 20 or newer. Run these from the `visitor_signin` folder.

```bash
cd visitor_signin
npm install
npm run dev
```

1. On the PC, open `http://localhost:3000/kiosk`.
2. Under the QR it shows the address phones will use (e.g. `http://192.168.0.111:3000`).
   The phone must be on the **same Wi-Fi** as the PC.
3. Scan with the phone camera.

If the phone can't load the page, allow Node through Windows Firewall on private networks, or set
`PUBLIC_BASE_URL` in `.env.local` (see `.env.example`) if the wrong network adapter was detected.

## Prototype shortcuts to replace before production

- `lib/db.ts` stores everything in `data/db.json`. Swap for PostgreSQL (Prisma/Drizzle).
- Notifications are sent from the web server once, with no retry. Move them to a job queue with retries.
- Staff accounts are seeded, not managed: add an employee screen (FR-ADM-04), MFA (NFR-SEC-02) and audit logging (FR-ROLE-02).
- Login has no rate limit yet; add one before going online.
- Photos and signatures are stored as data URLs. Move to S3 with encryption at rest (NFR-SEC-01).
- Set a strong `APP_SECRET` and serve over HTTPS.
- Single location and hard-coded visitor types in `lib/config.ts`; these become admin-managed tables.
