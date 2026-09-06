// Supabase project connection — this is the SAME backend the Student Digs
// employee app uses ("garden labour" project). The anon key is safe to ship
// client-side: every table is behind row-level security, and only a signed-in
// user with profiles.role = 'admin' can read/write through these policies.
export const SUPABASE_URL = 'https://wkzoxlrqcqywxgnbolzr.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indrem94bHJxY3F5d3hnbmJvbHpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1NjMyMzcsImV4cCI6MjEwMDEzOTIzN30.eGL5el_DQxG0k4EPqBHgAHPOfIiGOSOjq074zEMA74c';

// Fixed money split rules. Flat rates, not per-student/per-city: every
// employee is paid £14/hr and every homeowner is billed £16/hr, full stop.
// (Green waste is the one variable add-on — client +£10 / employee +£8 —
// and that lives in business_settings since it's already a DB-editable rule.)
export const EMPLOYEE_PAY_RATE = 14;
export const CLIENT_CHARGE_RATE = 16;
