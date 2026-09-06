// Small store: plain object + subscriber list. No framework needed for a
// dashboard this size — screens re-render themselves on every change.

const now = new Date();

export const state = {
  db: null, // filled by fetchAll()
  screen: 'calendar', // calendar | handovers | jobs | payments | students | homeowners
  // calendar
  calView: 'month',
  calYear: now.getFullYear(),
  calMonth0: now.getMonth(),
  dayKey: null, // 'YYYY-MM-DD'
  // shared right rail
  jobId: null,
  // jobs screen
  jobsFilter: 'booked',
  // payments wizard
  payStep: 0,
  paid: false,
  sentSnapshot: null,
  reviewDraft: {}, // jobId -> 'confirmed' | 'queried' (unsent local overlay, cleared on send)
  topUps: {}, // employeeId -> number
  // students screen
  stuId: null,
  // ui
  loading: false,
  error: null,
  actionError: null, // set when a write (mark done, send payment, etc.) fails
};

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setState(patch) {
  Object.assign(state, patch);
  for (const fn of listeners) fn(state);
}

export function goScreen(screen) {
  const patch = { screen };
  if (screen !== 'students') patch.stuId = null;
  if (screen === 'payments' && !state.paid) {
    // keep wizard step where the user left it unless they've just finished
  }
  setState(patch);
  location.hash = `#/${screen}`;
}
