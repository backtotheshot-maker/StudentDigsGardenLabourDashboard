import { money, hours, dayLabel, isoDate, dowMon0, monthShortLabel, escapeHtml } from './utils.js';
import { enrichJobs, jobsOnDate, weekRange, hoursInRange, financeSummary, monthlySeries, monthToDate } from './derive.js';

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

      ${earningsSection(state, jobs)}

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
// Earnings card ("A2" from the design drafts): this month's profit as the
// headline, with revenue as the main line on the chart and profit as small
// bars underneath. Blues with a faint shimmer — these colours are local to
// this card on purpose, the rest of the dashboard keeps its green theme.
const EARN = {
  ink: '#141a2e',
  muted: '#4a5470',
  navy: '#1e3a8a',
  blue: '#1d4ed8',
  indigo: '#6366f1',
  sky: '#38bdf8',
  pillBg: '#e8f1fe',
  pillInk: '#1e40af',
  downBg: '#fdecec',
  downInk: '#9f1d1d',
  track: '#eef3fb',
};

function earningsSection(state, jobs) {
  const db = state.db;
  const range = [3, 6, 12].includes(state.earnRange) ? state.earnRange : 6;
  const monthly = monthlySeries(db, jobs, range);
  const hasAny = monthly.some((m) => m.revenue !== 0 || m.profit !== 0);

  const now = new Date();
  const cur = monthly[monthly.length - 1];
  const monthName = now.toLocaleString('en-GB', { month: 'long' });
  const kept = cur.revenue > 0 ? Math.trunc((cur.profit / cur.revenue) * 1000) / 10 : null;

  // Pace: this month's profit so far vs last month's profit by the same day.
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevName = prev.toLocaleString('en-GB', { month: 'long' });
  const thisSoFar = monthToDate(db, jobs, now.getFullYear(), now.getMonth(), now.getDate()).profit;
  const lastSoFar = monthToDate(db, jobs, prev.getFullYear(), prev.getMonth(), now.getDate()).profit;
  let pill = '';
  if (lastSoFar > 0) {
    const pct = Math.trunc(((thisSoFar - lastSoFar) / lastSoFar) * 1000) / 10;
    const up = pct >= 0;
    pill = `<span style="display:inline-flex;align-self:flex-start;align-items:center;gap:6px;background:${up ? EARN.pillBg : EARN.downBg};color:${up ? EARN.pillInk : EARN.downInk};border-radius:999px;padding:5px 10px;font-size:12px;font-weight:800">${up ? '▲' : '▼'} ${Math.abs(pct).toFixed(1)}% ${up ? 'ahead of' : 'behind'} ${prevName} at this point</span>`;
  }

  const toggle = [3, 6, 12].map((m) => {
    const on = m === range;
    return `<button data-act="earn-range" data-months="${m}" aria-pressed="${on}" style="border:0;border-radius:7px;padding:6px 12px;font:${on ? 800 : 600} 12px var(--font-heading);cursor:pointer;${on ? `background:linear-gradient(110deg,${EARN.blue},#2563eb 70%,${EARN.indigo});color:#fff` : `background:transparent;color:${EARN.muted}`}">${m}M</button>`;
  }).join('');

  const stat = (value, label) => `<div style="display:flex;flex-direction:column;gap:2px"><span style="font-family:var(--font-heading);font-size:18px;font-weight:800;color:${EARN.muted}">${value}</span><span style="font-size:11px;color:${EARN.muted}">${label}</span></div>`;

  return `
    <section style="margin-bottom:20px">
      <div style="border-radius:var(--radius-lg);padding:1px;background:linear-gradient(120deg,rgba(56,189,248,0.55),rgba(29,78,216,0.25) 40%,rgba(31,36,46,0.10) 60%,rgba(167,139,250,0.45))">
        <div style="border-radius:calc(var(--radius-lg) - 1px);background:radial-gradient(60% 70% at 100% 0%,rgba(56,189,248,0.07),rgba(255,255,255,0) 70%),#fff;box-shadow:0 1px 3px rgba(20,26,46,0.06),0 8px 24px rgba(29,78,216,0.06);padding:20px 22px;display:flex;flex-direction:column;gap:14px;color:${EARN.ink}">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
            <h2 style="font-size:20px;margin:0">Earnings</h2>
            <div role="group" aria-label="Months shown" style="display:flex;gap:4px;background:${EARN.track};border-radius:10px;padding:4px">${toggle}</div>
          </div>
          <div style="display:flex;gap:24px;flex-wrap:wrap;align-items:center">
            <div style="flex:0 1 220px;min-width:200px;display:flex;flex-direction:column;gap:16px">
              <div style="display:flex;flex-direction:column;gap:4px">
                <span style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${EARN.muted}">${escapeHtml(monthName)} profit so far</span>
                <span style="font-family:var(--font-heading);font-size:48px;font-weight:800;line-height:1;background:linear-gradient(100deg,${EARN.navy} 0%,${EARN.blue} 55%,#4f46e5 100%);-webkit-background-clip:text;background-clip:text;color:transparent">${money(cur.profit)}</span>
                <span style="font-size:12px;color:${EARN.muted}">kept after student pay and expenses</span>
              </div>
              ${pill}
              <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;border-top:1px solid rgba(20,26,46,0.10);padding-top:12px">
                ${stat(money(cur.revenue), 'revenue')}
                ${stat(kept == null ? '—' : `${kept.toFixed(1)}%`, 'of revenue kept')}
              </div>
            </div>
            <div style="flex:1 1 380px;min-width:0">
              ${hasAny ? earningsChart(monthly) : `<p style="font-size:13px;color:${EARN.muted};margin:8px 0">Nothing completed yet in this window — this fills in as jobs are marked done.</p>`}
            </div>
          </div>
        </div>
      </div>
    </section>`;
}

// Picks a round step for the y-axis so gridlines land on £50 / £500 / £1k etc.
function niceStep(max, ticks = 4) {
  const raw = max / ticks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return step * mag;
}

function axisMoney(v) {
  if (Math.abs(v) >= 1000) {
    const k = v / 1000;
    return `£${Number.isInteger(k) ? k : k.toFixed(1)}k`;
  }
  return `£${v}`;
}

function earningsChart(monthly) {
  const W = 620, H = 270;
  const padL = 44, padR = 14, padTop = 34, padBottom = 30;
  const plotW = W - padL - padR;
  const plotH = H - padTop - padBottom;
  const n = monthly.length;
  const bandW = plotW / n;
  const barW = Math.max(6, Math.min(20, bandW * 0.22));

  const maxRev = Math.max(1, ...monthly.map((m) => m.revenue), ...monthly.map((m) => m.profit));
  const minProfit = Math.min(0, ...monthly.map((m) => m.profit));
  const step = niceStep(maxRev);
  const topVal = Math.ceil(maxRev / step) * step;
  const bottomVal = minProfit < 0 ? -Math.ceil(-minProfit / step) * step : 0;
  const span = topVal - bottomVal || 1;
  const yOf = (v) => padTop + ((topVal - v) / span) * plotH;
  const xOf = (i) => padL + bandW * i + bandW / 2;
  const zeroY = yOf(0);

  const grid = [];
  for (let v = bottomVal; v <= topVal + 1e-9; v += step) {
    const y = yOf(v);
    grid.push(`<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="rgba(20,26,46,${v === 0 ? 0.22 : 0.08})"/>`);
    grid.push(`<text x="${padL - 8}" y="${y + 3.5}" text-anchor="end" font-size="10" fill="${EARN.muted}">${axisMoney(v)}</text>`);
  }

  const pts = monthly.map((m, i) => ({ x: xOf(i), y: yOf(Math.max(0, m.revenue)), m }));
  const done = pts.slice(0, -1);       // finished months: solid line
  const last2 = pts.slice(-2);         // current month: dashed, it's still in progress
  const solid = done.length >= 2 ? smoothPath(done, zeroY) : '';
  const area = done.length >= 2 ? `${solid} L ${done[done.length - 1].x},${zeroY} L ${done[0].x},${zeroY} Z` : '';
  const dashed = last2.length === 2 ? smoothPath(last2, zeroY) : '';

  // Profit bars from the zero line (downwards, in red, for a loss month).
  const bars = monthly.map((m, i) => {
    const cx = xOf(i);
    const isCur = i === n - 1;
    const label = `${monthShortLabel(m.year, m.month0)}: ${money(m.profit)} profit`;
    if (m.profit >= 0) {
      const top = yOf(m.profit);
      return `<path d="${roundedTopRect(cx - barW / 2, top, barW, zeroY, 3)}" fill="url(#earnBar)"${isCur ? ' opacity="0.6"' : ''}><title>${label}</title></path>`;
    }
    const h = yOf(m.profit) - zeroY;
    return `<rect x="${cx - barW / 2}" y="${zeroY}" width="${barW}" height="${h}" rx="2" fill="#f4a3a3"><title>${label}</title></rect>`;
  }).join('');

  const blues = ['#38bdf8', '#2f9cf4', '#2a7ff0', '#2563eb', '#4a5cee', '#5a5ff0'];
  const dots = pts.map(({ x, y, m }, i) => {
    const label = `${monthShortLabel(m.year, m.month0)}: ${money(m.revenue)} revenue`;
    if (i === n - 1) {
      return `<circle cx="${x}" cy="${y}" r="12" fill="${EARN.indigo}" opacity="0.14"/><circle cx="${x}" cy="${y}" r="6" fill="${EARN.indigo}"><title>${label} (so far)</title></circle>`;
    }
    const c = blues[Math.min(blues.length - 1, Math.floor((i / Math.max(1, n - 1)) * blues.length))];
    return `<circle cx="${x}" cy="${y}" r="${n > 8 ? 3 : 4}" fill="#fff" stroke="${c}" stroke-width="2.5"><title>${label}</title></circle>`;
  }).join('');

  // Callout on the best month so far.
  let best = 0;
  pts.forEach((p, i) => { if (p.m.revenue > pts[best].m.revenue) best = i; });
  const bp = pts[best];
  const calloutText = `${monthShortLabel(bp.m.year, bp.m.month0)} · ${money(bp.m.revenue)}`;
  const cw = Math.max(96, calloutText.length * 6.4 + 20);
  const cx = Math.min(W - padR - cw, Math.max(padL, bp.x - cw / 2));
  const callout = bp.m.revenue > 0 ? `
    <g><rect x="${cx}" y="${Math.max(2, bp.y - 34)}" width="${cw}" height="24" rx="6" fill="${EARN.ink}"/>
    <text x="${cx + cw / 2}" y="${Math.max(2, bp.y - 34) + 16}" text-anchor="middle" font-size="11" font-weight="800" fill="#fff">${calloutText}</text></g>` : '';

  const every = n > 8 ? 2 : 1;
  const labels = monthly.map((m, i) => {
    const isCur = i === n - 1;
    if (!isCur && (n - 1 - i) % every) return '';
    return `<text x="${xOf(i)}" y="${H - 10}" text-anchor="middle" font-size="11" ${isCur ? `font-weight="800" fill="${EARN.ink}"` : `fill="${EARN.muted}"`}>${monthShortLabel(m.year, m.month0)}</text>`;
  }).join('');

  const legend = `
    <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:11px;color:${EARN.muted};margin-top:4px">
      <span style="display:inline-flex;align-items:center;gap:6px"><span style="width:18px;height:3px;border-radius:2px;background:linear-gradient(90deg,${EARN.sky},${EARN.blue},${EARN.indigo})"></span>Revenue</span>
      <span style="display:inline-flex;align-items:center;gap:6px"><span style="width:10px;height:10px;border-radius:2px;background:linear-gradient(0deg,#7dd3fc,#a5b4fc)"></span>Profit</span>
      <span style="display:inline-flex;align-items:center;gap:6px"><span style="width:18px;border-top:3px dashed ${EARN.indigo}"></span>This month, so far</span>
    </div>`;

  const tableRows = monthly.map((m) => `<tr><td>${monthShortLabel(m.year, m.month0)} ${m.year}</td><td>${money(m.revenue)}</td><td>${money(m.profit)}</td></tr>`).join('');
  const visuallyHidden = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0';

  return `
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;font-family:var(--font-heading)" role="img" aria-label="Monthly revenue as a line and profit as bars for the last ${n} months">
      <defs>
        <linearGradient id="earnLine" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${EARN.sky}"/><stop offset="0.55" stop-color="${EARN.blue}"/><stop offset="1" stop-color="${EARN.indigo}"/></linearGradient>
        <linearGradient id="earnFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b82f6" stop-opacity="0.2"/><stop offset="1" stop-color="#3b82f6" stop-opacity="0"/></linearGradient>
        <linearGradient id="earnBar" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#7dd3fc"/><stop offset="1" stop-color="#a5b4fc"/></linearGradient>
        <filter id="earnGlow" x="-10%" y="-50%" width="120%" height="200%"><feGaussianBlur stdDeviation="4"/></filter>
      </defs>
      ${grid.join('')}
      ${area ? `<path d="${area}" fill="url(#earnFill)"/>` : ''}
      ${solid ? `<path d="${solid}" fill="none" stroke="url(#earnLine)" stroke-width="6" opacity="0.25" filter="url(#earnGlow)"/>
      <path d="${solid}" fill="none" stroke="url(#earnLine)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
      ${dashed ? `<path d="${dashed}" fill="none" stroke="${EARN.indigo}" stroke-width="3" stroke-dasharray="6 6" stroke-linecap="round"/>` : ''}
      ${bars}
      ${dots}
      ${callout}
      ${labels}
    </svg>
    ${legend}
    <table style="${visuallyHidden}"><caption>Monthly revenue and profit</caption><thead><tr><th>Month</th><th>Revenue</th><th>Profit</th></tr></thead><tbody>${tableRows}</tbody></table>`;
}

// Catmull-Rom → cubic Bézier, so the revenue line reads as one smooth curve
// rather than sharp joins between months. Control points are clamped at
// `maxY` (the £0 line) so the curve never dips below zero between months.
function smoothPath(pts, maxY = Infinity) {
  const cl = (y) => Math.min(y, maxY);
  if (pts.length < 2) return pts.length ? `M ${pts[0].x},${pts[0].y}` : '';
  let d = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = cl(p1.y + (p2.y - p0.y) / 6);
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = cl(p2.y - (p3.y - p1.y) / 6);
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
