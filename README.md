# Student Digs — Back Office

A working build of the "Back Office" admin dashboard from your Claude Design handoff
(`design_handoff_back_office/`). Plain HTML/CSS/JS, no build step — same architecture
as the rest of the admin side. It connects to the **same Supabase project the app
already uses** ("garden labour", project ref `wkzoxlrqcqywxgnbolzr`) — nothing was
duplicated or migrated, I just added the extra columns this design needed on top of
the existing tables.

## Running it

It needs to be served over HTTP (the browser blocks ES module imports from a plain
`file://` path) — it doesn't need a build step, just a static file server:

```
npx serve .
# or: python3 -m http.server 8080
```

To put it live, drag the folder into Netlify/Vercel, or add it to whatever's already
hosting the employee-facing site. It's a static site, so any host works.

**Everything is deliberately one flat folder — no subfolders at all.** The first
version of this had `css/`, `js/`, and `assets/` folders, which is why the GitHub
web upload flattened everything and broke the deployment (Cloudflare then served
`index.html` in place of the missing CSS/JS, which is why the page looked blank).
Uploading this version the same way — dragging every file into the repo — will work,
since there's no folder structure left to lose. If you ever add files via `git`
instead of the web UI, folders would be safe too, but flat avoids the issue either way.

## Signing in

It uses the same Supabase Auth as the rest of the project. Sign in with the existing
admin login (the `reeve.s@outlook.com` account already has `role = 'admin'` in the
`profiles` table) — no new accounts were created. If you want other people to have
back-office access later, add a `profiles` row for them with `role = 'admin'`.

## The pay model

Flat, not per-student or per-city: **every employee is paid £14/hr, every
homeowner is billed £16/hr.** That's hardcoded as constants in `config.js`
(`EMPLOYEE_PAY_RATE`, `CLIENT_CHARGE_RATE`) — the app no longer looks at
`employees.hourly_rate` at all, so editing that column in Supabase won't do
anything (an earlier version of this dashboard supported per-student rates
and per-city billing; that's been removed since the business doesn't use it).

**Green waste** is the one variable add-on and it's wired into every pay/bill
calculation: when `jobs.green_waste` is true, the job adds +£10 to what the
homeowner's billed and +£8 to what the student's paid (both editable in the
`business_settings` table if those figures ever change) — you keep the £2
difference, same logic as the hourly split. This only applies automatically
when a job's `pay_amount`/`client_charge` are left blank so the dashboard
computes them; if you type numbers into those columns directly, whatever you
type is used as-is. Any job with green waste shows "+ green waste" next to
its task description throughout the dashboard so it's visible at a glance.

## What changed in the database

I added columns to the existing tables (nothing was removed or renamed, so the
employee app keeps working exactly as before):

- **employees**: `course`, `started_date`, `bank_name`, `bank_last4`
- **clients**: `source`, `handed_over_date`, `first_booking_date`, `last_nudged_at`
- **jobs**: `task_label`, `photos_count`, `review_status`, `payment_id`
- **payments**: `top_up`, `reference`
- **business_settings**: `green_waste_charge` (£10), `green_waste_pay` (£8),
  `bank_display` (the "Pay from" label text)

**`jobs.status` itself was NOT changed** — I tried that in an earlier version
(changing it to `booked`/`done`/`paid`) and it broke the employee app, which
writes and expects only `upcoming` / `completed`. That's been reverted back to
exactly how it always was. Instead, the dashboard derives its own three-stage
view (booked → done, to pay → paid) purely in its own code, from two things it
already has: `status` (`upcoming` = booked, `completed` = done or paid) and
whether `payment_id` is set (that's what distinguishes "done, to pay" from
"paid" — a payment run setting `payment_id` is what flips a job to "paid" here,
without ever touching `status`). So the employee app's own reads and writes to
`jobs.status` are completely unaffected by anything this dashboard does.

There's also a **city_rates** table left over from the per-city billing model —
it's unused now the pay model is flat, harmless to ignore or delete.

New columns are all nullable/defaulted, so existing rows didn't need
backfilling — they'll just show blanks (e.g. "no bank on file") until filled in.

## Things that are deliberately not real yet

- **No live bank transfer.** "Send £X" in the payment run records the jobs as paid
  and writes a `payments` row — it does not move money via Starling/SumUp. That's a
  real bank integration that's out of scope here; until it exists, sending is the
  bookkeeping step, and you still send the actual payment yourself.
- **No email/invoice automation.** The "Email each student their statement" and
  "Raise homeowner invoices" checkboxes are shown (matching the design) but don't
  do anything — there's no email service or invoicing wired up.
- **Photos** are just a count (`jobs.photos_count`) — there's no upload UI here or
  in the employee app yet, so it'll read "no photos" until that's built.
- **"Nudge" doesn't message anyone.** It only updates `clients.last_nudged_at` in
  the database — that's what moves a homeowner from "Waiting on student" to
  "Chased today" and clears it off the badge count. It does not send the student
  an actual text, email, or push notification; there's no messaging system wired
  up to do that. It's a personal reminder to yourself that you've followed up,
  not a notification to them.

## Small deviations from the handoff

- Added `‹ ›` month navigation on the calendar — the design only showed September
  2026, but a real calendar needs to move between months.
- The "Handovers" screen lists every homeowner that's been handed over (booked or
  not), matching its own intro copy ("every homeowner you've passed to a student");
  the right-rail "To chase" panel is the narrower, unbooked-only view the design
  describes.
- Confirm/query/nudge/mark-done write straight to the database (not just local
  state) — this being a real app rather than a prototype, those need to be visible
  to anyone else who opens it.

## Files

Everything sits in one folder next to `index.html`:

- `index.html` — entry point
- `main.js` boots the app, `app.js` is the router + event handling, `calendar.js` /
  `handovers.js` / `jobs.js` / `payments.js` / `students.js` / `homeowners.js` are the
  six screens, `db.js` / `derive.js` hold the Supabase queries and money-rule
  calculations
- `modernist.css` — the design system stylesheet, copied over unchanged
- `logo-green.png` / `logo-cream.png` — logo files from the handoff
