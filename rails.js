import { money, hours, dayLabel, fmtTime, tagStyle, statusTone, escapeHtml, workLabel } from './utils.js';
import { enrichJobs, handoverList, owedSummary, jobsOnDate, jobsInMonth } from './derive.js';

const NAV = [
  { screen: 'home', label: 'Home' },
  { screen: 'calendar', label: 'Calendar' },
  { screen: 'handovers', label: 'Handovers' },
  { screen: 'jobs', label: 'Jobs' },
  { screen: 'payments', label: 'Payments' },
  { screen: 'students', label: 'Students' },
  { screen: 'homeowners', label: 'Homeowners' },
];

export function renderLeftRail(state) {
  const jobs = enrichJobs(state.db);
  const owed = owedSummary(jobs);
  const badgeFor = (screen) => {
    if (screen === 'handovers') return handoverList(state.db).filter((h) => !h.chasedToday).length;
    if (screen === 'payments') return owed.count;
    return 0;
  };

  const navItems = NAV.map((n) => {
    const active = state.screen === n.screen;
    const badge = badgeFor(n.screen);
    // The active chip is a light tag regardless of what it's sitting on, so
    // it doesn't need to change; the inactive label and the unread badge do,
    // since this nav now sits on the dark green band below, not the page bg.
    const style = active
      ? 'border-left-color:var(--color-accent);background:var(--color-accent-100);color:var(--color-text);'
      : 'color:rgba(255,255,255,0.75);';
    return `
      <button data-act="nav" data-screen="${n.screen}" class="sd-nav-btn${active ? '' : ' sd-nav-btn-inactive'}" style="font-family:var(--font-heading);font-weight:800;font-size:14px;padding:9px 16px;background:none;border:0;border-left:3px solid transparent;text-align:left;cursor:pointer;display:flex;justify-content:space-between;gap:8px;width:100%;${style}">
        <span>${n.label}</span>
        <span style="${badge > 0 ? 'font-size:10px;padding:1px 6px;border-radius:8px;background:#fff;color:var(--color-accent-800);' : 'display:none;'}">${badge}</span>
      </button>`;
  }).join('');

  return `
  <aside style="flex:0 0 238px;min-width:238px;border-right:1px solid var(--color-divider);display:flex;flex-direction:column;gap:16px;box-shadow:var(--shadow-sm)">
    <div style="background:var(--color-accent);padding:16px 0;display:flex;flex-direction:column;gap:16px">
      <a href="https://studentdigs.co" target="_blank" rel="noopener" style="display:block;padding:0 16px 8px"><img src="logo-cream.png" alt="Student Digs — Garden Labour" style="width:100%;height:auto"></a>
      <nav style="display:flex;flex-direction:column">${navItems}</nav>
    </div>
    <div style="margin-top:auto;padding:16px;border-top:1px solid var(--color-divider);display:flex;flex-direction:column;gap:8px">
      <span style="font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:var(--color-neutral-700)">Owed to students</span>
      <span style="font-family:var(--font-heading);font-weight:800;font-size:26px;line-height:1">${money(owed.pay, { headline: true })}</span>
      <span style="font-size:11px;color:var(--color-neutral-700)">${owed.count} jobs · ${owed.students} students</span>
      <button class="btn btn-primary btn-block" data-act="nav" data-screen="payments">Pay them</button>
      <span style="font-size:11px;color:var(--color-neutral-700);margin-top:8px">Sam Holloway · founder<br>studentdigs.co</span>
      <button class="btn btn-ghost" style="margin-top:4px;padding-left:0" data-act="logout">Sign out</button>
    </div>
  </aside>`;
}

export function renderRightRail(state) {
  const jobs = enrichJobs(state.db);
  const selectedJob = state.jobId ? jobs.find((j) => j.id === state.jobId) : null;

  let top;
  if (selectedJob) {
    top = jobPanel(selectedJob);
  } else {
    top = dayPanel(state, jobs);
  }

  return `
  <aside style="flex:0 0 320px;min-width:280px;border-left:1px solid var(--color-divider);padding:16px;display:flex;flex-direction:column;gap:24px">
    ${top}
    ${chasePanel(state)}
    ${monthPanel(state, jobs)}
  </aside>`;
}

function jobPanel(j) {
  const { tone, label } = statusTone(j.stage);
  const facts = [
    { label: 'When', value: `${dayLabel(j.date)}, ${fmtTime(j.start_time)}` },
    { label: 'Length', value: hours(j.hours) },
    { label: 'Work', value: escapeHtml(workLabel(j)) },
    { label: 'Student', value: escapeHtml(j.employee?.name || '—') },
    { label: 'Pay / bill', value: `${money(j.pay)} / ${money(j.billed)}` },
    { label: 'Your margin', value: money(j.billed - j.pay) },
    { label: 'Status', value: `<span style="${tagStyle(tone)}">${label}</span>` },
  ];
  const action = j.stage === 'done' ? 'Pay this job' : 'Payment run';
  return `
  <div>
    <div style="display:flex;justify-content:space-between;align-items:baseline;border-bottom:2px solid var(--color-divider);padding-bottom:6px;margin-bottom:8px">
      <h2 style="font-size:17px;margin:0">Job</h2>
      <button class="btn btn-ghost" data-act="close-job">Close</button>
    </div>
    <div style="font-family:var(--font-heading);font-weight:800;font-size:19px">${escapeHtml(j.homeowner?.name || 'Unknown')}</div>
    <div style="font-size:12px;color:var(--color-neutral-700);margin-bottom:12px">${escapeHtml(j.homeowner?.address || '')}${j.homeowner?.city ? ', ' + escapeHtml(j.homeowner.city) : ''}</div>
    ${facts.map((f) => `<div style="display:flex;justify-content:space-between;gap:12px;font-size:13px;padding:7px 0;border-bottom:1px solid var(--color-divider)"><span style="color:var(--color-neutral-700)">${f.label}</span><span style="text-align:right">${f.value}</span></div>`).join('')}
    <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
      <button class="btn btn-primary" data-act="nav" data-screen="payments">${action}</button>
      ${j.employee ? `<button class="btn btn-secondary" data-act="open-student" data-id="${j.employee.id}">Student</button>` : ''}
    </div>
  </div>`;
}

function dayPanel(state, jobs) {
  const dayKey = state.dayKey;
  if (!dayKey) {
    return `<div><div style="border-bottom:2px solid var(--color-divider);padding-bottom:6px;margin-bottom:8px"><h2 style="font-size:17px;margin:0">Day</h2></div><p style="font-size:13px;color:var(--color-neutral-700)">Pick a day in the calendar.</p></div>`;
  }
  const dayJobs = jobsOnDate(jobs, dayKey);
  const totalHours = dayJobs.reduce((s, j) => s + j.hours, 0);
  const meta = dayJobs.length ? `${totalHours % 1 === 0 ? totalHours : totalHours.toFixed(1)} hrs booked` : 'nothing booked';
  const rows = dayJobs.map((j) => `
    <div data-act="select-job" data-id="${j.id}" style="padding:9px 0;border-bottom:1px solid var(--color-divider);cursor:pointer">
      <div style="display:flex;justify-content:space-between;gap:8px">
        <span style="font-family:var(--font-heading);font-weight:800;font-size:14px">${escapeHtml(j.homeowner?.name || '—')}</span>
        <span style="font-size:12px;color:var(--color-neutral-700)">${fmtTime(j.start_time)}</span>
      </div>
      <div style="font-size:12px;color:var(--color-neutral-700)">${escapeHtml(j.employee?.name || '—')} · ${hours(j.hours)} · ${money(j.pay)}</div>
    </div>`).join('') || `<p style="font-size:13px;color:var(--color-neutral-700);margin:12px 0 0">Nothing booked. Pick another day in the calendar.</p>`;
  return `
  <div>
    <div style="display:flex;justify-content:space-between;align-items:baseline;border-bottom:2px solid var(--color-divider);padding-bottom:6px;margin-bottom:8px">
      <h2 style="font-size:17px;margin:0">${dayLabel(dayKey, { withYear: true })}</h2>
      <span style="font-size:11px;color:var(--color-neutral-700)">${meta}</span>
    </div>
    ${rows}
  </div>`;
}

function chasePanel(state) {
  const list = handoverList(state.db).filter((h) => !h.chasedToday).slice(0, 6);
  const rows = list.map((h) => `
    <div style="padding:9px 0;border-bottom:1px solid var(--color-divider);display:flex;flex-direction:column;gap:5px">
      <span style="font-family:var(--font-heading);font-weight:800;font-size:14px">${escapeHtml(h.name)}</span>
      <span style="font-size:12px;color:var(--color-neutral-700)">${escapeHtml(h.city || '—')} · handed to ${escapeHtml(h.employee?.name || '—')} ${h.handed_over_date ? relTime(h.handed_over_date) : ''}</span>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <span style="${tagStyle('warn')}">Waiting on student</span>
        <button class="btn btn-ghost" data-act="nudge" data-id="${h.id}">Nudge ${escapeHtml((h.employee?.name || '').split(' ')[0] || '')}</button>
      </div>
    </div>`).join('');
  return `
  <div>
    <div style="display:flex;justify-content:space-between;align-items:baseline;border-bottom:2px solid var(--color-divider);padding-bottom:6px;margin-bottom:8px">
      <h2 style="font-size:17px;margin:0">To chase</h2>
      <span style="font-size:11px;color:var(--color-neutral-700)">${list.length} waiting</span>
    </div>
    ${rows || `<p style="font-size:13px;color:var(--color-neutral-700);margin:12px 0 0">All handovers are booked in.</p>`}
  </div>`;
}

function monthPanel(state, jobs) {
  const monthJobs = jobsInMonth(jobs, state.calYear, state.calMonth0);
  const bookedCount = monthJobs.filter((j) => j.stage === 'booked').length;
  const totalHours = monthJobs.reduce((s, j) => s + j.hours, 0);
  const wages = monthJobs.reduce((s, j) => s + j.pay, 0);
  const billed = monthJobs.reduce((s, j) => s + j.billed, 0);
  const margin = billed - wages;
  const facts = [
    { label: 'Jobs booked', value: bookedCount },
    { label: 'Hours', value: hours(totalHours) },
    { label: 'Wages', value: money(wages) },
    { label: 'Billed', value: money(billed) },
    { label: 'Your margin', value: money(margin) },
  ];
  return `
  <div>
    <div style="border-bottom:2px solid var(--color-divider);padding-bottom:6px;margin-bottom:8px"><h2 style="font-size:17px;margin:0">This month</h2></div>
    ${facts.map((f) => `<div style="display:flex;justify-content:space-between;gap:12px;font-size:13px;padding:7px 0;border-bottom:1px solid var(--color-divider)"><span style="color:var(--color-neutral-700)">${f.label}</span><span style="font-family:var(--font-heading);font-weight:800">${f.value}</span></div>`).join('')}
  </div>`;
}

function relTime(dateIso) {
  const d = new Date(dateIso);
  const today = new Date();
  const diff = Math.round((today - d) / 86400000);
  if (diff <= 0) return 'today';
  if (diff === 1) return '1 day ago';
  if (diff < 14) return `${diff} days ago`;
  return `${Math.round(diff / 7)} weeks ago`;
}
