import { money, tagStyle, escapeHtml } from '../utils.js';
import { enrichJobs } from '../derive.js';

export function renderHomeowners(state) {
  const jobs = enrichJobs(state.db);
  const query = (state.homeownerSearch || '').trim().toLowerCase();

  const rows = state.db.clients
    .filter((c) => !query || c.name.toLowerCase().includes(query) || (c.address || '').toLowerCase().includes(query))
    .map((c) => {
      const employee = state.db.employees.find((e) => e.id === c.primary_employee_id);
      const theirJobs = jobs.filter((j) => j.client_id === c.id);
      const billed = theirJobs.reduce((s, j) => s + j.billed, 0);
      const lastDone = theirJobs.filter((j) => j.status !== 'booked').sort((a, b) => b.date.localeCompare(a.date))[0];
      const sourceTone = c.source === 'Referral' ? 'good' : 'flat';
      return { c, employee, jobCount: theirJobs.length, billed, last: lastDone };
    });

  const totalBilled = rows.reduce((s, r) => s + r.billed, 0);

  const trs = rows.map(({ c, employee, jobCount, billed, last }) => `
    <tr>
      <td style="font-family:var(--font-heading);font-weight:800">${escapeHtml(c.name)}<div style="font-size:11px;font-weight:400;color:var(--color-neutral-700)">${escapeHtml(c.address || '')}${c.city ? ', ' + escapeHtml(c.city) : ''}</div></td>
      <td style="font-size:13px">${escapeHtml(employee?.name || '—')}</td>
      <td style="font-size:13px">${escapeHtml(c.notes || '—')}</td>
      <td style="font-size:13px">${last ? last.date : '—'}</td>
      <td style="text-align:right">${jobCount}</td>
      <td style="text-align:right;font-family:var(--font-heading);font-weight:800">${money(billed)}</td>
      <td>${c.source ? `<span style="${tagStyle(c.source === 'Referral' ? 'good' : 'flat')}">${escapeHtml(c.source)}</span>` : ''}</td>
    </tr>`).join('');

  return `
    <div>
      <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap;margin-bottom:12px">
        <div>
          <h1 style="font-size:32px;margin:0 0 2px">Homeowners</h1>
          <p style="margin:0;font-size:13px;color:var(--color-neutral-700)">${state.db.clients.length} on the books · ${money(totalBilled, { headline: true })} billed this term</p>
        </div>
        <input class="input" style="width:190px" placeholder="Search homeowners" data-act="search-homeowners" value="${escapeHtml(state.homeownerSearch || '')}">
      </div>
      <div style="overflow-x:auto;border-top:2px solid var(--color-divider)">
        <table class="table" style="min-width:700px">
          <thead><tr><th>Homeowner</th><th>Their student</th><th>Work</th><th>Last visit</th><th style="text-align:right">Jobs</th><th style="text-align:right">Billed</th><th>Source</th></tr></thead>
          <tbody>${trs || `<tr><td colspan="7" style="padding:16px 0;color:var(--color-neutral-700)">No homeowners match.</td></tr>`}</tbody>
        </table>
      </div>
    </div>`;
}
