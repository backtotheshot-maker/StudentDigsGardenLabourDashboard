import { fetchAll, markJobDone, setReview, confirmAll as dbConfirmAll, nudgeHandover, changeRate, sendPaymentRun } from './db.js';
import { enrichJobs, owedSummary } from './derive.js';
import { state, setState, goScreen } from './state.js';
import { renderLeftRail, renderRightRail } from './rails.js';
import { renderCalendar } from './calendar.js';
import { renderHandovers } from './handovers.js';
import { renderJobs } from './jobs.js';
import { renderPayments } from './payments.js';
import { renderStudents } from './students.js';
import { renderHomeowners } from './homeowners.js';
import { signOut } from './auth.js';

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
  const screen = m ? m[1] : 'calendar';
  const valid = ['calendar', 'handovers', 'jobs', 'payments', 'students', 'homeowners'];
  setState({ screen: valid.includes(screen) ? screen : 'calendar' });
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
    calendar: renderCalendar,
    handovers: renderHandovers,
    jobs: renderJobs,
    payments: renderPayments,
    students: renderStudents,
    homeowners: renderHomeowners,
  }[state.screen](state);

  root.innerHTML = `
    <div style="display:flex;align-items:stretch;flex-wrap:wrap;min-height:100vh;background:var(--color-bg);color:var(--color-text);font-family:var(--font-body)">
      ${renderLeftRail(state)}
      <section style="flex:1 1 560px;min-width:0;padding:16px 24px 32px">${centre}</section>
      ${renderRightRail(state)}
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
  } catch (err) {
    console.error(err);
    alert(`That didn't save: ${err.message || err}`);
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
      if (job) withRefresh(() => markJobDone(job, job.employee, state.db.cityRateMap, state.db.settings));
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
      const unresolved = jobs().filter((j) => j.status === 'done' && !j.review_status).map((j) => j.id);
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
      const byEmp = {};
      for (const j of owed.jobs) (byEmp[j.employee_id] ||= []).push(j.id);
      const payRowsForSend = Object.entries(byEmp).map(([employeeId, jobIds]) => ({
        employeeId,
        jobIds,
        pay: owed.jobs.filter((j) => j.employee_id === employeeId).reduce((s, j) => s + j.pay, 0) + (state.topUps[employeeId] || 0),
        topUp: state.topUps[employeeId] || 0,
      }));
      if (!payRowsForSend.length) break;
      withRefresh(async () => {
        await sendPaymentRun(payRowsForSend, t.dataset.ref);
        setState({
          paid: true,
          topUps: {},
          sentSnapshot: {
            total: payRowsForSend.reduce((s, r) => s + r.pay, 0),
            students: payRowsForSend.length,
          },
        });
      });
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
    case 'change-rate': {
      const emp = state.db.employees.find((e) => e.id === t.dataset.id);
      const next = prompt(`New hourly rate for ${emp?.name || 'this student'} (£/hr):`, emp?.hourly_rate ?? '');
      if (next != null && next !== '' && !Number.isNaN(Number(next))) {
        withRefresh(() => changeRate(t.dataset.id, Number(next)));
      }
      break;
    }
    case 'nudge':
      withRefresh(() => nudgeHandover(t.dataset.id));
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
