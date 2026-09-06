// Supabase project connection — this is the SAME backend the Student Digs
// employee app uses ("garden labour" project). The anon key is safe to ship
// client-side: every table is behind row-level security, and only a signed-in
// user with profiles.role = 'admin' can read/write through these policies.
export const SUPABASE_URL = 'https://wkzoxlrqcqywxgnbolzr.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indrem94bHJxY3F5d3hnbmJvbHpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1NjMyMzcsImV4cCI6MjEwMDEzOTIzN30.eGL5el_DQxG0k4EPqBHgAHPOfIiGOSOjq074zEMA74c';

// Fixed money split rules (not stored per-row because they're constants of
// the business model, same as documented for the employee app).
export const HOURLY_PAY_DEFAULT = 14; // fallback if an employee has no rate set
export const CITY_RATE_FALLBACK = 20; // £/hr charged to homeowner if a city has no rate row
