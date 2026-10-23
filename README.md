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

## Paying one student at a time

Payments no longer have to go out as one big batch:

- **Only confirmed jobs get paid.** A job a student has marked done still
  counts as owed (badges, the right-hand "owed" panel, their Students page),
  but it only appears on steps 2 and 3 of the payment run once you've pressed
  **Confirm** on it in step 1. Unconfirmed jobs just wait there.
- **Each student has their own card on "Send it"**, listing their confirmed
  jobs with a tick box each (all ticked by default) and their own
  **Mark [name] paid** button. Pressing it marks only that student's ticked
  jobs as paid and clears only their top-up; everyone else stays on the list
  for later. A green note confirms who you just marked paid.
- **Untick a job to hold it back.** It stays on that student's card, unpaid,
  until you tick it and pay it another time.
- **"Mark everyone paid"** is still there at the bottom when more than one
  student is waiting, for when you do want to settle the lot in one go.

As before, none of this moves money — you still transfer from your banking
app, then mark it paid here.

## Numbers on screen: 1 decimal place, rounded down

Every amount and every hours figure on the dashboard is shown to exactly one
decimal place, cut down rather than rounded — £33.99 shows as £33.9, 14 hours
as 14.0 hrs. This is display-only: the database and all the calculations keep
the full figures, so totals are always worked out from the real numbers and
only trimmed at the very end. It all comes from `oneDp()` in `utils.js`,
which `money()` and `hours()` both use. (Percentages, like the week-on-week
hours trend and margin %, are still whole numbers.)

## Side columns pinned to the screen

The left column (logo, tabs, "Owed to students") and the right column (day
panel, To chase, This month) are both fixed to the height of the browser
window — only the middle section scrolls with the page. If either column has
more in it than fits on screen, it scrolls on its own. On narrow screens
(under 1000px wide), where the columns stack, they go back to scrolling
normally. This is the `.rail-fixed` class at the bottom of `modernist.css`.

## Earnings card

The Home tab's earnings card (design "A2" from the drafts):

- **Headline: this month's profit so far** — revenue minus student pay minus
  expenses for the current month, with this month's revenue and the % of
  revenue you kept underneath.
- **Pace pill** — this month's profit up to today's date vs last month's
  profit up to the same date ("▲ 12.4% ahead of September at this point").
  Hidden if last month had no profit by that day to compare with.
- **Chart** — revenue as the main line (glowing blue, with a faint fill
  under it), profit as small bars underneath on the same scale, and the
  current month dashed because it isn't finished. The best month gets a
  label; hover any point or bar for the exact figure. A loss month shows its
  profit bar in red, below £0.
- **3M / 6M / 12M** buttons switch how many months are shown.

The blues are deliberately local to this card (the `EARN` colours at the
top of its code in `home.js`) — the rest of the dashboard keeps its green
theme. Figures come from `monthlySeries()` and `monthToDate()` in
`derive.js`.

## Colours

The page background is white (`--color-bg` in `modernist.css`) rather than
the handoff's cream — body text is unchanged (it was already a near-black
`#1f2420`, not literally cream, so nothing to do there). The sidebar's logo +
nav block now has a solid dark green background using the same green
already defined as `--color-accent`/`--color-accent-700` (it's what the
"Booked" tags, primary buttons, etc. were already using, and it's the same
green as the text in `logo-green.png`) — with `logo-cream.png` swapped in
there instead of `logo-green.png`, since that file is the transparent,
pale/cream-coloured version of the mark, made for sitting on a dark surface
rather than a light one. `logo-green.png` stays in use on the sign-in
screen, where the surrounding card is still light.

## A rounder, more polished look

A general pass to make the whole thing feel a bit smoother and less
spreadsheet-like, without changing the colours again: corners are now
gently rounded everywhere (`--radius-sm/md/lg` in `modernist.css`, which
used to be a deliberately sharp `0`), dividing lines are lighter (that same
file's `--color-divider`, down from 40% to 14% black), and buttons, inputs,
cards and table rows now have a soft shadow and a quick, smooth transition
on hover instead of snapping straight to a new state. Primary buttons lift
very slightly on hover for the same reason. This reaches every screen
automatically since it's all done through the shared tokens in
`modernist.css` — I additionally hand-applied it to the biggest boxes that
don't use those shared styles (the Home tiles and earnings card, the sign-in
card, the student cards, the "Ready to pay" box, the sidebar), since those
are hand-styled per-screen rather than built from the shared `.card` class.
I didn't rewrite every smaller box on every screen individually — if
something still looks flat/sharp-edged to you, point me at it and I'll
match it up.

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
- `modernist.css` — the design system stylesheet (see "A rounder, more polished look" above for what's changed from the handoff)
- `logo-green.png` / `logo-cream.png` — logo files from the handoff
