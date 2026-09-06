// Pure selectors over the loaded db + local draft state. Screens call these
// instead of poking at raw rows, so the money/status rules live in one place.

import { computeJobMoney } from './db.js';
import { isoDate, dowMon0, toDate } from './utils.js';

export function indexById(rows) {
  const m = {};
  for (const r of rows) m[r.id] = r;
  return m;
}

// The employee app owns jobs.status and only ever writes 'upcoming' or
// 'completed' — the dashboard's three-stage view (booked / done, to pay /
// paid) is derived from that plus its own `paid` flag, never stored as a
// third status value, so the employee app's own reads/writes are never
// affected by this. (`payment_id` is also checked for backwards-compatibility
// with jobs paid before the simpler `paid` flag existed.)
export function jobStage(job) {
  if (job.paid || job.payment_id) return 'paid';
  if (job.status === 'completed') return 'done';
  return 'booked';
}

export function enrichJobs(db) {
  const employeesById = indexById(db.employees);
  const clientsById = indexById(db.clients);
  return db.jobs.map((job) => {
    const employee = employeesById[job.employee_id];
    const homeowner = clientsById[job.client_id];
    const { hours, pay, billed } = computeJobMoney(job, employee, db.settings);
    return { ...job, employee, homeowner, hours, pay, billed, stage: jobStage(job) };
  });
}

// A job is "payable" once the student has marked it done and it hasn't been
// queried away. It stays payable (and counted in owed totals) whether or not
// it has been explicitly confirmed yet — querying is what removes it.
export function isPayable(job) {
  return job.stage === 'done' && job.review_status !== 'queried';
}

export function owedSummary(jobs) {
  const payable = jobs.filter(isPayable);
  const pay = payable.reduce((s, j) => s + j.pay, 0);
  const students = new Set(payable.map((j) => j.employee_id));
  return { pay, count: payable.length, students: students.size, jobs: payable };
}

// Groups already-payable jobs (i.e. owedSummary(jobs).jobs) by employee, with
// any top-up folded into `pay`. Shared by the payments screen (what's shown)
// and app.js (what's sent/exported), so both always agree on who's being paid
// and for how much.
export function paymentGroups(payableJobs, topUps = {}) {
  const byEmp = {};
  for (const j of payableJobs) (byEmp[j.employee_id] ||= { employee: j.employee, jobs: [] }).jobs.push(j);
  return Object.values(byEmp)
    .filter((g) => g.employee)
    .map((g) => {
      const basePay = g.jobs.reduce((s, j) => s + j.pay, 0);
      const topUp = topUps[g.employee.id] || 0;
      return { employee: g.employee, jobs: g.jobs, pay: basePay + topUp, topUp };
    });
}

export function handoverList(db) {
  return db.clients
    .filter((c) => !c.first_booking_date)
    .map((c) => {
      const employee = db.employees.find((e) => e.id === c.primary_employee_id);
      const chasedToday = c.last_nudged_at && isoDate(new Date(c.last_nudged_at)) === isoDate(new Date());
      return { ...c, employee, chasedToday };
    })
    .sort((a, b) => (a.handed_over_date || '').localeCompare(b.handed_over_date || ''));
}

export function badges(db, jobs) {
  const owed = owedSummary(jobs);
  return {
    handovers: handoverList(db).filter((h) => !h.chasedToday).length,
    payments: owed.count,
  };
}

export function monthWindow(year, month0) {
  const first = new Date(year, month0, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - dowMon0(first)); // back up to the Monday on/before the 1st
  const cells = [];
  for (let i = 0; i < 35; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push(d);
  }
  return cells;
}

export function jobsOnDate(jobs, dateIso) {
  return jobs.filter((j) => j.date === dateIso).sort((a, b) => a.start_time.localeCompare(b.start_time));
}

export function jobsInMonth(jobs, year, month0) {
  const prefix = `${year}-${String(month0 + 1).padStart(2, '0')}`;
  return jobs.filter((j) => j.date.startsWith(prefix));
}

export function studentSummary(db, jobs, employee) {
  const theirJobs = jobs.filter((j) => j.employee_id === employee.id);
  const owed = owedSummary(theirJobs);
  const weekAhead = theirJobs.filter((j) => j.stage === 'booked' && withinNextWeek(j.date));
  const theirClients = db.clients.filter((c) => c.primary_employee_id === employee.id);
  const paidJobs = theirJobs.filter((j) => j.stage === 'paid');
  const paidToDate = paidJobs.reduce((s, j) => s + j.pay, 0);
  const totalHours = theirJobs.reduce((s, j) => s + j.hours, 0);
  return {
    theirJobs: theirJobs.sort((a, b) => b.date.localeCompare(a.date)),
    theirClients,
    owed,
    weekAheadHours: weekAhead.reduce((s, j) => s + j.hours, 0),
    paidToDate,
    jobsToDate: paidJobs.length,
    totalHours,
  };
}

function withinNextWeek(dateIso) {
  const d = new Date(dateIso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = (d - today) / 86400000;
  return diff >= 0 && diff < 7;
}

// ---- home / analytics ---------------------------------------------------

// Mon-Sun range for "this week" (offsetWeeks 0) or a week either side of it.
export function weekRange(offsetWeeks = 0) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monday = new Date(today);
  monday.setDate(today.getDate() - dowMon0(today) + offsetWeeks * 7);
  const days = [...Array(7)].map((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
  return { start: isoDate(monday), end: isoDate(days[6]), days };
}

export function hoursInRange(jobs, startIso, endIso) {
  return jobs.filter((j) => j.date >= startIso && j.date <= endIso).reduce((s, j) => s + j.hours, 0);
}

// How many monthly charges have fallen between a start date and an end date
// (inclusive of the start date's month, exclusive of a charge day not yet
// reached in the end month) — e.g. started 15 Jan, checked on 10 Mar -> 2
// (Jan, Feb charges have happened; March's hasn't hit the 15th yet).
export function monthsElapsed(fromIso, toIso) {
  const from = toDate(fromIso);
  const to = toDate(toIso);
  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + 1;
  if (to.getDate() < from.getDate()) months -= 1;
  return Math.max(0, months);
}

// All-time revenue/profit, plus the current monthly expense run-rate. Revenue
// is recognised when a job is completed (whether or not it's been paid out
// yet), starting from business_settings.starting_revenue as the baseline for
// work done before this dashboard existed.
export function financeSummary(db, jobs) {
  const completed = jobs.filter((j) => j.status === 'completed');
  const revenue = Number(db.settings.starting_revenue || 0) + completed.reduce((s, j) => s + j.billed, 0);
  const payCosts = completed.reduce((s, j) => s + j.pay, 0);

  const todayIso = isoDate(new Date());
  let oneOffTotal = 0, monthlyAccrued = 0, monthlyRunRate = 0;
  for (const e of db.expenses || []) {
    const amount = Number(e.amount || 0);
    if (e.type === 'one_off') {
      oneOffTotal += amount;
    } else {
      const endIso = e.ended_date || todayIso;
      monthlyAccrued += monthsElapsed(e.date, endIso) * amount;
      if (!e.ended_date) monthlyRunRate += amount;
    }
  }

  const expensesTotal = oneOffTotal + monthlyAccrued;
  const profit = revenue - payCosts - expensesTotal;
  return { revenue, payCosts, oneOffTotal, monthlyAccrued, expensesTotal, monthlyRunRate, profit };
}

// Trailing calendar-month buckets for the Home earnings chart — revenue and
// profit per month, oldest first, always `monthsBack` long even where a
// month has no jobs (zero-filled, not skipped, so the x-axis stays even).
// Same recognition rule as financeSummary: a job counts in the month it was
// completed. Monthly recurring expenses count in full for any month they
// were active in at all (a lighter-weight approximation than financeSummary's
// day-accurate `monthsElapsed`, appropriate for a trend chart rather than a
// running total).
export function monthlySeries(db, jobs, monthsBack = 6) {
  const completed = jobs.filter((j) => j.status === 'completed');
  const first = new Date();
  first.setDate(1); // avoid month-length rollover when stepping by month

  const months = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(first.getFullYear(), first.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month0: d.getMonth() });
  }

  return months.map(({ year, month0 }) => {
    const prefix = `${year}-${String(month0 + 1).padStart(2, '0')}`;
    const monthJobs = completed.filter((j) => j.date.startsWith(prefix));
    const revenue = monthJobs.reduce((s, j) => s + j.billed, 0);
    const payCosts = monthJobs.reduce((s, j) => s + j.pay, 0);

    const monthStart = isoDate(new Date(year, month0, 1));
    const monthEnd = isoDate(new Date(year, month0 + 1, 0));
    let expenses = 0;
    for (const e of db.expenses || []) {
      const amount = Number(e.amount || 0);
      if (e.type === 'one_off') {
        if (e.date >= monthStart && e.date <= monthEnd) expenses += amount;
      } else if (e.date <= monthEnd && (!e.ended_date || e.ended_date >= monthStart)) {
        expenses += amount;
      }
    }

    const profit = revenue - payCosts - expenses;
    return { year, month0, revenue, profit };
  });
}
