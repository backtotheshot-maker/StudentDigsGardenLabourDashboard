import { money, hours, dayLabel, fmtTime, tagStyle, statusTone, escapeHtml, workLabel } from './utils.js';
import { enrichJobs } from './derive.js';

const FILTERS = [
  { key: 'booked', label: 'Booked' },
  { key: 'to_pay', label: 'To pay' },
  { key: 'paid', label: 'Paid' },
  { key: 'all', label: 'All' },
];

const NOTES = {
  booked: 'Upcoming work students have put in the app calendar.',
  to_pay: 'Finished jobs waiting on the next payment run.',
  paid: 'Settled — the student has the money.',
  all: 'Every job logged this term.',
};

export function renderJobs(state) {
  const jobs = enrichJobs(state.db).sort((a, b) => b.date.localeCompare(a.date) || b.start_time.localeCompare(a.start_time));
  const counts = {
    booked: jobs.filter((j) => j.stage === 'booked').length,
    to_pay: jobs.filter((j) => j.stage === 'done').length,
    paid: jobs.filter((j) => j.stage === 'paid').length,
    all: jobs.length,
  };
  const stageMap = { booked: 'booked', to_pay: 'done', paid: 'paid' };
  const filtered = state.jobsFilter === 'all' ? jobs : jobs.filter((j) => j.stage === stageMap[state.jobsFilter]);

  const seg = FILTERS.map((f) => `
    <label class="seg-opt"><input type="radio" name="jobfilter" data-act="job-filter" data-filter="${f.key}" ${state.jobsFilter === f.key ? 'checked' : ''}><span>${f.label} ${f.key === 'all' ? `(${counts.all})` : `(${counts[f.key]})`}</span></label>
  `).join('');

  const rows = filtered.map((j) => {
    const { tone, label } = statusTone(j.stage);
    const showMarkDone = j.stage === 'booked';
    return `
      <tr data-act="select-job" data-id="${j.id}" style="cursor:pointer">
        <td style="font-size:13px;white-space:nowrap">${dayLabel(j.date)}<div style="font-size:11px;color:var(--color-neutral-700)">${fmtTime(j.start_time)}</div></td>
        <td style="font-family:var(--font-heading);font-weight:800">${escapeHtml(j.homeowner?.name || '—')}<div style="font-size:11px;font-weight:400;color:var(--color-neutral-700)">${escapeHtml(workLabel(j))}</div></td>
        <td style="font-size:13px">${escapeHtml(j.employee?.name || '—')}</td>
        <td style="text-align:right">${hours(j.hours)}</td>
        <td style="text-align:right;font-family:var(--font-heading);font-weight:800">${money(j.pay)}</td>
        <td><span style="${tagStyle(tone)}">${label}</span></td>
        <td style="text-align:right">${showMarkDone ? `<button class="btn btn-ghost" data-act="mark-done" data-id="${j.id}">Mark done</button>` : ''}</td>
      </tr>`;
  }).join('');

  return `
    <div>
      <h1 style="font-size:32px;margin:0 0 2px">Jobs</h1>
      <p style="margin:0 0 12px;font-size:13px;color:var(--color-neutral-700)">${NOTES[state.jobsFilter]}</p>
      <div class="seg" style="margin-bottom:16px">${seg}</div>
      <div style="overflow-x:auto;border-top:2px solid var(--color-divider)">
        <table class="table" style="min-width:700px">
          <thead><tr><th>When</th><th>Homeowner</th><th>Student</th><th style="text-align:right">Hours</th><th style="text-align:right">Pay</th><th>Status</th><th></th></tr></thead>
          <tbody>${rows || `<tr><td colspan="7" style="padding:16px 0;color:var(--color-neutral-700)">Nothing here.</td></tr>`}</tbody>
        </table>
      </div>
    </div>`;
}
