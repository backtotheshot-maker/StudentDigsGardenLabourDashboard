import { tagStyle, escapeHtml } from '../utils.js';
import { handoverList } from '../derive.js';

export function renderHandovers(state) {
  const list = handoverAll(state);
  const rows = list.map((h) => {
    let statusTag, action, dataAct;
    if (h.first_booking_date) {
      statusTag = `<span style="${tagStyle('good')}">Booked in</span>`;
      action = `<button class="btn btn-ghost" data-act="open-client" data-id="${h.id}">View</button>`;
    } else if (h.chasedToday) {
      statusTag = `<span style="${tagStyle('flat')}">Chased today</span>`;
      action = `<button class="btn btn-ghost" data-act="nudge" data-id="${h.id}">Chase again</button>`;
    } else {
      statusTag = `<span style="${tagStyle('warn')}">Waiting on student</span>`;
      action = `<button class="btn btn-ghost" data-act="nudge" data-id="${h.id}">Nudge ${escapeHtml((h.employee?.name || '').split(' ')[0] || '')}</button>`;
    }
    return `
      <tr>
        <td style="font-family:var(--font-heading);font-weight:800">${escapeHtml(h.name)}<div style="font-size:11px;font-weight:400;color:var(--color-neutral-700)">${escapeHtml(h.address || '')}${h.city ? ', ' + escapeHtml(h.city) : ''}</div></td>
        <td style="font-size:13px">${escapeHtml(h.employee?.name || '—')}</td>
        <td style="font-size:13px">${h.handed_over_date || '—'}<div style="font-size:11px;color:var(--color-neutral-700)">${h.first_booking_date ? 'first booking ' + h.first_booking_date : 'not booked yet'}</div></td>
        <td>${statusTag}</td>
        <td style="text-align:right">${action}</td>
      </tr>`;
  }).join('');

  return `
    <div>
      <h1 style="font-size:32px;margin:0 0 2px">Handovers</h1>
      <p style="margin:0 0 16px;font-size:13px;color:var(--color-neutral-700);max-width:62ch">Every homeowner you've passed to a student. Once it's booked in the app, they run it between themselves — you only come back to pay.</p>
      <div style="overflow-x:auto;border-top:2px solid var(--color-divider)">
        <table class="table" style="min-width:640px">
          <thead><tr><th>Homeowner</th><th>Handed to</th><th>Handed over</th><th>Status</th><th style="text-align:right"></th></tr></thead>
          <tbody>${rows || `<tr><td colspan="5" style="padding:16px 0;color:var(--color-neutral-700)">No handovers logged yet.</td></tr>`}</tbody>
        </table>
      </div>
    </div>`;
}

function handoverAll(state) {
  // Every homeowner that's been handed to a student, booked or not (the
  // right-rail "To chase" list only shows the unbooked ones — this table is everyone).
  return state.db.clients
    .filter((c) => c.handed_over_date)
    .map((c) => {
      const employee = state.db.employees.find((e) => e.id === c.primary_employee_id);
      const chasedToday = c.last_nudged_at && c.last_nudged_at.slice(0, 10) === new Date().toISOString().slice(0, 10);
      return { ...c, employee, chasedToday };
    })
    .sort((a, b) => (b.handed_over_date || '').localeCompare(a.handed_over_date || ''));
}

export { handoverAll };
