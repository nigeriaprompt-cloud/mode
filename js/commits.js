// Commitments: personal rules and promises. Six kinds, each with its own progress model.
//   daily    tick each day you keep it (streak)           abstain  stay away from something until a date (slip resets the clock)
//   weekly   N times per week                             limit    at most N per month (barber, treats…)
//   count    reach a number (a tally)                     todo     one-off with an optional deadline
import * as store from './store.js';
import { today, addDays, diffDays, weekStart, range, clamp, pct } from './util.js';

export const TYPES = {
  daily: { label: 'Every day', hue: 'fitness' }, weekly: { label: 'Weekly', hue: 'business' }, abstain: { label: 'Abstain', hue: 'spiritual' },
  limit: { label: 'Monthly limit', hue: 'career' }, count: { label: 'Counter', hue: 'discipline' }, todo: { label: 'To-do', hue: 'accent' },
};
export const ICONS = ['footprints', 'ban', 'shirt', 'scissors', 'party-popper', 'rocket', 'calendar-check', 'heart', 'star', 'flag', 'book-open', 'dumbbell'];

const S = () => store.get();
const find = (s, id) => s.commit.find(c => c.id === id);
const monthKey = d => d.slice(0, 7);

export function info(it) {
  const t = today(), o = { done: !!it.done, pct: 0, headline: '', sub: '', mini: '', todayDone: false };
  switch (it.type) {
    case 'abstain': {
      const total = Math.max(1, diffDays(it.start, it.until)), el = clamp(diffDays(it.start, t), 0, total), left = total - el, fin = el >= total;
      return { ...o, done: o.done || fin, finished: fin, total, el, left, pct: pct(el, total), headline: fin ? 'Done' : `Day ${el + 1}`, of: total, sub: fin ? 'You made it' : `${left} day${left === 1 ? '' : 's'} left`, mini: fin ? 'Complete' : `Day ${el + 1}/${total}` };
    }
    case 'count': return { ...o, pct: pct(it.count, it.target), headline: String(it.count), of: it.target, sub: it.count >= it.target ? 'Target reached' : `${it.target - it.count} to go`, mini: `${it.count}/${it.target}` };
    case 'daily': {
      let streak = 0, d = it.log[t] ? t : addDays(t, -1);
      while (it.log[d] && streak < 1000) { streak++; d = addDays(d, -1); }
      const total = Object.keys(it.log).length;
      return { ...o, todayDone: !!it.log[t], streak, total, headline: String(streak), sub: streak === 1 ? 'day streak' : 'day streak', mini: it.log[t] ? `Done today · ${streak}d` : `${streak}d streak` };
    }
    case 'weekly': {
      const w = weekStart(t), n = range(w, addDays(w, 6)).filter(d => it.log[d]).length;
      let streak = 0, ws = n >= it.perWeek ? w : addDays(w, -7);
      for (; streak < 300; ws = addDays(ws, -7)) { if (range(ws, addDays(ws, 6)).filter(d => it.log[d]).length >= it.perWeek) streak++; else break; }
      return { ...o, week: n, streak, todayDone: !!it.log[t], pct: pct(n, it.perWeek), headline: `${n}/${it.perWeek}`, sub: 'this week', mini: `${n}/${it.perWeek} this week` };
    }
    case 'limit': {
      const used = Object.keys(it.log).filter(d => monthKey(d) === monthKey(t)).sort(), over = used.length > it.cap;
      return { ...o, used: used.length, last: used.at(-1), over, atCap: used.length >= it.cap, pct: pct(used.length, it.cap), headline: `${used.length}/${it.cap}`, sub: over ? `over by ${used.length - it.cap}` : used.length >= it.cap ? 'limit reached' : `${it.cap - used.length} left this month`, mini: `${used.length}/${it.cap} this month` };
    }
    default: {
      const left = it.deadline ? diffDays(t, it.deadline) : null;
      return { ...o, left, overdue: left !== null && left < 0 && !it.done, headline: left === null ? 'Open' : left < 0 ? `${-left}d late` : left === 0 ? 'Today' : `${left}d`, sub: left === null ? 'no deadline' : left < 0 ? 'overdue' : 'left', mini: left === null ? 'Open' : left < 0 ? 'Overdue' : left === 0 ? 'Due today' : `${left}d left` };
    }
  }
}

export const actions = {
  /** Tick a to-do or mark a whole commitment complete. Returns true if it is now complete. */
  toggleDone(id) {
    let now = false;
    store.update(s => { const c = find(s, id); if (info(c).finished) { now = true; return; } c.done = !c.done; c.doneOn = c.done ? today() : null; now = c.done; });
    return now;
  },
  toggleDay(id, d = today()) { store.update(s => { const c = find(s, id); if (c.log[d]) delete c.log[d]; else c.log[d] = 1; }); },
  count(id, delta) {
    let reached = false;
    store.update(s => {
      const c = find(s, id), was = c.count >= c.target; c.count = clamp(c.count + delta, 0, 9999);
      if (c.count >= c.target && !was) { c.done = true; c.doneOn = today(); reached = true; } else if (c.count < c.target && c.done) { c.done = false; c.doneOn = null; }
    });
    return reached;
  },
  slip(id) { store.update(s => { const c = find(s, id), dur = diffDays(c.start, c.until), t = today(); (c.slips ||= []).push(t); c.start = t; c.until = addDays(t, dur); c.done = false; }); },
  logUse(id) { store.update(s => { find(s, id).log[today()] = 1; }); },
  undoUse(id) { store.update(s => { const c = find(s, id), k = Object.keys(c.log).filter(d => monthKey(d) === monthKey(today())).sort().at(-1); if (k) delete c.log[k]; }); },
  remove(id) { store.update(s => { s.commit = s.commit.filter(c => c.id !== id); }); },
};
