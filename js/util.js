// Small helpers shared by every module. Dates are local "YYYY-MM-DD" strings.
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
export const pad = n => String(n).padStart(2, '0');
export const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
export const sum = a => a.reduce((x, y) => x + y, 0);
export const avg = a => (a.length ? sum(a) / a.length : 0);
export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

export const dstr = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => dstr();
export const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return dstr(d); };
export const dow = s => parse(s).getDay(); // 0 = Sunday
export const weekStart = s => addDays(s, -((parse(s).getDay() + 6) % 7)); // Monday
export const monthStart = s => s.slice(0, 8) + '01';
export const monthEnd = s => { const d = parse(s); return dstr(new Date(d.getFullYear(), d.getMonth() + 1, 0)); };
export const addMonths = (s, n) => { const d = parse(monthStart(s)); d.setMonth(d.getMonth() + n); return dstr(d); };
export const addMonthsKeep = (s, n) => { const d = parse(s); d.setMonth(d.getMonth() + n); return dstr(d); };
export const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
export const range = (a, b) => { const o = []; for (let d = a; d <= b; d = addDays(d, 1)) o.push(d); return o; };
export const lastNDays = (n, end = today()) => range(addDays(end, -(n - 1)), end);

export const nowHM = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const toMin = hm => { if (!hm) return 0; const [h, m] = hm.split(':').map(Number); return h * 60 + m; };
export const fromMin = m => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
export const fmt12 = hm => { if (!hm) return ''; const [h, m] = hm.split(':').map(Number); return `${h % 12 || 12}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`; };
export const fmtDate = (s, o = { weekday: 'short', day: 'numeric', month: 'short' }) => parse(s).toLocaleDateString(undefined, o);
export const fmtLong = s => parse(s).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
export const fmtMonth = s => parse(s).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
export const hrs = min => (Math.round((min / 60) * 10) / 10).toString();
export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY1 = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday-first display

export function relDay(s) {
  const n = diffDays(today(), s);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  return fmtDate(s);
}
export function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 21 ? 'Good evening' : 'Good night';
}
export const debounce = (fn, ms = 300) => { let t; const f = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; f.flush = () => { clearTimeout(t); fn(); }; return f; };
export const download = (name, text, type = 'text/plain') => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
};
export const formData = form => {
  const fd = new FormData(form);
  return { get: k => (fd.get(k) ?? '').toString().trim(), all: k => fd.getAll(k).map(String), has: k => fd.has(k) };
};
