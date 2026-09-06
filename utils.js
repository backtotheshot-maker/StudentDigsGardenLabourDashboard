// Formatting + small pure helpers shared across screens.

export function money(amount, { headline = false } = {}) {
  const n = Number(amount || 0);
  return n.toLocaleString('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: headline ? 0 : 2,
    maximumFractionDigits: headline ? 0 : 2,
  });
}

export function hours(h) {
  const n = Number(h || 0);
  const trimmed = Number.isInteger(n) ? String(n) : String(n).replace(/0$/, '').replace(/\.$/, '');
  return `${trimmed} hrs`;
}

export function initials(name) {
  return (name || '')
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function shortName(name) {
  return (name || '').replace(/^(Mrs|Mr|Dr|Prof\.?)\s+/i, '');
}

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DOW_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export function toDate(isoDateStr) {
  // isoDateStr like '2026-09-06' — construct as local date, not UTC, to avoid off-by-one.
  const [y, m, d] = isoDateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function dowMon0(date) {
  // 0 = Monday .. 6 = Sunday
  return (date.getDay() + 6) % 7;
}

export function dayLabel(isoDateStr, { withYear = false } = {}) {
  const d = toDate(isoDateStr);
  const label = `${DOW[dowMon0(d)]} ${d.getDate()}`;
  return withYear ? `${label} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : label;
}

export function dowFull(isoDateStr) {
  return DOW_FULL[dowMon0(toDate(isoDateStr))];
}

export function monthLabel(year, month0) {
  return `${MONTHS[month0]} ${year}`;
}

export function daysAgo(isoDateStr) {
  const d = toDate(isoDateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  const diff = Math.round((today - d) / 86400000);
  if (diff <= 0) return 'today';
  if (diff === 1) return 'yesterday';
  if (diff < 14) return `${diff} days ago`;
  const weeks = Math.round(diff / 7);
  return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
}

export function timeToHours(start, end) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return (eh * 60 + em - (sh * 60 + sm)) / 60;
}

export function addMinutesToTime(start, mins) {
  const [h, m] = start.split(':').map(Number);
  const total = h * 60 + m + mins;
  const hh = String(Math.floor((total % 1440) / 60)).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function fmtTime(t) {
  return t ? t.slice(0, 5) : '';
}

export function tagStyle(tone) {
  const base = 'display:inline-flex;font-size:11px;padding:3px 9px;white-space:nowrap;';
  const tones = {
    good: 'background:var(--color-accent-100);color:var(--color-accent-800);',
    warn: 'background:var(--color-accent-2-200);color:var(--color-accent-2-800);',
    flat: 'background:var(--color-neutral-200);color:var(--color-neutral-800);',
  };
  return base + (tones[tone] || tones.flat);
}

export function statusTone(status) {
  // booked | done | paid  ->  chip tone used on calendar chips / job rows
  if (status === 'booked') return { tone: 'good', label: 'Booked' };
  if (status === 'done') return { tone: 'warn', label: 'Done, to pay' };
  if (status === 'paid') return { tone: 'flat', label: 'Paid' };
  return { tone: 'flat', label: status || '—' };
}

export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
