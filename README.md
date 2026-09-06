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

## Home tab

New landing screen (it's what you see when you sign in) with a snapshot of
the business:

- **All-time revenue** and **all-time profit** — revenue counts every
  completed job's billed amount, starting from `business_settings
.starting_revenue` (currently £3,518, from before this dashboard existed —
  edit that number directly in Supabase if it ever needs correcting). Profit
  is revenue minus what students were paid for that work, minus expenses
  (below). Booked-but-not-done jobs don't count yet — only work that's
  actually happened.
- **Hours booked this week**, with a green ▲ or red ▼ percentage above it
  comparing to last week's hours (Monday-Sunday either side of today) — this
  counts booked and completed jobs both, since it's about how busy the week
  is, not just finished work.
- **A "this week" strip** — the 7 days of the current week at a glance, each
  showing job count and hours; click a day to jump straight to it on the full
  calendar.
- **Expenses** — press **+ Add expense** to log either a one-off cost (a new
  strimmer, a one-time fee) or a monthly one (insurance, a subscription — a
  direct debit that repeats). One-off expenses subtract once, on their date.
  Monthly ones keep accruing against profit once a month from their start
  date onwards until you press **Stop** on them (which records when it
  stopped, rather than deleting it, so past months it actually cost you still
  count) — **Delete** is there separately for correcting a mistake, on either
  kind.

This lives in a new `expenses` table (`description`, `amount`, `type`
— `one_off` or `monthly` —, `date`, `ended_date`), behind the same
admin-only row-level security as everything else.

## What changed in the database

I added columns to the existing tables (nothing was removed or renamed, so the
employee app keeps working exactly as before):

- **employees**: `course`, `started_date`, `bank_name`, `bank_last4`, `bank_sort_code`, `bank_account_number`
- **clients**: `source`, `handed_over_date`, `first_booking_date`, `last_nudged_at`
- **jobs**: `task_label`, `photos_count`, `review_status`, `payment_id`, `paid`
- **payments**: `top_up`, `reference`
- **business_settings**: `green_waste_charge` (£10), `green_waste_pay` (£8),
  `bank_display` (the "Pay from" label text) — `starting_revenue` and
  `starting_date` already existed on this table and are now used, as the
  Home tab's revenue baseline
- **expenses** (new table): `description`, `amount`, `type` (`one_off` /
  `monthly`), `date`, `ended_date` — see "Home tab" above

**`jobs.status` itself was NOT changed** — I tried that in an earlier version
(changing it to `booked`/`done`/`paid`) and it broke the employee app, which
writes and expects only `upcoming` / `completed`. That's been reverted back to
exactly how it always was. Instead, the dashboard derives its own three-stage
view (booked → done, to pay → paid) purely in its own code, from two things
that live only on the dashboard side: `status` (`upcoming` = booked,
`completed` = done or paid) and a plain `jobs.paid` true/false flag — hitting
"Send" in a payment run is a single update setting `paid = true` on the jobs
being paid, nothing else. That's it — no separate `payments` row has to be
written for a job to read as paid, which is also why the "Send" button now
can't silently do nothing: there's only one write, and if it fails you'll see
a banner across the top of the page saying so (see below). So the employee
app's own reads and writes to `jobs.status` are completely unaffected by
anything this dashboard does.

*(There's a legacy `payment_id` column and `payments` table from an earlier
version of this feature that did write a bookkeeping row per payment run —
one already-paid job in your data still carries a `payment_id`, so the
dashboard still treats a job as paid if either `paid` is true or it has a
`payment_id`, but new payment runs no longer touch `payments`/`payment_id` at
all, since you said you don't need real money-out tracking. Both are harmless
to ignore or delete if you want to tidy up later.)*

There's also a **city_rates** table left over from the per-city billing model —
it's unused now the pay model is flat, harmless to ignore or delete.

New columns are all nullable/defaulted, so existing rows didn't need
backfilling — they'll just show blanks (e.g. "no bank on file") until filled in.

## Paying employees — bank details right where you need them

The payment run's "Mark as paid" button only ever marks jobs as paid in the
dashboard (see above) — it doesn't move any money. Instead, the last step of
the payment run ("Send it") shows exactly what you need to pay each student
manually from your own banking app: their name, sort code, account number,
and the amount, all in one card on the right. Work down the list paying each
one the normal way you already do, then press "Mark as paid" once you're
done, to record it here.

For those details to show up, each student needs their sort code and account
number saved once on their Students page (a "Bank details" panel there) —
only the last 4 digits are shown anywhere else in the dashboard; the full
details are only ever read to display them on the Send step. If anyone's
missing them, that shows up right in their row on the Send step instead of
their bank details, so it's obvious before you start paying.

## Things that are deliberately not real yet

- **No live bank transfer, and no separate bookkeeping row either.** "Mark as
  paid" in the payment run just flips those jobs' `paid` flag to true — it
  doesn't move any money, and doesn't write anything to the `payments` table
  either, since that's not something you need tracked. You still pay everyone
  yourself from your own banking app (using the details shown on the Send
  step); this just marks the jobs as settled so they drop off "to pay" and
  stop showing up as owed.
- **If a payment run ever does fail** (e.g. a login session expiring), you'll see
  a banner across the top of the page saying "That didn't save: …" — dismiss it
  with the ✕, sort out whatever it says, and try Send again. It won't silently
  do nothing.
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
- `main.js` boots the app, `app.js` is the router + event handling, `home.js` /
  `calendar.js` / `handovers.js` / `jobs.js` / `payments.js` / `students.js` /
  `homeowners.js` are the seven screens, `db.js` / `derive.js` hold the Supabase
  queries and money-rule calculations
- `modernist.css` — the design system stylesheet, copied over unchanged
- `logo-green.png` / `logo-cream.png` — logo files from the handoff
