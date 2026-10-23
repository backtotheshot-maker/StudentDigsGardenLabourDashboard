import { money, hours, dayLabel, fmtTime, escapeHtml } from './utils.js';
import { enrichJobs, owedSummary, readySummary, paymentGroups } from './derive.js';
import { EMPLOYEE_PAY_RATE } from './config.js';

const STEPS = [
  { label: 'Check the work' },
  { label: 'Amounts & your margin' },
  { label: 'Send it' },
];

export function renderPayments(state) {
  if (state.paid) return paidConfirmation(state);

  const jobs = enrichJobs(state.db);
  const owed = owedSummary(jobs);
  const ready = readySummary(jobs);
  const doneJobs = jobs.filter((j) => j.stage === 'done');
  const confirmed = doneJobs.filter((j) => j.review_status === 'confirmed').length;
  const queried = doneJobs.filter((j) => j.review_status === 'queried').length;

  const stepNotes = [
    doneJobs.length ? `${confirmed} of ${doneJobs.length} confirmed` : 'nothing waiting',
    money(ready.pay, { headline: true }),
    `${ready.students} to pay`,
  ];

  const steps = STEPS.map((s, i) => {
    const active = state.payStep === i;
    return `
      <button data-act="pay-step" data-step="${i}" style="padding:8px 12px;border:0;font-family:var(--font-heading);font-weight:800;font-size:13px;text-align:left;cursor:pointer;${active ? 'background:var(--color-accent);color:var(--color-bg);' : 'background:var(--color-surface);color:var(--color-text);'}">
        ${i + 1} · ${s.label}<span style="display:block;font-size:10px;opacity:0.8">${stepNotes[i]}</span>
      </button>`;
  }).join('');

  const body = state.payStep === 0 ? stepCheck(doneJobs, confirmed, queried)
    : state.payStep === 1 ? stepAmounts(state, ready)
    : stepSend(state, ready, doneJobs.length - confirmed - queried);

  return `
    <div>
      <h1 style="font-size:32px;margin:0 0 2px">Payment run</h1>
      <p style="margin:0 0 16px;font-size:13px;color:var(--color-neutral-700)">${owed.count} completed jobs owed · ${ready.count} confirmed and ready to pay</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;border-top:2px solid var(--color-divider);border-bottom:2px solid var(--color-divider);padding:12px 0;margin-bottom:16px">${steps}</div>
      ${body}
    </div>`;
}

function stepCheck(doneJobs, confirmed, queried) {
  const rows = doneJobs.map((j) => {
    const isOpen = !j.review_status;
    let decisionHtml;
    if (isOpen) {
      decisionHtml = `<div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn btn-secondary" data-act="query-job" data-id="${j.id}">Query</button>
          <button class="btn btn-primary" data-act="confirm-job" data-id="${j.id}">Confirm</button>
        </div>`;
    } else {
      const settledLabel = j.review_status === 'confirmed' ? 'Confirmed' : 'Queried';
      decisionHtml = `<button class="btn btn-ghost" data-act="reopen-job" data-id="${j.id}">${settledLabel} · undo</button>`;
    }
    return `
      <tr>
        <td style="font-family:var(--font-heading);font-weight:800">${escapeHtml(j.employee?.name || '—')}</td>
        <td style="font-size:13px">${escapeHtml(j.homeowner?.name || '—')}</td>
        <td style="font-size:13px;white-space:nowrap">${dayLabel(j.date)}, ${fmtTime(j.start_time)}</td>
        <td style="text-align:right">${hours(j.hours)}</td>
        <td style="text-align:right;font-family:var(--font-heading);font-weight:800">${money(j.pay)}</td>
        <td style="font-size:12px">${j.photos_count ? j.photos_count + ' photos' : 'no photos'}</td>
        <td style="text-align:right">${decisionHtml}</td>
      </tr>`;
  }).join('');

  return `
    <div>
      <h2 style="font-size:20px;margin:0 0 8px">Check the work happened</h2>
      <p style="font-size:13px;color:var(--color-neutral-700);max-width:58ch">Jobs students logged as finished. Confirm each — or query it if the hours look off. Only confirmed jobs go through to payment, and you can pay them one student at a time.</p>
      <div style="overflow-x:auto">
        <table class="table" style="min-width:700px">
          <thead><tr><th>Student</th><th>Homeowner</th><th>When</th><th style="text-align:right">Hours</th><th style="text-align:right">Pay</th><th>Photos</th><th style="text-align:right">Decision</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="7" style="padding:16px 0;color:var(--color-neutral-700)">Nothing waiting on a decision.</td></tr>`}</tbody>
        </table>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;border-top:2px solid var(--color-divider);padding-top:12px;margin-top:12px">
        <span style="font-size:13px;color:var(--color-neutral-700)">${confirmed} of ${doneJobs.length} confirmed · ${queried} queried</span>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-secondary" data-act="confirm-all">Confirm all</button>
          <button class="btn btn-primary" data-act="pay-continue">Continue</button>
        </div>
      </div>
    </div>`;
}

function stepAmounts(state, ready) {
  const groups = paymentGroups(ready.jobs, state.topUps, state.payExcluded);
  let billedTotal = 0, payTotal = 0, topUpTotal = 0;

  const rows = groups.map((g) => {
    const emp = g.employee;
    const hrs = g.jobs.reduce((s, j) => s + j.hours, 0);
    const billed = g.jobs.reduce((s, j) => s + j.billed, 0);
    const { pay, topUp } = g;
    const margin = billed - pay;
    billedTotal += billed; payTotal += pay; topUpTotal += topUp;
    const bank = emp.bank_name ? `${escapeHtml(emp.bank_name)} ••${escapeHtml(emp.bank_last4 || '----')}` : 'No bank on file';
    return `
      <tr>
        <td style="font-family:var(--font-heading);font-weight:800">${escapeHtml(emp.name)}<div style="font-size:11px;font-weight:400;color:var(--color-neutral-700)">${bank}</div></td>
        <td style="text-align:right">${g.jobs.length}</td>
        <td style="text-align:right">${hours(hrs)}</td>
        <td style="text-align:right">${money(EMPLOYEE_PAY_RATE)}</td>
        <td style="text-align:right">
          <div style="display:inline-flex;align-items:center;gap:6px">
            <button class="btn btn-secondary" style="width:26px;height:26px;padding:0;justify-content:center" data-act="topup" data-emp="${emp.id}" data-delta="-5">–</button>
            <span style="min-width:42px;display:inline-block;text-align:right;font-family:var(--font-heading);font-weight:800">${money(topUp, { headline: true })}</span>
            <button class="btn btn-secondary" style="width:26px;height:26px;padding:0;justify-content:center" data-act="topup" data-emp="${emp.id}" data-delta="5">+</button>
          </div>
        </td>
        <td style="text-align:right;font-family:var(--font-heading);font-weight:800">${money(pay)}</td>
        <td style="text-align:right;font-size:13px">${money(billed)}</td>
        <td style="text-align:right;font-size:13px;color:var(--color-accent-700)">${money(margin)}</td>
      </tr>`;
  }).join('');

  const marginTotal = billedTotal - payTotal;
  const marginPct = billedTotal ? Math.round((marginTotal / billedTotal) * 100) : 0;

  return `
    <div>
      <h2 style="font-size:20px;margin:0 0 8px">Amounts &amp; your margin</h2>
      <p style="font-size:13px;color:var(--color-neutral-700);max-width:60ch">Confirmed jobs only. Hours × their rate, plus any travel top-up. The billed column is what the job invoices at, so the last column stays with you.</p>
      <div style="overflow-x:auto">
        <table class="table" style="min-width:760px">
          <thead><tr><th>Student</th><th style="text-align:right">Jobs</th><th style="text-align:right">Hours</th><th style="text-align:right">Rate</th><th style="text-align:right">Top-up</th><th style="text-align:right">Pay</th><th style="text-align:right">Billed</th><th style="text-align:right">Margin</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="8" style="padding:16px 0;color:var(--color-neutral-700)">Nothing confirmed yet — confirm jobs on step 1 first.</td></tr>`}</tbody>
        </table>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;border-top:2px solid var(--color-divider);padding-top:12px;margin-top:12px">
        <span style="font-size:13px;color:var(--color-neutral-700)">Pay ${money(payTotal, { headline: true })} · billed ${money(billedTotal, { headline: true })} · margin ${money(marginTotal, { headline: true })} (${marginPct}%)</span>
        <button class="btn btn-primary" data-act="pay-continue">Continue</button>
      </div>
    </div>`;
}

function formatSortCode(s) {
  const digits = String(s || '').replace(/\D/g, '');
  return digits.length === 6 ? `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 6)}` : (s || '');
}

function stepSend(state, ready, waitingCount) {
  const groups = paymentGroups(ready.jobs, state.topUps, state.payExcluded);
  const payable = groups.filter((g) => g.jobs.length);
  const total = payable.reduce((s, g) => s + g.pay, 0);

  const today = new Date();
  const ref = `WEEK ${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}`;
  const fullRef = 'SD GARDEN · ' + ref;
  const bankDisplay = state.db.settings.bank_display || 'Student Digs Ltd';

  const cards = groups.map((g) => {
    const emp = g.employee;
    const hasBank = emp.bank_sort_code && emp.bank_account_number;
    const bankLine = hasBank
      ? `${escapeHtml(formatSortCode(emp.bank_sort_code))} · ${escapeHtml(emp.bank_account_number)}${emp.bank_name ? ' · ' + escapeHtml(emp.bank_name) : ''}`
      : `<span style="color:var(--color-accent-2-800)">No bank details on file — add on their Students page</span>`;
    const jobRows = g.allJobs.map((j) => {
      const on = !state.payExcluded[j.id];
      return `
        <button data-act="pay-toggle-job" data-id="${j.id}" style="display:flex;align-items:center;gap:10px;width:100%;border:0;background:transparent;padding:6px 0;cursor:pointer;text-align:left;font:inherit;font-size:13px;color:var(--color-text);${on ? '' : 'opacity:0.5'}">
          <span aria-hidden="true" style="flex:none;width:16px;height:16px;border:1.5px solid var(--color-text);border-radius:4px;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;${on ? 'background:var(--color-accent);color:var(--color-bg);border-color:var(--color-accent)' : ''}">${on ? '✓' : ''}</span>
          <span style="flex:1;min-width:0">${dayLabel(j.date)} · ${escapeHtml(j.homeowner?.name || '—')} · ${hours(j.hours)}</span>
          <span style="white-space:nowrap;${on ? '' : 'text-decoration:line-through'}">${money(j.pay)}</span>
        </button>`;
    }).join('');
    const topUpLine = g.topUp ? `<div style="display:flex;justify-content:space-between;font-size:13px;padding:6px 0 0 26px"><span>Travel top-up</span><span>${money(g.topUp)}</span></div>` : '';
    return `
      <div style="border:1px solid var(--color-divider);border-radius:var(--radius-md);padding:14px 16px;display:flex;flex-direction:column;gap:6px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
          <div>
            <div style="font-family:var(--font-heading);font-weight:800">${escapeHtml(emp.name)}</div>
            <div style="font-size:11px;color:var(--color-neutral-700);margin-top:1px">${bankLine}</div>
          </div>
          <span style="font-family:var(--font-heading);font-weight:800;font-size:20px;white-space:nowrap">${money(g.pay)}</span>
        </div>
        <div style="border-top:1px solid var(--color-divider);margin-top:4px;padding-top:4px">${jobRows}${topUpLine}</div>
        <button class="btn btn-primary" style="align-self:flex-end;margin-top:6px" data-act="send-payment-student" data-emp="${emp.id}" data-ref="${escapeHtml(fullRef)}" ${g.jobs.length ? '' : 'disabled'}>
          ${g.jobs.length ? `Mark ${escapeHtml(emp.name.split(' ')[0])} paid — ${money(g.pay)}` : 'No jobs ticked'}
        </button>
      </div>`;
  }).join('');

  const lastPaid = state.lastPaid ? `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 14px;border-radius:var(--radius-md);background:var(--color-accent);color:var(--color-bg);font-size:13px">
      <span>Marked ${escapeHtml(state.lastPaid.name)} paid — ${money(state.lastPaid.total)} for ${state.lastPaid.jobs} job${state.lastPaid.jobs === 1 ? '' : 's'}.</span>
      <button data-act="dismiss-last-paid" style="border:0;background:transparent;color:inherit;font-weight:800;cursor:pointer">✕</button>
    </div>` : '';

  const waitingNote = waitingCount
    ? `<p style="font-size:12px;color:var(--color-neutral-700);margin:0">${waitingCount} more job${waitingCount === 1 ? ' is' : 's are'} still waiting to be confirmed on step 1, so ${waitingCount === 1 ? "it isn't" : "they aren't"} shown here.</p>`
    : '';

  return `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:24px;align-items:start">
      <div>
        <h2 style="font-size:20px;margin:0 0 8px">Send it</h2>
        <div style="display:flex;flex-direction:column;gap:12px">
          <div class="field"><label>Pay from</label><div class="input" style="display:flex;align-items:center;justify-content:space-between"><span>${escapeHtml(bankDisplay)}</span></div></div>
          <div class="field"><label>Reference</label><div class="input" style="display:flex;align-items:center">${escapeHtml(fullRef)}</div></div>
          <p style="font-size:12px;color:var(--color-neutral-700);margin:0;max-width:44ch">Pay one student at a time from your banking app, then press "Mark paid" on their card. Untick any job you want to hold back — it stays here for next time. Everyone else keeps waiting until you're ready.</p>
          ${waitingNote}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:12px">
        ${lastPaid}
        ${cards || '<p style="font-size:13px;color:var(--color-neutral-700)">Nothing confirmed and waiting to be paid.</p>'}
        ${payable.length > 1 ? `
        <div style="border-top:2px solid var(--color-divider);padding-top:12px;display:flex;flex-direction:column;gap:8px">
          <span style="font-size:12px;color:var(--color-neutral-700)">${payable.length} students · ${money(total, { headline: true })} ticked in total</span>
          <button class="btn btn-secondary btn-block" data-act="send-payment" data-ref="${escapeHtml(fullRef)}">Mark everyone paid — ${money(total, { headline: true })}</button>
        </div>` : ''}
        <button class="btn btn-ghost btn-block" data-act="pay-back">Back</button>
      </div>
    </div>`;
}

function paidConfirmation(state) {
  const s = state.sentSnapshot || { total: 0, students: 0 };
  return `
    <div style="max-width:560px;padding:32px 0">
      <span style="font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:var(--color-accent-700)">Sent just now</span>
      <h1 style="font-size:40px;margin:8px 0">${money(s.total, { headline: true })} paid to ${s.students} student${s.students === 1 ? '' : 's'}.</h1>
      <p style="font-size:14px;color:var(--color-neutral-700)">Those jobs now read as paid in the calendar. (Statement emails and homeowner invoices aren't wired up yet.)</p>
      <button class="btn btn-primary" style="margin-top:12px" data-act="pay-done">Back to the calendar</button>
    </div>`;
}
