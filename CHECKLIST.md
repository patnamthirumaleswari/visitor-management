# Project checklist

Everything to build, from the requirements document (v1.1).
Tick an item by changing `[ ]` to `[x]`, then commit.

- **YOU** build what **visitors** see
- **FRIEND** builds what **staff** (admin, receptionist, host) see
- **TOGETHER** = shared setup that both tracks need

The code in brackets, like `KIO-10`, is the requirement ID in the PDF, if you want the details.

---

## Phase 1: first release (MVP)

### 🤝 TOGETHER: do these first

- [ ] Commit the combined pre-registration and remove the old `client/` folder
- [ ] Merge `Visitor_Sign-In_Kiosk` into `main` (first pull request)
- [ ] Replace the JSON file with a real database (PostgreSQL + Prisma)
- [ ] Choose a login library (for example Auth.js)
- [ ] Store photos, signatures and PDFs in file storage, not inside the database (`NFR-SEC-01`)
- [ ] Show a privacy notice before visitors type their details (`NFR-PRV-03`)
- [ ] Delete old visitor records automatically after 30/90/365 days (`NFR-PRV-02`)

---

### 👤 YOU: visitor side

**Signing in**
- [x] Visitor scans a QR at reception and signs in on their own phone (`KIO-13`)
- [x] Search for the host by name (`KIO-06`)
- [x] Take a photo with the phone camera (`KIO-07`)
- [x] Returning visitor: name and company fill in automatically (`KIO-08`)
- [x] Invited visitor skips the form (`KIO-09`)
- [ ] Reception screen shows the company logo and welcome text (`KIO-03`)
- [ ] Visitor types (Guest, Contractor…) come from the database; admin can add new ones (`KIO-04`)
- [ ] Each visitor type has its own questions: text, dropdown, yes/no, date (`KIO-05`)
- [ ] Photo can be switched on/off per visitor type (`KIO-07`)
- [ ] Reception tablet can scan an invitation QR with its camera (`KIO-09`)
- [ ] Connect a reception tablet to a location with a one-time code (`KIO-02`)
- [ ] Reception tablet runs locked, so visitors can't leave the app (`KIO-01`)

**Signing out**
- [x] Sign out from the badge on the phone
- [ ] Sign out by searching your name at reception (`KIO-10`)
- [ ] Sign out by scanning the badge QR (`KIO-10`)
- [ ] Everyone still signed in is signed out automatically at a set time (`KIO-10`)

**Agreements (NDA, safety rules)**
- [x] Visitor signs with a finger (`DOC-02`)
- [ ] Admin uploads an agreement as PDF or text (`DOC-01`)
- [ ] Admin chooses which agreements each visitor type must sign (`DOC-01`)
- [ ] Signed copy saved as a PDF with name, signature, time and version (`DOC-03`)

**Badges**
- [x] Digital badge on the visitor's phone (`BAD-04`)
- [x] Badge says "Valid <date> only" (`BAD-05`)
- [ ] Badge design: logo, photo, name, company, host, date, type colour, QR (`BAD-02`)
- [ ] Print the badge on a label printer (Brother QL) (`BAD-01`)
- [ ] Badge printing on/off per visitor type (`BAD-03`)

**Notifications** (moved from FRIEND, you're building these)
- [ ] Email the host when their visitor arrives (`NOT-01`)
- [ ] The email has the visitor's name, company, photo and location (`NOT-02`)
- [ ] Email the visitor their invitation with the link, address and map (`PRE-02`)
- [ ] SMS the host when their visitor arrives (Twilio) (`NOT-01`)
- [ ] Each employee chooses email, SMS or both (`NOT-06`)
- [ ] The host gets it within 5 seconds of sign-in (`NFR-PER-02`)

**Staff at reception**
- [ ] Employees sign in/out at reception with name, PIN or personal QR (`EMP-01`)

---

### 🧑‍💼 FRIEND: staff side

**Login and security**
- [ ] Staff log in with email and password; passwords stored hashed (`NFR-SEC-02`)
- [ ] Admins can turn on two-step login (MFA) (`NFR-SEC-02`)
- [ ] Roles: Company Owner, Admin, Receptionist, Host, Security (section 2)
- [ ] Admin pages and APIs check the user's role every time (`NFR-SEC-03`)
- [ ] Every admin action recorded: who, when, IP, before/after (`ROLE-02`)

**Pre-registration**
- [x] Host fills a form and gets an invite link + QR (`PRE-01`)
- [ ] Invite several visitors at once (`PRE-01`)
- [ ] Choose a time window, not only a date (`PRE-01`)
- [ ] Host can see, edit and cancel their invitations

**Admin portal**
- [x] Live list of who is on site (`ADM-01`)
- [x] List of who is expected today
- [x] Sign a visitor out from the portal (`ADM-02`)
- [ ] Filter the live list by location and visitor type (`ADM-01`)
- [ ] Sign a visitor in from the portal (`ADM-02`)
- [ ] Search past visits by name, company, host, date (`ADM-03`)
- [ ] Employee list: add, edit, remove (`ADM-04`)
- [ ] Import employees from a CSV file (`ADM-04`)
- [ ] Branding settings: logo, colours, welcome text, background (`ADM-06`)

**Locations**
- [ ] A company can have several offices, each with address and timezone (`LOC-01`)
- [ ] Each office has its own visitor types, agreements and settings (`LOC-02`)
- [ ] Several reception tablets per office (`LOC-03`)
- [ ] One company can never see another company's data (`LOC-04`)

**Deliveries** (moved from YOU)
- [ ] Courier taps "Delivery" and picks the person, or "Reception" (`DEL-01`)
- [ ] That person is notified, with an optional photo of the parcel (`DEL-02`)

**Reports and emergencies**
- [ ] Dashboard: visitors today/week/month, busiest hours, top hosts (`REP-01`)
- [ ] Download the visitor log as CSV and PDF (`REP-02`)
- [ ] One-tap emergency list of everyone inside, printable (`EVA-01`)

---

### 💳 Billing: whoever finishes first

- [ ] Sign up with a 14-day free trial, no card needed (`BIL-01`)
- [ ] Plans with limits on offices, tablets and features (`BIL-02`)
- [ ] Card payments and invoices with Stripe (`BIL-03`)
- [ ] Upgrade, downgrade and cancel inside the app (`BIL-04`)

---

### 🚀 Before launch: TOGETHER

- [ ] Put it online with HTTPS (a real domain instead of `192.168.x.x`)
- [ ] Set a strong `APP_SECRET`
- [ ] Test with 5+ people who have never seen the app (`NFR-USA-01`)
- [ ] Works with large text, high contrast and screen readers (`NFR-ACC-01`)

---

## Phase 2: after the first release (split later)

- [ ] Slack and Microsoft Teams notifications (`NOT-03`)
- [ ] Host replies "Coming now" and the visitor sees it (`NOT-04`)
- [ ] If the host doesn't answer, notify reception (`NOT-05`)
- [ ] Mobile app for hosts and admins, with push notifications (`NOT-07`, `ADM-07`)
- [ ] Visitor fills forms and signs before arriving (`PRE-03`)
- [ ] Upload many invitations from a CSV (`PRE-04`)
- [ ] Recurring visits, like a daily contractor (`PRE-05`)
- [ ] Some visits need manager approval (`PRE-07`, `SEC-04`)
- [ ] Choose language on the welcome screen (`KIO-11`)
- [ ] One person signs in a group (`KIO-12`)
- [ ] Reception tablet works offline and syncs later (`KIO-14`)
- [ ] Accessibility mode: bigger text, high contrast (`KIO-16`)
- [ ] Email the signed agreement to the visitor (`DOC-04`)
- [ ] Returning visitors re-sign only when the agreement changes (`DOC-05`)
- [ ] Watchlist: flag or block certain people (`SEC-01` to `SEC-03`)
- [ ] Delivery collected, with signature (`DEL-03`, `DEL-04`)
- [ ] Emergency: mark people safe/missing, send SMS to all, save a report (`EVA-02` to `EVA-05`)
- [ ] Employee sign-in from their phone near the office (`EMP-02`)
- [ ] Employee status board and attendance report (`EMP-03`, `EMP-05`)
- [ ] Custom roles built from permissions (`ROLE-01`)
- [ ] Log in with Google / Microsoft / Okta (`INT-03`)
- [ ] Sync employees from Azure AD / Google Workspace (`ADM-08`, `INT-04`)
- [ ] Public API and webhooks (`INT-05`)
- [ ] Scheduled reports by email; audit export (`REP-03`, `REP-04`)

## Phase 3: later

- [ ] Auto-invite from Outlook / Google Calendar meetings (`PRE-06`)
- [ ] Scan ID card / passport to fill the name (`KIO-15`)
- [ ] Safety video or quiz before sign-in (`DOC-06`)
- [ ] Contractors upload certificates with expiry dates (`DOC-07`)
- [ ] Alert when a visitor stays too long (`SEC-05`)
- [ ] Door access cards and Wi-Fi guest passes (`SEC-06`, `INT-07`)
- [ ] Zapier connector (`INT-06`)
- [ ] Health questionnaire for employees (`EMP-04`)
- [ ] Choose where data is stored: EU, US, AU, India (`NFR-PRV-04`)
