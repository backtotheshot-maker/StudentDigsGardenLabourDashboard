import { money, hours, dayLabel, isoDate, dowMon0, monthShortLabel, escapeHtml } from './utils.js';
import { enrichJobs, jobsOnDate, weekRange, hoursInRange, financeSummary, monthlySeries } from './derive.js';

const DOW = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const CARD = 'border:1px solid var(--color-divider);border-radius:var(--radius-md);box-shadow:var(--shadow-sm);background:var(--color-bg);';

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
    <div style="${CARD}padding:14px;display:flex;flex-direction:column;gap:4px">
      ${t.trend ? `<span style="font-size:12px;font-weight:800;color:${t.trend.up ? 'var(--color-accent-700)' : 'var(--color-accent-2-800)'}">${t.trend.up ? '▲' : '▼'} ${t.trend.pct}% vs last week</span>` : '<span style="font-size:12px;color:transparent">·</span>'}
      <span style="font-family:var(--font-heading);font-weight:800;font-size:30px;line-height:1.1">${t.value}</span>
      <span style="font-size:11px;letter-spacing:0.04em;color:var(--color-neutral-700)">${t.label}</span>
    </div>`).join('');

  return `
    <div>
      <h1 style="font-size:32px;margin:0 0 2px">Home</h1>
      <p style="margin:0 0 16px;font-size:13px;color:var(--color-neutral-700)">A snapshot of the business, updated as you go.</p>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:20px">${tilesHtml}</div>

      ${earningsSection(state.db, jobs)}

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
  const cells = thisWeek.days.map((d, i) => {
    const dateIso = isoDate(d);
    const dayJobs = jobsOnDate(jobs, dateIso);
    const dayHours = dayJobs.reduce((s, j) => s + j.hours, 0);
    const isToday = dateIso === todayIso;
    return `
      <div data-act="home-open-day" data-date="${dateIso}" style="flex:1;min-width:0;padding:10px 8px;${i < 6 ? 'border-right:1px solid var(--color-divider);' : ''}cursor:pointer;transition:background-color .12s ease;${isToday ? 'background:var(--color-accent-100);' : ''}">
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
      <div style="display:flex;${CARD}overflow:hidden">${cells}</div>
    </section>`;
}

// ---- earnings chart ------------------------------------------------------
// Hand-rolled inline SVG (no charting library, matching the rest of the
// app's zero-dependency approach): revenue as bars, profit as a smoothed
// line sharing the same £ axis — legitimate on one scale since both series
// are the same unit, not a dual-axis chart. Native <title> elements give
// every mark a zero-JS hover tooltip.
function earningsSection(db, jobs) {
  const monthly = monthlySeries(db, jobs, 6);
  const hasAny = monthly.some((m) => m.revenue !== 0 || m.profit !== 0);

  return `
    <section style="margin-bottom:20px">
      <div style="display:flex;justify-content:space-between;align-items:baseline;border-bottom:2px solid var(--color-divider);padding-bottom:6px;margin-bottom:8px;flex-wrap:wrap;gap:8px">
        <h2 style="font-size:17px;margin:0">Earnings</h2>
        <span style="font-size:11px;color:var(--color-neutral-700)">Last 6 months</span>
      </div>
      <div style="${CARD}padding:16px">
        ${hasAny ? earningsChart(monthly) : '<p style="font-size:13px;color:var(--color-neutral-700);margin:8px 0">Nothing completed yet in this window — this fills in as jobs are marked done.</p>'}
      </div>
    </section>`;
}

function earningsChart(monthly) {
  const W = 640, H = 220;
  const padTop = 20, padBottom = 28, padX = 6;
  const plotW = W - padX * 2;
  const plotH = H - padTop - padBottom;
  const n = monthly.length;
  const bandW = plotW / n;
  const barW = Math.min(26, bandW * 0.4);

  const revenues = monthly.map((m) => m.revenue);
  const profits = monthly.map((m) => m.profit);
  const maxVal = Math.max(1, ...revenues, ...profits);
  const minVal = Math.min(0, ...profits);
  const hasNegative = minVal < 0;
  const topVal = maxVal * 1.18;
  const bottomVal = hasNegative ? minVal * 1.18 : 0;
  const span = topVal - bottomVal || 1;

  const yOf = (v) => padTop + (topVal - v) / span * plotH;
  const xOf = (i) => padX + bandW * i + bandW / 2;
  const zeroY = yOf(0);

  // Direct end-labels ride the last bar and last dot. The profit label sits
  // above the dot when profit is positive but below it when negative, so it
  // moves away from the zero line (and the revenue bar, which always occupies
  // the band between zero and its own top) instead of landing inside it. As a
  // last safety net, if the two end-labels still land close together, the
  // revenue one is dropped rather than stacking colliding labels (see
  // dataviz anti-patterns) — its value is still on the bar's hover tooltip.
  const lastRevenue = Math.max(0, monthly[n - 1].revenue);
  const lastProfit = monthly[n - 1].profit;
  const lastRevenueLabelY = yOf(lastRevenue) - 8;
  const lastProfitLabelY = lastProfit >= 0 ? yOf(lastProfit) - 12 : yOf(lastProfit) + 18;
  const labelsCollide = Math.abs(lastRevenueLabelY - lastProfitLabelY) < 16;

  const bars = monthly.map((m, i) => {
    const cx = xOf(i);
    const x = cx - barW / 2;
    const top = yOf(Math.max(0, m.revenue));
    const bottom = zeroY;
    const isLast = i === n - 1;
    const showLabel = isLast && m.revenue > 0 && !labelsCollide;
    return `
      <path d="${roundedTopRect(x, top, barW, bottom, 4)}" fill="var(--color-accent-200)" stroke="var(--color-accent-400)" stroke-width="1">
        <title>${monthShortLabel(m.year, m.month0)}: ${money(m.revenue, { headline: true })} revenue</title>
      </path>
      ${showLabel ? `<text x="${cx}" y="${top - 8}" text-anchor="middle" font-size="11" font-weight="800" font-family="var(--font-heading)" fill="var(--color-text)">${money(m.revenue, { headline: true })}</text>` : ''}`;
  }).join('');

  const points = monthly.map((m, i) => ({ x: xOf(i), y: yOf(m.profit), m }));
  const linePath = smoothPath(points);

  const dots = points.map(({ x, y, m }, i) => {
    const isLast = i === n - 1;
    const labelY = m.profit >= 0 ? y - 12 : y + 18;
    return `
      <circle cx="${x}" cy="${y}" r="4" fill="var(--color-accent-700)" stroke="var(--color-bg)" stroke-width="2">
        <title>${monthShortLabel(m.year, m.month0)}: ${money(m.profit, { headline: true })} profit</title>
      </circle>
      ${isLast ? `<text x="${x}" y="${labelY}" text-anchor="middle" font-size="11" font-weight="800" font-family="var(--font-heading)" fill="var(--color-accent-700)">${money(m.profit, { headline: true })}</text>` : ''}`;
  }).join('');

  const labels = monthly.map((m, i) => `<text x="${xOf(i)}" y="${H - 8}" text-anchor="middle" font-size="10" letter-spacing="0.04em" fill="var(--color-neutral-700)">${monthShortLabel(m.year, m.month0).toUpperCase()}</text>`).join('');

  const zeroLine = hasNegative ? `
    <line x1="${padX}" y1="${zeroY}" x2="${W - padX}" y2="${zeroY}" stroke="var(--color-divider)" stroke-width="1" stroke-dasharray="3,3"/>
    <text x="${padX}" y="${zeroY - 4}" font-size="9" fill="var(--color-neutral-700)">£0</text>` : '';

  const legend = `
    <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:6px">
      <span style="display:inline-flex;align-items:center;gap:6px;font-size:11px;color:var(--color-neutral-700)"><span style="width:10px;height:10px;border-radius:2px;background:var(--color-accent-200);border:1px solid var(--color-accent-400);display:inline-block"></span>Revenue</span>
      <span style="display:inline-flex;align-items:center;gap:6px;font-size:11px;color:var(--color-neutral-700)"><span style="width:14px;height:2px;background:var(--color-accent-700);display:inline-block"></span><span style="width:6px;height:6px;border-radius:50%;background:var(--color-accent-700);display:inline-block;margin-left:-4px"></span>Profit</span>
    </div>`;

  const tableRows = monthly.map((m) => `<tr><td>${monthShortLabel(m.year, m.month0)} ${m.year}</td><td>${money(m.revenue)}</td><td>${money(m.profit)}</td></tr>`).join('');
  const visuallyHidden = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0';

  return `
    ${legend}
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" role="img" aria-label="Monthly revenue and profit for the last ${n} months">
      ${zeroLine}
      ${bars}
      <path d="${linePath}" fill="none" stroke="var(--color-accent-700)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      ${dots}
      ${labels}
    </svg>
    <table style="${visuallyHidden}"><caption>Monthly revenue and profit</caption><thead><tr><th>Month</th><th>Revenue</th><th>Profit</th></tr></thead><tbody>${tableRows}</tbody></table>`;
}

// Catmull-Rom → cubic Bézier, so the profit line reads as one smooth curve
// rather than sharp joins between months.
function smoothPath(pts) {
  if (pts.length < 2) return pts.length ? `M ${pts[0].x},${pts[0].y}` : '';
  let d = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return d;
}

// A bar rounded only where it meets the data-end (top, since these bars grow
// up from a zero baseline) and square where it meets the baseline — per the
// house style for bar marks.
function roundedTopRect(x, yTop, w, yBottom, r) {
  const rr = Math.min(r, (yBottom - yTop) / 2, w / 2);
  if (!(yBottom > yTop) || rr <= 0) return `M ${x},${yBottom} L ${x + w},${yBottom} L ${x + w},${yTop} L ${x},${yTop} Z`;
  return `M ${x},${yBottom} L ${x},${yTop + rr} Q ${x},${yTop} ${x + rr},${yTop} L ${x + w - rr},${yTop} Q ${x + w},${yTop} ${x + w},${yTop + rr} L ${x + w},${yBottom} Z`;
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
    <div style="${CARD}padding:12px;margin-bottom:16px;display:flex;flex-direction:column;gap:8px">
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
