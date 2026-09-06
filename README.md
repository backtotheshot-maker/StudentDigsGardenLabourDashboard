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

## What changed in the database

I added columns to the existing tables (nothing was removed or renamed, so the
employee app keeps working exactly as before):

- **employees**: `course`, `started_date`, `bank_name`, `bank_last4`
- **clients**: `source`, `handed_over_date`, `first_booking_date`, `last_nudged_at`
- **jobs**: `task_label`, `photos_count`, `review_status`, `payment_id`
- **payments**: `top_up`, `reference`
- new **city_rates** table (Exeter/Cardiff £22, Oxford £26 — what homeowners are
  billed per hour; edit this table directly in Supabase if rates change)
- **business_settings**: `green_waste_charge` (£10), `green_waste_pay` (£8),
  `bank_display` (the "Pay from" label text)

These are all nullable/defaulted, so existing rows didn't need backfilling — they'll
just show blanks (e.g. "no bank on file") until you fill them in, either straight in
the Supabase table editor or by wiring the employee app to collect them.

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
- **"Change rate"** uses a plain browser prompt rather than a proper dialog — quick
  to use, but worth upgrading to a real modal if this becomes daily-use.

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
