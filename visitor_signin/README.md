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
| `/admin` | Reception, admin: who is on site, who is expected, manual sign-out, print badge |
| `/admin/badge/<id>` | Reception, admin: printable badge (62 × 100 mm label) |
| `/admin/branding` | Admin: logo, main colour, company name, reception welcome text |
| `/admin/visitor-types` | Admin: visitor types, the fields and questions each asks, photo on/off |
| `/kiosk/staff` | Reception screen: employees sign in/out with name + PIN or their personal QR |
| `/account` | Employees: personal sign-in QR, change PIN, choose email/SMS for arrival messages |
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

## Employee sign-in at reception (FR-EMP-01)

```
Reception screen (/kiosk)  ->  "Employee? Sign in or out here"  ->  /kiosk/staff
   type your name -> pick it -> type your PIN        (or)        show your personal QR to the camera
   -> "Welcome, Anita. You signed in at 09:02"   /   the same steps later: "Goodbye, Anita"
```

- The same steps sign you in or out: if you're in, it signs you out.
- **PIN:** every employee starts with PIN `1234`. Change it on `/account` (4 to 6 digits; easy ones like
  `1234` or `0000` are refused). PINs are stored hashed. Five wrong PINs in a row lock the PIN for 5 minutes.
- **Personal QR:** shown on `/account`. Screenshot or print it. "Make a new QR code" replaces it and the old
  one stops working. Scanning it again within 60 seconds doesn't sign you straight back out.
- The name search only returns name and department, because the screen is in a public area.
- `/admin` lists employees on site and can sign them out. `/security` includes them on the evacuation list.
- To log in to `/account` an employee needs a staff account linked to their record. Only Priya Nair
  (`host` / `host123`) has one so far; the employee list (FR-ADM-04) will add the rest.

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
- **Automatic sign-out:** anyone still signed in, visitors and employees, at `AUTO_SIGNOUT_TIME` (`lib/config.ts`, default `20:00`
  location time) is signed out, with the sign-out time set to 20:00. Set it to `null` to turn it off.
  The prototype has no scheduler, so the check runs whenever the reception screen, `/admin` or a badge
  loads (the reception screen asks every 30 s). In production, run `sweepAutoSignOut()` from a cron job.

## Branding and badges (FR-KIO-03, FR-BAD-02, FR-ADM-06)

- **`/admin/branding`** (admins only): company name, welcome text, main colour and logo, with a live preview.
  The logo is shrunk to 400 px in the browser and saved as PNG; PNG, JPG and WebP are accepted, SVG isn't
  (it can contain scripts). Without a logo, the company initials are shown in the main colour.
- The settings are stored as `branding` in `data/db.json` (`lib/branding.ts` has the defaults) and used by:
  the reception screen (logo + welcome text), the employee and sign-out screens, the badge, the invitation
  page, invitation emails, and the colour of buttons and links on every page. Button text switches between
  white and dark automatically so it stays readable on any colour.
- **Badge** (`app/badge/BadgeCard.tsx`): brand-colour header with logo and company, photo (or initials),
  name, company, host, a band in the visitor type's colour, the date it's valid, and the QR code that the
  reception screen scans for sign-out. The same design is used on the visitor's phone and for printing.
- **Printing:** `/admin` → **Print badge** opens `/admin/badge/<id>`. It prints one badge on a 62 × 100 mm page,
  the size of a Brother QL 62 mm label (FR-BAD-01 will add direct printing). On a normal printer it prints
  at the top of an A4 sheet.

## Visitor types (FR-KIO-04/05/07)

Admins manage them on **`/admin/visitor-types`**. They're stored as `visitorTypes` in `data/db.json`;
the first time the app runs it copies in Guest, Contractor, Interview and Delivery (`lib/config.ts`).

For each type an admin chooses:

| Setting | What it changes at sign-in |
|---|---|
| Name, description, colour | The choice on "What brings you in?"; the colour band on the badge and in staff lists |
| Take a photo (FR-KIO-07) | Adds or skips the photo step |
| Sign the visitor agreement | Adds or skips the agreement step |
| Company / Email / Purpose: Don't ask, Optional, Required (FR-KIO-05) | Which details are asked. Name and mobile number are always asked |
| Extra questions: text, dropdown, yes/no, date (FR-KIO-05) | A "A few questions" step after choosing the host (or after "Welcome" for invited visitors) |
| Offer this type at sign-in | Untick to hide a type; past visits keep its name and colour |

- Answers are saved on the visit with the question's wording at that moment, so editing a question later
  doesn't change past records. They're shown on `/admin` under the visitor type and in the host's arrival email.
- A type that has been used can't be deleted, only hidden. At least one type always stays available.
- `lib/visitorTypes.ts` checks answers (required, dropdown option, yes/no, date) and what admins save.

## Host approval (Visitor Connect)

```
Visitor checks in on their phone  ->  "Waiting for approval" (visitor no. 105 · code 4821, refreshes by itself)
Host gets email/SMS with an Approve / Deny link, and sees it under Home -> "Needs your answer"
Approve -> phone shows "You are approved" + badge        Deny (+ optional note) -> "Entry not approved"
No answer in 5 min -> marked Escalated, reception told (RECEPTION_EMAIL), admins/reception can answer
```

- Walk-ins wait for approval. **Invited visitors go straight in** (the host already invited them), and so do
  visitor types with **"Host approves entry"** switched off on `/admin/visitor-types` (Delivery by default).
- Every visit gets a **visitor number** (101, 102, …) and a **4-digit visit code**. **"Find my visit"** (`/find`)
  reopens the visit screen with the code and mobile number; wrong tries are limited.
- Hosts land on **`/requests`** (Home): waiting visitors with Approve / Deny, and today's visitors. `/admin` shows
  the same waiting list to admins and reception.
- The email link (`/approve/<token>`) works without signing in for 24 hours, only for that visit and host.
- One open visit per mobile number. Unanswered requests are closed by the 8 pm automatic sign-out.
- Visitors waiting at reception are on the evacuation list (`/security`).
- Logic lives in `lib/approvals.ts` (statuses, numbers, who can decide, escalation) and `lib/requests.ts`.
- `npm run dev` now also works from the repository root (root `package.json` forwards to `visitor_signin`).

## Design (InternFactory Visitor Connect)

The look follows the InternFactory Visitor Connect design: frosted-glass panels over a soft indigo / sky /
violet background, Plus Jakarta Sans and JetBrains Mono fonts, and line icons.

- `app/globals.css`: Part 1 holds the design's colour tokens and components (`.btn`, `.panel`, `.tile`,
  `.vrow`, `.pill`, …), Part 2 restyles the existing pages, Part 3 holds feature styles.
- `app/Icon.tsx`: the design's icon set (`<Icon name="door" />`).
- `app/StaffShell.tsx`: frame for staff pages: sidebar on desktop, top bar and bottom menu on phones.
- `/`: landing page with live numbers, visitor check-in and Employee / Security / Admin sign-in.
- The brand colour from `/admin/branding` drives the gradient on buttons and highlights.
- Light theme only for now.

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
