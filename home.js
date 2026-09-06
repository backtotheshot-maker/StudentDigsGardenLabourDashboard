import { money, hours, dayLabel, isoDate, dowMon0, escapeHtml } from './utils.js';
import { enrichJobs, jobsOnDate, weekRange, hoursInRange, financeSummary } from './derive.js';

const DOW = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

export function renderHome(state) {
  const jobs = enrichJobs(state.db);
  const finance = financeSummary(state.db, jobs);

  const thisWeek = weekRange(0);
  const lastWeek = weekRange(-1);
  const thisWeekHours = hoursInRange(jobs, thisWeek.start, thisWeek.end);
  const lastWeekHours = hoursInRange(jobs, lastWeek.start, lastWeek.end);
  const hoursTrend = trend(thisWeekHours, lastWeekHours);

  const tiles = [
    { label: 'All-time revenue', value: money(finance.revenue, { headline: true }) },
    { label: 'All-time profit', value: money(finance.profit, { headline: true }) },
    { label: 'Hours booked this week', value: hours(thisWeekHours), trend: hoursTrend },
  ];

  const tilesHtml = tiles.map((t) => `
    <div style="border:2px solid var(--color-divider);padding:14px;display:flex;flex-direction:column;gap:4px">
      ${t.trend ? `<span style="font-size:12px;font-weight:800;color:${t.trend.up ? 'var(--color-accent-700)' : 'var(--color-accent-2-800)'}">${t.trend.up ? '▲' : '▼'} ${t.trend.pct}% vs last week</span>` : '<span style="font-size:12px;color:transparent">·</span>'}
      <span style="font-family:var(--font-heading);font-weight:800;font-size:30px;line-height:1.1">${t.value}</span>
      <span style="font-size:11px;letter-spacing:0.04em;color:var(--color-neutral-700)">${t.label}</span>
    </div>`).join('');

  return `
    <div>
      <h1 style="font-size:32px;margin:0 0 2px">Home</h1>
      <p style="margin:0 0 16px;font-size:13px;color:var(--color-neutral-700)">A snapshot of the business, updated as you go.</p>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:20px">${tilesHtml}</div>

      ${weekStrip(state, jobs, thisWeek)}

      ${expensesSection(state, finance, state.db.expenses || [])}
    </div>`;
}

function trend(current, previous) {
  if (previous <= 0) {
    if (current <= 0) return null;
    return { up: true, pct: 100 };
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  return { up: pct >= 0, pct: Math.abs(pct) };
}

function weekStrip(state, jobs, thisWeek) {
  const todayIso = isoDate(new Date());
  const cells = thisWeek.days.map((d) => {
    const dateIso = isoDate(d);
    const dayJobs = jobsOnDate(jobs, dateIso);
    const dayHours = dayJobs.reduce((s, j) => s + j.hours, 0);
    const isToday = dateIso === todayIso;
    return `
      <div data-act="home-open-day" data-date="${dateIso}" style="flex:1;min-width:0;padding:10px 8px;border-right:1px solid var(--color-divider);cursor:pointer;${isToday ? 'background:var(--color-accent-100);' : ''}">
        <div style="font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:var(--color-neutral-700)">${DOW[dowMon0(d)]}</div>
        <div style="font-family:var(--font-heading);font-weight:800;font-size:18px">${d.getDate()}</div>
        <div style="font-size:11px;color:var(--color-neutral-700)">${dayJobs.length ? `${dayJobs.length} job${dayJobs.length === 1 ? '' : 's'} · ${hours(dayHours)}` : '—'}</div>
      </div>`;
  }).join('');

  return `
    <section style="margin-bottom:20px">
      <div style="display:flex;justify-content:space-between;align-items:baseline;border-bottom:2px solid var(--color-divider);padding-bottom:6px;margin-bottom:8px">
        <h2 style="font-size:17px;margin:0">This week</h2>
        <button class="btn btn-ghost" data-act="nav" data-screen="calendar">Full calendar →</button>
      </div>
      <div style="display:flex;border:2px solid var(--color-divider);border-right:0;overflow-x:auto">${cells}</div>
    </section>`;
}

function expensesSection(state, finance, expenses) {
  const monthlies = expenses.filter((e) => e.type === 'monthly');
  const oneOffs = expenses.filter((e) => e.type === 'one_off');

  return `
    <section>
      <div style="display:flex;justify-content:space-between;align-items:baseline;border-bottom:2px solid var(--color-divider);padding-bottom:6px;margin-bottom:8px;flex-wrap:wrap;gap:8px">
        <h2 style="font-size:17px;margin:0">Expenses</h2>
        <button class="btn ${state.showExpenseForm ? 'btn-secondary' : 'btn-primary'}" data-act="toggle-expense-form">${state.showExpenseForm ? 'Cancel' : '+ Add expense'}</button>
      </div>
      ${state.showExpenseForm ? expenseForm() : ''}
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:24px">
        <div>
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:var(--color-neutral-700);margin-bottom:6px">Monthly · ${money(finance.monthlyRunRate)}/mo run-rate</div>
          ${monthlies.length ? monthlies.map(monthlyRow).join('') : '<p style="font-size:13px;color:var(--color-neutral-700)">None yet — direct debits like insurance go here.</p>'}
        </div>
        <div>
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:var(--color-neutral-700);margin-bottom:6px">One-off</div>
          ${oneOffs.length ? oneOffs.slice(0, 10).map(oneOffRow).join('') : '<p style="font-size:13px;color:var(--color-neutral-700)">None yet.</p>'}
        </div>
      </div>
    </section>`;
}

function expenseForm() {
  const today = isoDate(new Date());
  return `
    <div style="border:2px solid var(--color-divider);padding:12px;margin-bottom:16px;display:flex;flex-direction:column;gap:8px">
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <div class="field" style="flex:2 1 180px"><label>Description</label><input class="input" id="expense-desc" placeholder="e.g. Public liability insurance"></div>
        <div class="field" style="flex:1 1 100px"><label>Amount</label><input class="input" id="expense-amount" type="number" step="0.01" min="0" placeholder="0.00"></div>
        <div class="field" style="flex:1 1 150px"><label>Type</label>
          <select class="input" id="expense-type">
            <option value="one_off">One-off</option>
            <option value="monthly">Monthly (direct debit)</option>
          </select>
        </div>
        <div class="field" style="flex:1 1 140px"><label>Date</label><input class="input" id="expense-date" type="date" value="${today}"></div>
      </div>
      <button class="btn btn-primary" style="align-self:flex-start" data-act="add-expense">Add expense</button>
    </div>`;
}

function monthlyRow(e) {
  const stopped = !!e.ended_date;
  return `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;padding:9px 0;border-bottom:1px solid var(--color-divider)">
      <div>
        <div style="font-size:13px;font-family:var(--font-heading);font-weight:800">${escapeHtml(e.description)}</div>
        <div style="font-size:11px;color:var(--color-neutral-700)">${money(e.amount)}/mo since ${dayLabel(e.date, { withYear: true })}${stopped ? ` · stopped ${dayLabel(e.ended_date, { withYear: true })}` : ''}</div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        ${!stopped ? `<button class="btn btn-ghost" data-act="stop-expense" data-id="${e.id}">Stop</button>` : ''}
        <button class="btn btn-ghost" data-act="delete-expense" data-id="${e.id}">Delete</button>
      </div>
    </div>`;
}

function oneOffRow(e) {
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:9px 0;border-bottom:1px solid var(--color-divider)">
      <div>
        <div style="font-size:13px;font-family:var(--font-heading);font-weight:800">${escapeHtml(e.description)}</div>
        <div style="font-size:11px;color:var(--color-neutral-700)">${dayLabel(e.date, { withYear: true })}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
        <span style="font-family:var(--font-heading);font-weight:800">${money(e.amount)}</span>
        <button class="btn btn-ghost" data-act="delete-expense" data-id="${e.id}">Delete</button>
      </div>
    </div>`;
}
