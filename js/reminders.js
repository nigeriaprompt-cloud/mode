// Reminders: evaluated in-page every 20s. Fires an in-app alert (always) and a browser notification (if permitted).
// Browsers only deliver these while Mode is open or running in the background; there is no push server.
import * as store from './store.js';
import { today, nowHM, toMin, fmt12, fromMin, uid } from './util.js';
import { dayPlan, fitDay, habitScheduled, habitDone } from './stats.js';
import { toast } from './ui.js';

const WINDOW = 10; // minutes after due time a reminder may still fire

export function list(date = today()) {
  const s = store.get(), R = s.settings.remind, out = [], ci = s.checkins[date] || {};
  if (R.morning.on && !ci.morning) out.push({ key: 'morning', time: R.morning.time, title: 'Morning check-in', body: 'Set your three goals and biggest priority.', route: '#/checkin' });
  if (R.workout.on && !fitDay(date).trained) out.push({ key: 'workout', time: R.workout.time, title: 'Workout time', body: 'Push-ups, sit-ups, squats. Log your sets.', route: '#/fitness' });
  if (R.activities.on) for (const it of dayPlan(date).items) if (it.remind && !it.done) out.push({ key: 'act:' + it.uid, time: fromMin(Math.max(0, toMin(it.time) - R.activities.lead)), title: it.title, body: `${R.activities.lead ? `In ${R.activities.lead} min · ` : ''}${fmt12(it.time)}`, route: '#/dashboard' });
  if (R.evening.on && !ci.evening) out.push({ key: 'evening', time: R.evening.time, title: 'Evening review', body: 'What did you accomplish? What will you improve tomorrow?', route: '#/checkin' });
  if (R.sleep.on) out.push({ key: 'sleep', time: R.sleep.time, title: 'Wind down', body: 'Sleep target is close. Phone away, lights low.', route: '#/dashboard' });
  if (R.habits.on) for (const h of s.habits) if (!h.archived && h.reminder && habitScheduled(h, date) && !habitDone(h, date)) out.push({ key: 'habit:' + h.id, time: h.reminder, title: h.name, body: 'Habit reminder', route: '#/habits' });
  return out.sort((a, b) => toMin(a.time) - toMin(b.time));
}
export const upcoming = () => list().filter(r => toMin(r.time) >= toMin(nowHM()));

async function notify(r) {
  const s = store.get();
  if (!s.settings.notify || !('Notification' in window) || Notification.permission !== 'granted') return;
  const opts = { body: r.body, icon: 'assets/icons/icon-192.png', badge: 'assets/icons/favicon-32.png', tag: r.key, data: { route: r.route } };
  try { const reg = await navigator.serviceWorker?.getRegistration(); if (reg) return await reg.showNotification(r.title, opts); } catch { /* fall through */ }
  try { new Notification(r.title, opts); } catch { /* ignore */ }
}

export function fire(r) {
  store.update(s => { s.inbox.unshift({ id: uid(), ts: Date.now(), title: r.title, body: r.body, route: r.route, read: false }); s.inbox.length = Math.min(s.inbox.length, 60); });
  toast(`${r.title}: ${r.body}`, { ms: 7000, action: { label: 'Open', fn: () => { location.hash = r.route; } } });
  notify(r);
}

export function tick() {
  const t = today(), now = toMin(nowHM());
  const fired = store.get().fired[t] || {};
  for (const r of list(t)) {
    const due = toMin(r.time);
    if (now >= due && now - due <= WINDOW && !fired[r.key]) {
      store.update(s => { for (const d of Object.keys(s.fired)) if (d !== t) delete s.fired[d]; (s.fired[t] ||= {})[r.key] = 1; }, { silent: true });
      fire(r);
    }
  }
}
let timer = 0;
export function start() {
  tick(); clearInterval(timer); timer = setInterval(tick, 20000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
}
export const unread = () => store.get().inbox.filter(i => !i.read).length;
export const permission = () => ('Notification' in window ? Notification.permission : 'unsupported');
export async function enable() {
  if (!('Notification' in window)) return 'unsupported';
  let p = Notification.permission;
  if (p === 'default') p = await Notification.requestPermission();
  store.update(s => { s.settings.notify = p === 'granted'; });
  return p;
}
export function test() {
  fire({ key: 'test:' + Date.now(), title: 'Mode reminders work', body: 'You will get alerts like this at your chosen times.', route: '#/settings' });
}
