# Architecture: layered backend on Supabase

Visitor Connect is one Next.js project, deployed as one app on Cloudflare, with its data in Supabase
(PostgreSQL). Inside the project the backend is divided into layers, and each layer into modules.

## Layers

```
Browser (pages, forms)
   │  fetch("/api/…")
   ▼
app/**/page.tsx      Pages. Show data; never touch the database directly.
app/api/**/route.ts  API routes. Check who is signed in and what was sent, call ONE service, return JSON.
   │
   ▼
lib/services/*.ts    Business rules: check-in, approvals, gate, watchlist, people, settings…
   │                 No HTTP, no SQL. Easy to test and to reuse (e.g. by a mobile API later).
   ▼
lib/repos/*.ts       Database access only (Prisma). One file per table group. No business rules.
   │
   ▼
Supabase PostgreSQL  Tables defined in prisma/schema.prisma.
```

Rules that keep the layers clean:

1. A page or route never imports `lib/repos` or Prisma; it calls a service.
2. A service never reads `Request`, cookies or headers; the route passes in plain values (who is
   signed in, what they sent).
3. A repo never decides anything (no "can this host approve?"); it only reads and writes rows.
4. Anything that changes several rows together runs in one database transaction, started by the
   service (`db.$transaction`), so a half-finished change is never saved.

## Modules

Each module owns its service, its repos and its routes. Modules can be built and tested by
different people at the same time once the shared foundation (module 0) is in place.

| # | Module | Service | Repos (tables) | Routes and pages |
|---|---|---|---|---|
| 0 | Foundation | `lib/prisma.ts` (database connection), `settings`, `audit` | Settings, Branding, AuditEntry | used by all |
| 1 | Staff and sign-in | `auth`, `people` | StaffUser, Host, LoginAttempt | `/api/auth/*`, `/api/account/*`, `/api/admin/people/*`, `/login`, `/admin/people` |
| 2 | Visitor setup | `visitorTypes`, `safety`, `branding` | VisitorType, SafetyBriefing, Branding | `/api/admin/visitor-types/*`, `/api/admin/safety`, `/api/admin/branding` |
| 3 | Check-in | `checkin`, `invitations` | Visitor, Visit, TimelineEvent, Invitation, UsedSession | `/api/visits`, `/api/invitations/*`, `/api/visitors/lookup`, `/api/hosts`, `/visit`, `/pre-register` |
| 4 | Approvals, checkout and gate | `approvals`, `gate` | Visit, TimelineEvent | `/api/staff/visits/*`, `/api/approve/*`, `/api/visits/[id]/checkout`, `/gate`, `/requests` |
| 5 | Notifications and inbox | `notify`, `inbox` | Notification, NotificationRead | `/api/staff/inbox`, `/inbox` |
| 6 | Reception and employees | `kiosk`, `employees`, `autoSignout` | EmployeeVisit, Visit | `/api/kiosk/*`, `/api/admin/onsite`, `/kiosk`, `/security` |
| 7 | Security and reports | `watchlist`, `analytics`, `retention` | WatchEntry, AuditEntry, Visit | `/api/admin/watchlist/*`, `/api/admin/reports/*`, `/admin/analytics`, `/admin/audit` |

Order: module 0 first; then 1 and 2 (others depend on staff, hosts and visitor types); then 3; then
4, 5, 6 and 7 can go in parallel.

## Moving from db.json

1. Create the tables: `npx prisma migrate dev` (from `prisma/schema.prisma`).
2. Copy the existing `data/db.json` into Supabase: `node scripts/import-json.mjs` (`--replace` to redo it).
3. Convert the modules in the order above. Until all are converted the branch doesn't run end to end.
4. Run the end-to-end test scripts against the converted app, then delete `data/db.json` handling.

## Hosting on Cloudflare (after the move)

- Next.js runs on Cloudflare Workers through the OpenNext adapter (`@opennextjs/cloudflare`).
- The app reaches Supabase through Cloudflare Hyperdrive (connection pooling), with
  `@prisma/adapter-pg`; a new Prisma client per request.
- Scheduled jobs (auto sign-out, escalations, deleting old records) move to Cloudflare Cron Triggers.
- Photos, signatures and logos move from data URLs to Supabase Storage.
- The Workers free plan allows a 3 MiB app; this app may need the Workers Paid plan.
