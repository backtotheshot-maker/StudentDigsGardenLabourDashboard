import { money, hours, shortName, initials, fmtTime, tagStyle, statusTone, monthLabel, isoDate, dowMon0, escapeHtml, workLabel } from './utils.js';
import { enrichJobs, monthWindow, jobsInMonth, jobsOnDate } from './derive.js';

const DOW_HEADS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

export function renderCalendar(state) {
  const jobs = enrichJobs(state.db);
  const monthJobs = jobsInMonth(jobs, state.calYear, state.calMonth0);
  const totalHours = monthJobs.reduce((s, j) => s + j.hours, 0);
  const totalBilled = monthJobs.reduce((s, j) => s + j.billed, 0);

  const seg = `
    <div class="seg">
      <label class="seg-opt"><input type="radio" name="calview" data-act="cal-view" data-view="month" ${state.calView === 'month' ? 'checked' : ''}><span>Month</span></label>
      <label class="seg-opt"><input type="radio" name="calview" data-act="cal-view" data-view="agenda" ${state.calView === 'agenda' ? 'checked' : ''}><span>Agenda</span></label>
    </div>`;

  const header = `
    <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:12px">
      <div>
        <div style="display:flex;align-items:baseline;gap:10px">
          <button class="btn btn-ghost" data-act="cal-prev" aria-label="Previous month">‹</button>
          <h1 style="font-size:32px;margin:0">${monthLabel(state.calYear, state.calMonth0)}</h1>
          <button class="btn btn-ghost" data-act="cal-next" aria-label="Next month">›</button>
        </div>
        <p style="margin:2px 0 0;font-size:13px;color:var(--color-neutral-700)">${monthJobs.length} jobs booked · ${hours(totalHours)} · ${money(totalBilled, { headline: true })} of work</p>
      </div>
      <div style="display:flex;gap:8px;align-items:center">${seg}</div>
    </div>`;

  return `<div>${header}${state.calView === 'month' ? monthView(state, jobs) : agendaView(state, jobs)}</div>`;
}

function monthView(state, jobs) {
  const cells = monthWindow(state.calYear, state.calMonth0);
  const todayIso = isoDate(new Date());

  const headRow = DOW_HEADS.map((d) => `<div style="padding:6px 8px;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:var(--color-neutral-700)">${d}</div>`).join('');

  const cellsHtml = cells.map((d) => {
    const dateIso = isoDate(d);
    const inMonth = d.getMonth() === state.calMonth0;
    const dayJobs = jobsOnDate(jobs, dateIso);
    const dayHours = dayJobs.reduce((s, j) => s + j.hours, 0);
    const isToday = dateIso === todayIso;
    const isSelected = dateIso === state.dayKey;

    const cellStyle = [
      'padding:6px;border-right:1px solid var(--color-divider);border-bottom:1px solid var(--color-divider);min-height:96px;display:flex;flex-direction:column;gap:4px;cursor:pointer;',
      !inMonth ? 'background: color-mix(in srgb, var(--color-text) 4%, transparent);' : '',
      isSelected ? 'outline:2px solid var(--color-text);outline-offset:-2px;' : '',
    ].join('');

    const numStyle = isToday
      ? 'font-family:var(--font-heading);font-weight:800;font-size:13px;background:var(--color-accent);color:var(--color-bg);padding:1px 6px;'
      : `font-family:var(--font-heading);font-weight:800;font-size:13px;${!inMonth ? 'color:var(--color-neutral-500);' : ''}`;

    const shown = dayJobs.slice(0, 2);
    const overflow = dayJobs.length - shown.length;

    const chips = shown.map((j) => {
      const { tone } = statusTone(j.stage);
      const chipStyle = `padding:3px 5px;font-size:10px;line-height:1.25;cursor:pointer;${tagBg(tone)}`;
      return `<div data-act="select-job" data-id="${j.id}" style="${chipStyle}">
        <span style="font-weight:800;font-family:var(--font-heading)">${initials(j.employee?.name)}</span> ${escapeHtml(shortName(j.homeowner?.name || ''))}
        <span style="display:block;font-size:9px;opacity:0.85">${fmtTime(j.start_time)} · ${hours(j.hours)}</span>
      </div>`;
    }).join('');

    return `
      <div data-act="select-day" data-date="${dateIso}" style="${cellStyle}">
        <div style="display:flex;justify-content:space-between;align-items:baseline">
          <span style="${numStyle}">${d.getDate()}</span>
          <span style="font-size:10px;color:var(--color-neutral-700)">${dayHours ? hours(dayHours) : ''}</span>
        </div>
        ${chips}
        ${overflow > 0 ? `<span style="font-size:10px;color:var(--color-neutral-700)">+${overflow} more</span>` : ''}
      </div>`;
  }).join('');

  return `
    <div>
      <div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));border-top:2px solid var(--color-divider);border-bottom:1px solid var(--color-divider)">${headRow}</div>
      <div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));border-left:1px solid var(--color-divider)">${cellsHtml}</div>
      <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:11px;color:var(--color-neutral-700);margin-top:12px">
        <span style="display:flex;align-items:center;gap:6px"><span style="width:11px;height:11px;background:var(--color-accent-200);border-left:3px solid var(--color-accent);display:inline-block"></span>Booked</span>
        <span style="display:flex;align-items:center;gap:6px"><span style="width:11px;height:11px;background:var(--color-accent-2-200);border-left:3px solid var(--color-accent-2-600);display:inline-block"></span>Done, to pay</span>
        <span style="display:flex;align-items:center;gap:6px"><span style="width:11px;height:11px;background:var(--color-neutral-200);border-left:3px solid var(--color-neutral-500);display:inline-block"></span>Paid</span>
      </div>
    </div>`;
}

function tagBg(tone) {
  if (tone === 'good') return 'background:var(--color-accent-200);border-left:3px solid var(--color-accent);color:var(--color-accent-800);';
  if (tone === 'warn') return 'background:var(--color-accent-2-200);border-left:3px solid var(--color-accent-2-600);color:var(--color-accent-2-800);';
  return 'background:var(--color-neutral-200);border-left:3px solid var(--color-neutral-500);color:var(--color-neutral-800);';
}

function agendaView(state, jobs) {
  const monthJobs = jobsInMonth(jobs, state.calYear, state.calMonth0);
  const byDate = {};
  for (const j of monthJobs) (byDate[j.date] ||= []).push(j);
  const dates = Object.keys(byDate).sort();

  const rows = dates.map((dateIso) => {
    const dayJobs = byDate[dateIso].sort((a, b) => a.start_time.localeCompare(b.start_time));
    const d = new Date(dateIso);
    const totalHours = dayJobs.reduce((s, j) => s + j.hours, 0);
    const jobsHtml = dayJobs.map((j) => {
      const { tone, label } = statusTone(j.stage);
      return `
        <div data-act="select-job" data-id="${j.id}" style="display:flex;gap:12px;align-items:baseline;cursor:pointer;flex-wrap:wrap">
          <span style="font-size:12px;color:var(--color-neutral-700);min-width:44px">${fmtTime(j.start_time)}</span>
          <span style="font-size:14px;font-family:var(--font-heading);font-weight:800">${escapeHtml(j.homeowner?.name || '—')}</span>
          <span style="font-size:12px;color:var(--color-neutral-700)">${escapeHtml(j.employee?.name || '—')} · ${escapeHtml(workLabel(j))} · ${hours(j.hours)}</span>
          <span style="${tagStyle(tone)}">${label}</span>
        </div>`;
    }).join('');
    return `
      <div style="display:flex;gap:16px;padding:12px 0;border-bottom:1px solid var(--color-divider);flex-wrap:wrap">
        <div style="flex:0 0 92px">
          <div style="font-family:var(--font-heading);font-weight:800;font-size:15px">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][dowMon0(d)]} ${d.getDate()}</div>
          <div style="font-size:11px;color:var(--color-neutral-700)">${hours(totalHours)}</div>
        </div>
        <div style="flex:1 1 260px;min-width:0;display:flex;flex-direction:column;gap:6px">${jobsHtml}</div>
      </div>`;
  }).join('') || `<p style="font-size:13px;color:var(--color-neutral-700);padding:16px 0">No jobs this month.</p>`;

  return `<div style="border-top:2px solid var(--color-divider)">${rows}</div>`;
}
