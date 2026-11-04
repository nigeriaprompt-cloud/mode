// All derived numbers live here: daily plan, completion %, discipline score, streaks, habit + workout stats.
import * as store from './store.js';
import { CAT_KEYS } from './store.js';
import { today, addDays, dow, weekStart, range, lastNDays, toMin, sum, pct, clamp, nowHM } from './util.js';

const S = () => store.get();

/* ---------- Daily plan ---------- */
export function dayPlan(date) {
  const s = S(); const log = s.logs[date]; const wd = dow(date);
  const items = [], moved = [];
  for (const a of s.acts) {
    if (date < a.start || (a.end && date >= a.end) || !a.days.includes(wd)) continue;
    const l = log?.acts?.[a.id] || {};
    const it = { uid: a.id, rec: true, actId: a.id, title: a.title, baseTime: a.time, time: l.time || a.time, cat: a.cat, imp: a.imp, done: !!l.done, at: l.at || '', note: l.note || '', dur: a.dur, habit: a.habit, key: a.key, remind: a.remind !== false };
    if (l.movedTo) moved.push({ ...it, movedTo: l.movedTo }); else items.push(it);
  }
  for (const e of log?.extra || []) {
    items.push({ uid: e.id, rec: false, actId: null, title: e.title, baseTime: e.time, time: e.time, cat: e.cat, imp: e.imp, done: !!e.done, at: e.at || '', note: e.note || '', dur: e.dur || 0, habit: null, key: null, from: e.from, remind: e.remind !== false });
  }
  items.sort((a, b) => toMin(a.time) - toMin(b.time) || a.title.localeCompare(b.title));
  return { items, moved };
}

export function completion(date) {
  const { items } = dayPlan(date);
  const done = items.filter(i => i.done).length;
  return { done, total: items.length, pct: items.length ? Math.round((done / items.length) * 100) : null };
}

/* ---------- Discipline score (transparent) ----------
   1. Each activity has an importance (1 easy, 2 normal, 3 critical) = its points.
   2. Category % = points done / points planned.
   3. Easy (importance 1) items can never be more than 25% of a category: extra easy items are scaled down,
      so padding the routine with trivial habits does not raise the score.
   4. Daily score = weighted average of category % using your weights (only categories planned that day). */
export function score(date) {
  const { items } = dayPlan(date);
  const w = S().settings.weights;
  const cats = {};
  for (const k of CAT_KEYS) {
    const list = items.filter(i => i.cat === k);
    if (!list.length) { cats[k] = { P: 0, D: 0, pct: null, w: w[k] || 0, n: 0, doneN: 0, eff: 0, contrib: 0, capped: false }; continue; }
    let eP = 0, eD = 0, hP = 0, hD = 0;
    for (const i of list) { if (i.imp <= 1) { eP += 1; if (i.done) eD += 1; } else { hP += i.imp; if (i.done) hD += i.imp; } }
    const f = hP > 0 && eP > hP / 3 ? hP / 3 / eP : 1;
    const P = hP + eP * f, D = hD + eD * f;
    cats[k] = { P, D, pct: P ? D / P : 0, w: w[k] || 0, n: list.length, doneN: list.filter(i => i.done).length, eff: 0, contrib: 0, capped: f < 1 };
  }
  const active = CAT_KEYS.filter(k => cats[k].P > 0 && cats[k].w > 0);
  const tw = sum(active.map(k => cats[k].w));
  if (!tw) return { score: null, cats, active: [] };
  let total = 0;
  for (const k of active) { cats[k].eff = cats[k].w / tw; cats[k].contrib = cats[k].pct * cats[k].eff * 100; total += cats[k].contrib; }
  return { score: Math.round(total), cats, active };
}

/* ---------- Ranges ---------- */
export function rangeStats(dates) {
  const t = today();
  const days = dates.filter(d => d <= t);
  const rows = days.map(d => ({ date: d, comp: completion(d), sc: score(d) })).filter(r => r.comp.total > 0);
  const planned = sum(rows.map(r => r.comp.total)), done = sum(rows.map(r => r.comp.done));
  const scores = rows.filter(r => r.sc.score !== null);
  const catP = {}, catD = {};
  for (const k of CAT_KEYS) { catP[k] = 0; catD[k] = 0; }
  for (const r of rows) for (const k of CAT_KEYS) { catP[k] += r.sc.cats[k].P; catD[k] += r.sc.cats[k].D; }
  const catPct = {};
  for (const k of CAT_KEYS) catPct[k] = catP[k] ? Math.round((catD[k] / catP[k]) * 100) : null;
  const withData = CAT_KEYS.filter(k => catPct[k] !== null);
  const weakest = withData.length ? withData.reduce((a, b) => (catPct[b] < catPct[a] ? b : a)) : null;
  const best = scores.length ? scores.reduce((a, b) => (b.sc.score > a.sc.score ? b : a)) : null;
  return {
    days: rows.length, planned, done, comp: planned ? Math.round((done / planned) * 100) : null,
    avgScore: scores.length ? Math.round(sum(scores.map(r => r.sc.score)) / scores.length) : null,
    best: best ? { date: best.date, score: best.sc.score } : null, catPct, weakest, rows,
  };
}
export function catSeries(cat, dates) {
  return dates.map(d => { const c = score(d).cats[cat]; return { date: d, value: c.P ? Math.round((c.D / c.P) * 100) : null }; });
}

/* ---------- Streaks ---------- */
export function streak() {
  const { streakMin } = S().settings; const t = today(); const created = S().created;
  let n = 0, d = t;
  for (let i = 0; i < 800 && d >= created; i++, d = addDays(d, -1)) {
    const c = completion(d).pct;
    if (c === null) continue;
    if (c >= streakMin) n++; else if (d !== t) break;
  }
  return n;
}
export function bestStreak() {
  const { streakMin } = S().settings; let best = 0, run = 0;
  for (const d of range(S().created, today())) {
    const c = completion(d).pct;
    if (c === null) continue;
    if (c >= streakMin) { run++; best = Math.max(best, run); } else if (d !== today()) run = 0;
  }
  return best;
}

/* ---------- Habits ---------- */
export const habitScheduled = (h, d) => d >= h.start && (h.freq === 'weekly' ? true : h.days.includes(dow(d)));
export const habitDone = (h, d) => !!S().hlog[d]?.[h.id];
export function habitState(h, d) {
  const t = today();
  if (d < h.start) return 'pre';
  if (habitDone(h, d)) return 'done';
  if (d > t) return 'future';
  if (h.freq === 'weekly') return d === t ? 'today' : 'off';
  if (!h.days.includes(dow(d))) return 'off';
  return d === t ? 'today' : 'missed';
}
export function habitStreaks(h) {
  const t = today(); let run = 0, best = 0, total = 0;
  if (h.freq === 'weekly') {
    const thisWk = weekStart(t);
    for (let w = weekStart(h.start); w <= thisWk; w = addDays(w, 7)) {
      const cnt = range(w, addDays(w, 6)).filter(d => habitDone(h, d)).length;
      total += cnt;
      if (cnt >= h.target) { run++; best = Math.max(best, run); } else if (w !== thisWk) run = 0;
    }
    return { cur: run, best, total, unit: 'wk' };
  }
  for (const d of range(h.start, t)) {
    const done = habitDone(h, d);
    if (done) total++;
    if (!habitScheduled(h, d)) continue;
    if (done) { run++; best = Math.max(best, run); } else if (d !== t) run = 0;
  }
  return { cur: run, best, total, unit: 'd' };
}
export function habitRate(h, n = 30) {
  const days = lastNDays(n).filter(d => d >= h.start);
  if (!days.length) return null;
  if (h.freq === 'weekly') {
    const exp = (h.target * days.length) / 7;
    return exp ? clamp(Math.round((days.filter(d => habitDone(h, d)).length / exp) * 100), 0, 100) : null;
  }
  const sch = days.filter(d => habitScheduled(h, d));
  return sch.length ? pct(sch.filter(d => habitDone(h, d)).length, sch.length) : null;
}
export const activeHabits = () => S().habits.filter(h => !h.archived);
export function setHabit(id, date, on) {
  store.update(s => { const l = (s.hlog[date] ||= {}); if (on) l[id] = 1; else delete l[id]; if (!Object.keys(l).length) delete s.hlog[date]; });
}
export function weeklyHabitCount(h, date = today()) {
  const w = weekStart(date); return range(w, addDays(w, 6)).filter(d => habitDone(h, d)).length;
}

/* ---------- Fitness ---------- */
export function fitDay(d) {
  const l = S().fit.log[d]; const per = {}; let total = 0;
  for (const ex of S().fit.exercises) { per[ex.id] = sum(l?.sets?.[ex.id] || []); total += per[ex.id]; }
  return { per, total, trained: total > 0 };
}
export function targetsHit(d) {
  const ex = S().fit.exercises.filter(e => e.target > 0);
  if (!ex.length) return false;
  const { per } = fitDay(d);
  return ex.every(e => per[e.id] >= e.target);
}
export function workoutStreak() {
  let n = 0, d = today();
  if (!fitDay(d).trained) d = addDays(d, -1);
  while (d >= S().created && fitDay(d).trained) { n++; d = addDays(d, -1); }
  return n;
}
export const workoutDays = dates => dates.filter(d => fitDay(d).trained);

/* ---------- Career / learning ---------- */
export const appsIn = dates => { const set = new Set(dates); return S().career.apps.filter(a => a.date && set.has(a.date) && a.status !== 'Saved'); };
export const sessionMin = (dates, kind) => { const set = new Set(dates); return sum(S().sessions.filter(x => set.has(x.date) && (!kind || x.kind === kind)).map(x => x.min)); };
export function followUpsDue() {
  const t = today();
  return [...S().career.apps.filter(a => a.followUp && a.followUp <= t && !['Rejected', 'Offer'].includes(a.status)).map(a => ({ id: a.id, label: `${a.company} (${a.role || 'application'})`, date: a.followUp, kind: 'app' })),
    ...S().career.contacts.filter(c => c.followUp && c.followUp <= t && ['Awaiting', 'No response'].includes(c.outcome)).map(c => ({ id: c.id, label: c.company, date: c.followUp, kind: 'contact' }))];
}

/* ---------- Next up ---------- */
export function nextUp() {
  const { items } = dayPlan(today()); const now = toMin(nowHM());
  const pending = items.filter(i => !i.done);
  return pending.find(i => toMin(i.time) >= now) || null;
}
export function overdue() {
  const { items } = dayPlan(today()); const now = toMin(nowHM());
  return items.filter(i => !i.done && toMin(i.time) + Math.max(i.dur || 0, 15) < now);
}
