// Pure selectors over the loaded db + local draft state. Screens call these
// instead of poking at raw rows, so the money/status rules live in one place.

import { computeJobMoney } from './db.js';
import { isoDate, dowMon0 } from './utils.js';

export function indexById(rows) {
  const m = {};
  for (const r of rows) m[r.id] = r;
  return m;
}

export function enrichJobs(db) {
  const employeesById = indexById(db.employees);
  const clientsById = indexById(db.clients);
  return db.jobs.map((job) => {
    const employee = employeesById[job.employee_id];
    const homeowner = clientsById[job.client_id];
    const { hours, pay, billed } = computeJobMoney(job, employee, db.settings);
    return { ...job, employee, homeowner, hours, pay, billed };
  });
}

// A job is "payable" once the student has marked it done and it hasn't been
// queried away. It stays payable (and counted in owed totals) whether or not
// it has been explicitly confirmed yet — querying is what removes it.
export function isPayable(job) {
  return job.status === 'done' && job.review_status !== 'queried';
}

export function owedSummary(jobs) {
  const payable = jobs.filter(isPayable);
  const pay = payable.reduce((s, j) => s + j.pay, 0);
  const students = new Set(payable.map((j) => j.employee_id));
  return { pay, count: payable.length, students: students.size, jobs: payable };
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
  const weekAhead = theirJobs.filter((j) => j.status === 'booked' && withinNextWeek(j.date));
  const theirClients = db.clients.filter((c) => c.primary_employee_id === employee.id);
  const paidJobs = theirJobs.filter((j) => j.status === 'paid');
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
