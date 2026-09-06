import { fetchAll, markJobDone, setReview, confirmAll as dbConfirmAll, nudgeHandover, sendPaymentRun, updateEmployeeBank, addExpense, stopExpense, deleteExpense } from './db.js';
import { enrichJobs, owedSummary, paymentGroups } from './derive.js';
import { state, setState, goScreen } from './state.js';
import { renderLeftRail, renderRightRail } from './rails.js';
import { renderHome } from './home.js';
import { renderCalendar } from './calendar.js';
import { renderHandovers } from './handovers.js';
import { renderJobs } from './jobs.js';
import { renderPayments } from './payments.js';
import { renderStudents } from './students.js';
import { renderHomeowners } from './homeowners.js';
import { signOut } from './auth.js';
import { escapeHtml, toDate } from './utils.js';

const root = document.getElementById('app');

export async function mountApp() {
  await refresh();
  window.addEventListener('hashchange', onHashChange);
  onHashChange();
  root.addEventListener('click', onClick);
  root.addEventListener('change', onChange);
  root.addEventListener('input', onInput);
}

async function refresh() {
  setState({ loading: true, error: null });
  try {
    const db = await fetchAll();
    setState({ db, loading: false });
  } catch (err) {
    console.error(err);
    setState({ loading: false, error: err.message || String(err) });
  }
  render();
}

function onHashChange() {
  const m = location.hash.match(/^#\/(\w+)/);
  const screen = m ? m[1] : 'home';
  const valid = ['home', 'calendar', 'handovers', 'jobs', 'payments', 'students', 'homeowners'];
  setState({ screen: valid.includes(screen) ? screen : 'home' });
  render();
}

function render() {
  if (state.loading && !state.db) {
    root.innerHTML = `<div style="padding:48px;font-size:14px;color:var(--color-neutral-700)">Loading…</div>`;
    return;
  }
  if (state.error) {
    root.innerHTML = `<div style="padding:48px;font-size:14px;color:var(--color-accent-2-800)">Couldn't load the data: ${state.error}</div>`;
    return;
  }

  // Preserve focus + caret across the full-DOM re-render (matters for the
  // homeowners search box, which re-renders on every keystroke).
  const active = document.activeElement;
  const focusKey = active && active.dataset ? active.dataset.act : null;
  const selStart = active && 'selectionStart' in active ? active.selectionStart : null;

  const centre = {
    home: renderHome,
    calendar: renderCalendar,
    handovers: renderHandovers,
    jobs: renderJobs,
    payments: renderPayments,
    students: renderStudents,
    homeowners: renderHomeowners,
  }[state.screen](state);

  const errorBanner = state.actionError ? `
    <div style="position:sticky;top:0;z-index:50;display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 24px;background:var(--color-accent-2-200,#fbe2d5);color:var(--color-accent-2-800,#7a2e0e);font-size:13px;border-bottom:2px solid var(--color-text)">
      <span>That didn't save: ${escapeHtml(state.actionError)}</span>
      <button data-act="dismiss-error" style="border:0;background:transparent;font-weight:800;cursor:pointer;color:inherit">Dismiss ✕</button>
    </div>` : '';

  root.innerHTML = `
    <div style="display:flex;flex-direction:column;min-height:100vh">
      ${errorBanner}
      <div style="display:flex;align-items:stretch;flex-wrap:wrap;flex:1">
        ${renderLeftRail(state)}
        <section style="flex:1 1 560px;min-width:0;padding:16px 24px 32px">${centre}</section>
        ${renderRightRail(state)}
      </div>
    </div>`;

  if (focusKey) {
    const toFocus = root.querySelector(`[data-act="${focusKey}"]`);
    if (toFocus) {
      toFocus.focus();
      if (selStart != null && 'setSelectionRange' in toFocus) toFocus.setSelectionRange(selStart, selStart);
    }
  }
}

async function withRefresh(fn) {
  try {
    await fn();
    setState({ actionError: null });
  } catch (err) {
    console.error(err);
    setState({ actionError: err.message || String(err) || 'Unknown error' });
    // alert() can be silently blocked in some embedded/preview contexts, so
    // the actionError banner (rendered at the top of the page) is the
    // reliable way this surfaces — alert is just a bonus on top of it.
    try { alert(`That didn't save: ${err.message || err}`); } catch {}
  }
  await refresh();
}

function onClick(e) {
  const t = e.target.closest('[data-act]');
  if (!t) return;
  const act = t.dataset.act;
  const jobs = () => enrichJobs(state.db);

  switch (act) {
    case 'nav':
      goScreen(t.dataset.screen);
      render();
      break;
    case 'logout':
      signOut().then(() => location.reload());
      break;
    case 'cal-prev': {
      let { calYear, calMonth0 } = state;
      calMonth0--; if (calMonth0 < 0) { calMonth0 = 11; calYear--; }
      setState({ calYear, calMonth0 });
      render();
      break;
    }
    case 'cal-next': {
      let { calYear, calMonth0 } = state;
      calMonth0++; if (calMonth0 > 11) { calMonth0 = 0; calYear++; }
      setState({ calYear, calMonth0 });
      render();
      break;
    }
    case 'select-day':
      setState({ dayKey: t.dataset.date, jobId: null });
      render();
      break;
    case 'select-job':
      setState({ jobId: t.dataset.id, dayKey: jobs().find((j) => j.id === t.dataset.id)?.date || state.dayKey });
      render();
      break;
    case 'close-job':
      setState({ jobId: null });
      render();
      break;
    case 'job-filter':
      setState({ jobsFilter: t.dataset.filter });
      render();
      break;
    case 'mark-done': {
      const job = jobs().find((j) => j.id === t.dataset.id);
      if (job) withRefresh(() => markJobDone(job, job.employee, state.db.settings));
      break;
    }
    case 'pay-step':
      setState({ payStep: Number(t.dataset.step) });
      render();
      break;
    case 'pay-continue':
      setState({ payStep: Math.min(2, state.payStep + 1) });
      render();
      break;
    case 'pay-back':
      setState({ payStep: Math.max(0, state.payStep - 1) });
      render();
      break;
    case 'confirm-job':
      withRefresh(() => setReview(t.dataset.id, 'confirmed'));
      break;
    case 'query-job':
      withRefresh(() => setReview(t.dataset.id, 'queried'));
      break;
    case 'reopen-job':
      withRefresh(() => setReview(t.dataset.id, null));
      break;
    case 'confirm-all': {
      const unresolved = jobs().filter((j) => j.stage === 'done' && !j.review_status).map((j) => j.id);
      withRefresh(() => dbConfirmAll(unresolved));
      break;
    }
    case 'topup': {
      const delta = Number(t.dataset.delta);
      const empId = t.dataset.emp;
      const current = state.topUps[empId] || 0;
      const next = Math.max(0, current + delta);
      setState({ topUps: { ...state.topUps, [empId]: next } });
      render();
      break;
    }
    case 'send-payment': {
      const owed = owedSummary(jobs());
      const groups = paymentGroups(owed.jobs, state.topUps);
      if (!groups.length) break;
      const snapshot = {
        total: groups.reduce((s, g) => s + g.pay, 0),
        students: groups.length,
      };
      const jobRows = groups.map((g) => ({ jobIds: g.jobs.map((j) => j.id) }));
      withRefresh(async () => {
        // Just flips the relevant jobs to paid — no separate payments-table
        // bookkeeping row, so there's nothing else here that can fail.
        await sendPaymentRun(jobRows);
        setState({ paid: true, topUps: {}, sentSnapshot: snapshot });
      });
      break;
    }
    case 'save-bank': {
      const id = t.dataset.id;
      const bank_name = document.getElementById(`bank-name-${id}`)?.value.trim() || null;
      const bank_sort_code = document.getElementById(`bank-sort-${id}`)?.value.trim() || null;
      const bank_account_number = document.getElementById(`bank-acct-${id}`)?.value.trim() || null;
      withRefresh(() => updateEmployeeBank(id, { bank_name, bank_sort_code, bank_account_number }));
      break;
    }
    case 'pay-done':
      setState({ paid: false, payStep: 0 });
      goScreen('calendar');
      render();
      break;
    case 'open-student':
      setState({ screen: 'students', stuId: t.dataset.id });
      location.hash = '#/students';
      render();
      break;
    case 'close-student':
      setState({ stuId: null });
      render();
      break;
    case 'open-client':
      goScreen('homeowners');
      render();
      break;
    case 'nudge':
      withRefresh(() => nudgeHandover(t.dataset.id));
      break;
    case 'dismiss-error':
      setState({ actionError: null });
      render();
      break;
    case 'home-open-day': {
      const d = toDate(t.dataset.date);
      setState({ dayKey: t.dataset.date, calYear: d.getFullYear(), calMonth0: d.getMonth() });
      goScreen('calendar');
      render();
      break;
    }
    case 'toggle-expense-form':
      setState({ showExpenseForm: !state.showExpenseForm });
      render();
      break;
    case 'add-expense': {
      const description = document.getElementById('expense-desc')?.value.trim();
      const amount = Number(document.getElementById('expense-amount')?.value);
      const type = document.getElementById('expense-type')?.value;
      const date = document.getElementById('expense-date')?.value;
      if (!description || !(amount > 0) || !date) {
        setState({ actionError: 'Fill in a description, an amount above £0, and a date before adding an expense.' });
        render();
        break;
      }
      setState({ showExpenseForm: false });
      withRefresh(() => addExpense({ description, amount, type, date }));
      break;
    }
    case 'stop-expense':
      withRefresh(() => stopExpense(t.dataset.id));
      break;
    case 'delete-expense':
      withRefresh(() => deleteExpense(t.dataset.id));
      break;
    default:
      break;
  }
}

function onChange(e) {
  const t = e.target.closest('[data-act]');
  if (!t) return;
  if (t.dataset.act === 'cal-view') {
    setState({ calView: t.dataset.view });
    render();
  }
}

function onInput(e) {
  const t = e.target.closest('[data-act]');
  if (!t) return;
  if (t.dataset.act === 'search-homeowners') {
    setState({ homeownerSearch: t.value });
    render();
  }
}
