import { money, hours, dayLabel, tagStyle, statusTone, escapeHtml, workLabel } from './utils.js';
import { enrichJobs, studentSummary, owedSummary } from './derive.js';
import { EMPLOYEE_PAY_RATE } from './config.js';

export function renderStudents(state) {
  if (state.stuId) return studentDetail(state);
  return studentList(state);
}

function studentList(state) {
  const jobs = enrichJobs(state.db);
  const byCity = {};
  for (const e of state.db.employees) byCity[e.city || 'Unassigned'] = (byCity[e.city || 'Unassigned'] || 0) + 1;
  const cityLine = Object.entries(byCity).map(([c, n]) => `${c} ${n}`).join(', ');

  const cards = state.db.employees.map((e) => {
    const s = studentSummary(state.db, jobs, e);
    const hasUpcoming = s.weekAheadHours > 0;
    const dotStyle = hasUpcoming
      ? 'width:9px;height:9px;border-radius:50%;background:var(--color-accent);display:inline-block'
      : 'width:9px;height:9px;border-radius:50%;border:1.5px solid var(--color-neutral-500);display:inline-block';
    const thisWeek = hasUpcoming ? `${s.weekAheadHours % 1 === 0 ? s.weekAheadHours : s.weekAheadHours.toFixed(1)}h this week` : 'nothing this week';
    return `
      <div data-act="open-student" data-id="${e.id}" style="border:2px solid var(--color-divider);padding:12px;cursor:pointer;display:flex;flex-direction:column;gap:6px">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="${dotStyle}"></span>
          <span style="font-family:var(--font-heading);font-weight:800;font-size:15px">${escapeHtml(e.name)}</span>
        </div>
        <span style="font-size:11px;color:var(--color-neutral-700)">${escapeHtml(e.city || '—')} · ${escapeHtml(e.course || '—')}</span>
        <span style="font-size:12px">${thisWeek}</span>
        <div style="display:flex;justify-content:space-between;align-items:baseline;border-top:1px solid var(--color-divider);padding-top:6px;margin-top:2px">
          <span style="font-size:11px;color:var(--color-neutral-700)">owed now</span>
          <span style="font-family:var(--font-heading);font-weight:800;font-size:15px">${s.owed.pay ? money(s.owed.pay) : '—'}</span>
        </div>
      </div>`;
  }).join('');

  return `
    <div>
      <h1 style="font-size:32px;margin:0 0 2px">Students</h1>
      <p style="margin:0 0 16px;font-size:13px;color:var(--color-neutral-700)">${state.db.employees.length} on the books${cityLine ? ' · ' + cityLine : ''}</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px">${cards || '<p style="color:var(--color-neutral-700)">No students yet.</p>'}</div>
    </div>`;
}

function studentDetail(state) {
  const e = state.db.employees.find((x) => x.id === state.stuId);
  if (!e) return studentList({ ...state, stuId: null });
  const jobs = enrichJobs(state.db);
  const s = studentSummary(state.db, jobs, e);
  const bank = e.bank_name ? `${escapeHtml(e.bank_name)} ••${escapeHtml(e.bank_last4 || '----')}` : 'no bank on file';

  const stats = [
    { label: 'Booked, week ahead', value: hours(s.weekAheadHours), note: '' },
    { label: 'Owed now', value: money(s.owed.pay), note: `${s.owed.count} jobs done` },
    { label: 'Homeowners', value: s.theirClients.length, note: 'handed to them' },
    { label: 'Hours, term', value: hours(s.totalHours), note: `at ${money(EMPLOYEE_PAY_RATE)}/hr` },
  ];

  const jobRows = s.theirJobs.slice(0, 12).map((j) => {
    const { tone, label } = statusTone(j.stage);
    return `
      <div data-act="select-job" data-id="${j.id}" style="display:flex;gap:12px;align-items:center;padding:9px 0;border-bottom:1px solid var(--color-divider);flex-wrap:wrap;cursor:pointer">
        <span style="flex:1 1 140px;font-size:14px">${escapeHtml(j.homeowner?.name || '—')}<span style="display:block;font-size:11px;color:var(--color-neutral-700)">${dayLabel(j.date)} · ${escapeHtml(workLabel(j))}</span></span>
        <span style="font-size:12px">${hours(j.hours)}</span>
        <span style="font-size:13px;font-family:var(--font-heading);font-weight:800">${money(j.pay)}</span>
        <span style="${tagStyle(tone)}">${label}</span>
      </div>`;
  }).join('') || `<p style="font-size:13px;color:var(--color-neutral-700)">No jobs yet.</p>`;

  const clientRows = s.theirClients.map((c) => `
    <div style="display:flex;gap:12px;align-items:center;padding:9px 0;border-bottom:1px solid var(--color-divider)">
      <span style="flex:1;font-size:14px">${escapeHtml(c.name)}<span style="display:block;font-size:11px;color:var(--color-neutral-700)">${escapeHtml(c.address || '')}${c.handed_over_date ? ' · since ' + c.handed_over_date : ''}</span></span>
    </div>`).join('') || `<p style="font-size:13px;color:var(--color-neutral-700)">No homeowners yet.</p>`;

  return `
    <div>
      <button class="btn btn-ghost" style="margin-bottom:8px" data-act="close-student">← All students</button>
      <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap;border-bottom:2px solid var(--color-divider);padding-bottom:12px">
        <div>
          <h1 style="font-size:34px;margin:0 0 2px">${escapeHtml(e.name)}</h1>
          <p style="margin:0;font-size:13px;color:var(--color-neutral-700)">${escapeHtml(e.city || '—')} · ${escapeHtml(e.course || '—')} · ${money(EMPLOYEE_PAY_RATE)}/hr · ${escapeHtml(e.phone || '—')} · ${bank}</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-primary" data-act="nav" data-screen="payments">Pay ${money(s.owed.pay)}</button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));border-bottom:2px solid var(--color-divider)">
        ${stats.map((st) => `<div style="padding:12px;border-right:1px solid var(--color-divider);display:flex;flex-direction:column;gap:2px">
          <span style="font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:var(--color-neutral-700)">${st.label}</span>
          <span style="font-family:var(--font-heading);font-weight:800;font-size:24px;line-height:1.05">${st.value}</span>
          <span style="font-size:11px;color:var(--color-neutral-700)">${st.note}</span>
        </div>`).join('')}
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px;margin-top:16px;align-items:start">
        <section>
          <div style="border-bottom:2px solid var(--color-divider);padding-bottom:6px;margin-bottom:6px"><h2 style="font-size:17px;margin:0">Their jobs</h2></div>
          ${jobRows}
        </section>
        <section>
          <div style="border-bottom:2px solid var(--color-divider);padding-bottom:6px;margin-bottom:6px"><h2 style="font-size:17px;margin:0">Their homeowners</h2></div>
          ${clientRows}
          <div style="margin-top:12px;border:2px solid var(--color-divider);padding:12px">
            <div style="font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:var(--color-neutral-700)">Paid to date</div>
            <div style="font-family:var(--font-heading);font-weight:800;font-size:24px">${money(s.paidToDate)}</div>
            <div style="font-size:11px;color:var(--color-neutral-700)">${s.jobsToDate} jobs${e.started_date ? ' since ' + e.started_date : ''}</div>
          </div>
        </section>
      </div>
    </div>`;
}
