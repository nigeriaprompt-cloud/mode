import * as store from '../store.js';
import * as fx from '../fx.js';
import { CATS, VERSES } from '../store.js';
import { dayPlan, completion, score, streak, bestStreak, fitDay, workoutStreak, catSeries, sessionMin, appsIn, followUpsDue, nextUp, overdue } from '../stats.js';
import { esc, today, nowHM, toMin, fmt12, fmtLong, greeting, lastNDays, addDays, weekStart, range, fmtDate, hrs, avg, pct, DAYS, parse } from '../util.js';
import { icon, ring, bar, catPill, empty, pageHead } from '../ui.js';
import { bind } from '../ui.js';
import { bars } from '../charts.js';
import { rowHtml, actHandlers, reschedule, openBreakdown, openActivityEditor } from '../acts.js';

const ago = n => `${n} day${n === 1 ? '' : 's'}`;
const mins = m => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60 ? (m % 60) + 'm' : ''}`.trim() : `${m} min`);

function type(el, text, speed = 32) {
  if (!fx.motionOn()) { el.textContent = text; return; }
  el.textContent = ''; let i = 0;
  const t = setInterval(() => { el.textContent = text.slice(0, ++i); if (i >= text.length) clearInterval(t); }, speed);
}

export default function dashboard(root) {
  const t = today(); let hx, mx;
  const dayIdx = Math.floor((parse(t) - new Date(parse(t).getFullYear(), 0, 0)) / 864e5);
  const [vref, vtext] = VERSES[dayIdx % VERSES.length];
  const s0 = store.get();

  root.innerHTML = `<section class="hero" data-tilt><canvas id="mx" aria-hidden="true"></canvas><canvas id="hx" aria-hidden="true"></canvas>
    <div class="hero-in"><div class="eyebrow mono">// ${esc(fmtLong(t))}</div>
    <h1 class="hero-h"><span id="greet"></span></h1>
    ${s0.settings.verse ? `<p class="verse">“${esc(vtext)}” <b>${esc(vref)}</b></p>` : ''}
    <div class="btn-row" id="heroCta"></div></div></section><div id="body"></div>`;
  type(root.querySelector('#greet'), `${greeting()}${s0.settings.name ? ', ' + s0.settings.name : ''}.`);
  hx = fx.helix(root.querySelector('#hx')); mx = fx.matrix(root.querySelector('#mx'), { size: 14, fps: 18, fade: 0.08 });
  const body = root.querySelector('#body');

  function draw() {
    const s = store.get(), { items, moved } = dayPlan(t), comp = completion(t), sc = score(t), now = toMin(nowHM());
    const pending = items.filter(i => !i.done), done = items.filter(i => i.done), late = overdue();
    const st = streak(), best = bestStreak(), nx = nextUp(), ci = s.checkins[t] || {};
    const last7 = lastNDays(7), wkStart = weekStart(t), wk = range(wkStart, addDays(wkStart, 6));
    const week = last7.map((d, i) => { const c = completion(d), r = score(d); return { label: d === t ? 'Today' : DAYS[parse(d).getDay()], value: r.score, title: `${fmtDate(d)} · score ${r.score ?? '–'} · ${c.done}/${c.total} done` }; });
    const wkScores = week.map(w => w.value).filter(v => v !== null);
    const bestDay = week.reduce((a, b) => ((b.value ?? -1) > (a.value ?? -1) ? b : a), week[0]);

    root.querySelector('#heroCta').innerHTML = `${new Date().getHours() < 14 ? `<a class="btn primary" href="#/checkin">${icon('sunrise', 16)} ${ci.morning ? 'Morning check-in ✓' : 'Morning check-in'}</a>` : `<a class="btn primary" href="#/checkin">${icon('moon', 16)} ${ci.evening ? 'Evening review ✓' : 'Evening review'}</a>`}<a class="btn" href="#/fitness">${icon('dumbbell', 16)} Log workout</a>`;

    // ---- pillar helpers
    const fd = fitDay(t), exs = s.fit.exercises;
    const wkTrained = wk.filter(d => fitDay(d).trained).length;
    const catToday = k => { const c = sc.cats[k]; return c.P ? Math.round((c.D / c.P) * 100) : null; };
    const cat7 = k => { const v = catSeries(k, last7).map(x => x.value).filter(x => x !== null); return v.length ? Math.round(avg(v)) : null; };
    const catItems = k => items.filter(i => i.cat === k);
    const appsWk = appsIn(wk).length, target = s.settings.weeklyApps || 5;
    const interviews = s.career.apps.filter(a => a.status === 'Interview').length;
    const fu = followUpsDue();
    const promptMin = sessionMin(wk, 'focus') + 0; const bizMin = sum_(s.sessions.filter(x => wk.includes(x.date) && ['ThePrompt', 'JavaScript', 'PHP & MySQL'].includes(x.domain)).map(x => x.min));
    const learnWk = sessionMin(wk, 'learn');
    const showBackup = s.settings.lastBackup ? (new Date(t) - new Date(s.settings.lastBackup)) / 864e5 > 7 : (new Date(t) - new Date(s.created)) / 864e5 >= 3;

    const pill = (k, v) => `<div class="pillar-h">${catPill(k)}<b class="mono">${v === null ? '–' : v + '%'}</b></div>`;
    const miniList = k => catItems(k).length ? `<ul class="mini">${catItems(k).map(i => `<li class="${i.done ? 'ok' : ''}">${icon(i.done ? 'check-circle-2' : 'clock', 14)}<span>${esc(i.title)}</span><small class="mono">${i.done && i.at ? fmt12(i.at) : fmt12(i.time)}</small></li>`).join('')}</ul>` : '<p class="muted small">Nothing planned today.</p>';

    // schedule with NOW marker
    let sched = '', placed = false;
    for (const it of items) {
      if (!placed && toMin(it.time) > now && items.some(x => toMin(x.time) <= now)) { sched += `<div class="nowline"><span class="mono">NOW · ${fmt12(nowHM())}</span></div>`; placed = true; }
      sched += rowHtml(it, t);
    }

    body.innerHTML = `
      ${showBackup ? `<div class="banner">${icon('info', 18)}<span>Your data lives only in this browser. Download a backup so you never lose your progress.</span><button class="btn sm" data-act="backup">Back up now</button></div>` : ''}
      <div class="grid g4 stats">
        <div class="card stat" data-tilt>
          <div class="eyebrow mono">Today</div>
          ${ring({ value: comp.pct, size: 128, stroke: 11, label: 'complete' })}
          <small class="muted">${comp.done} of ${comp.total} activities</small>
        </div>
        <div class="card stat" data-tilt>
          <div class="eyebrow mono">Daily streak</div>
          <div class="orbit3d"><i></i><i></i><i></i><div class="orbit-c">${icon('flame', 22)}<b class="mono" data-count="${st}">${st}</b></div></div>
          <small class="muted">Best ${ago(best)} · day counts at ${s.settings.streakMin}%+</small>
        </div>
        <div class="card stat" data-tilt>
          <div class="eyebrow mono">Discipline score</div>
          <div class="bignum mono"><span data-count="${sc.score ?? 0}">${sc.score ?? '–'}</span><small>/100</small></div>
          ${bar(sc.score || 0)}
          <button class="link" data-act="how">How is this calculated?</button>
        </div>
        <div class="card stat" data-tilt>
          <div class="eyebrow mono">${nx ? 'Next up' : late.length ? 'Catch up' : 'All clear'}</div>
          ${nx ? `<div class="next"><b>${esc(nx.title)}</b><span class="mono big2">${fmt12(nx.time)}</span><small class="muted">in ${mins(toMin(nx.time) - now)}</small></div>`
            : late.length ? `<div class="next"><b>${late.length} missed</b><small class="muted">${esc(late[0].title)}${late.length > 1 ? ` and ${late.length - 1} more` : ''}</small><button class="btn sm" data-act="resched" data-id="${late[0].uid}">${icon('calendar-clock', 14)} Reschedule</button></div>`
            : `<div class="next"><b>Nothing left today</b><small class="muted">${comp.total ? 'Review your day, then rest well.' : 'Add activities to build your day.'}</small></div>`}
        </div>
      </div>

      <div class="card focus-card">
        <div class="card-h"><h3>${icon('target', 18)} Today's focus</h3><a class="btn sm ghost" href="#/checkin">${ci.morning ? 'Edit check-in' : 'Do morning check-in'}</a></div>
        ${ci.morning?.priority || ci.morning?.goals?.some(Boolean) ? `<div class="focus-grid"><div class="prio"><small class="eyebrow mono">Biggest priority</small><b>${esc(ci.morning.priority || '—')}</b></div><ol class="goals3">${(ci.morning.goals || []).filter(Boolean).map(g => `<li>${esc(g)}</li>`).join('')}</ol></div>` : `<p class="muted">You haven't set today's priorities yet. Name your biggest priority and your three most important goals.</p>`}
      </div>

      <div class="dash">
        <div class="card"><div class="card-h"><h3>${icon('calendar-clock', 18)} Today's schedule</h3><span class="muted small mono">${items.length} activities</span></div>
          ${items.length ? `<div class="acts">${sched}</div>` : empty('No activities for today', 'Add your first activity to build the day.', '<button class="btn primary" data-act="add">Add activity</button>')}
          ${moved.length ? `<p class="muted small moved">${icon('arrow-right', 13)} Moved off today: ${moved.map(m => `${esc(m.title)} → ${esc(fmtDate(m.movedTo))}`).join(', ')}</p>` : ''}
        </div>
        <div class="stack">
          <div class="card"><div class="card-h"><h3>${icon('clock', 18)} Pending</h3><span class="badge ${late.length ? 'warn' : ''}">${pending.length}</span></div>
            ${pending.length ? `<div class="acts compact">${pending.slice(0, 6).map(i => `<div class="pend">${rowHtml(i, t, { compact: true })}<button class="btn icon ghost" data-act="resched" data-id="${i.uid}" title="Reschedule">${icon('calendar-clock', 16)}</button></div>`).join('')}${pending.length > 6 ? `<p class="muted small">+${pending.length - 6} more in your schedule</p>` : ''}</div>` : '<p class="muted">Nothing pending. Nicely done.</p>'}
          </div>
          <div class="card"><div class="card-h"><h3>${icon('check-circle-2', 18)} Completed</h3><span class="badge ok">${done.length}</span></div>
            ${done.length ? `<div class="acts compact">${done.map(i => rowHtml(i, t, { compact: true })).join('')}</div>` : '<p class="muted">Tick off your first activity to see it here.</p>'}
          </div>
        </div>
      </div>

      <div class="grid g4 pillars">
        <div class="card" data-tilt>${pill('fitness', catToday('fitness'))}<h4>${icon('dumbbell', 16)} Workout summary</h4>
          ${exs.length ? exs.map(e => `<div class="ex"><div class="ex-l"><span>${esc(e.name)}</span><b class="mono">${fd.per[e.id]}${e.target ? ' / ' + e.target : ''}</b></div>${bar(e.target ? pct(fd.per[e.id], e.target) : fd.per[e.id] ? 100 : 0, 'var(--c-fitness)')}</div>`).join('') : '<p class="muted small">No exercises yet.</p>'}
          ${s.nutrition?.setup ? (() => { const ml = items.filter(i => i.key?.startsWith('meal_')); return `<div class="kv"><span>Meals eaten today</span><b class="mono">${ml.filter(i => i.done).length}/${ml.length}</b></div>`; })() : ''}
          <div class="foot-line"><span class="muted small">${wkTrained}/7 days this week</span><span class="muted small">${icon('flame', 13)} ${workoutStreak()} day streak</span></div>
          <a class="btn sm" href="#/fitness">Log workout</a></div>
        <div class="card" data-tilt>${pill('spiritual', catToday('spiritual'))}<h4>${icon('sparkles', 16)} Spiritual progress</h4>${miniList('spiritual')}
          <div class="foot-line"><span class="muted small">7-day consistency</span><b class="mono">${cat7('spiritual') ?? '–'}%</b></div></div>
        <div class="card" data-tilt>${pill('business', catToday('business'))}<h4>${icon('rocket', 16)} Business progress</h4>${miniList('business')}
          <div class="foot-line"><span class="muted small">Build time this week</span><b class="mono">${hrs(bizMin)}h</b></div></div>
        <div class="card" data-tilt>${pill('career', catToday('career'))}<h4>${icon('briefcase', 16)} Career progress</h4>
          <div class="ex"><div class="ex-l"><span>Applications this week</span><b class="mono">${appsWk} / ${target}</b></div>${bar(pct(appsWk, target), 'var(--c-career)')}</div>
          <div class="kv"><span>Interviews in play</span><b class="mono">${interviews}</b></div><div class="kv"><span>Follow-ups due</span><b class="mono ${fu.length ? 'warn' : ''}">${fu.length}</b></div><div class="kv"><span>Learning this week</span><b class="mono">${hrs(learnWk)}h</b></div>
          <a class="btn sm" href="#/career">Open career</a></div>
      </div>

      <div class="card"><div class="card-h"><h3>${icon('trending-up', 18)} Weekly performance</h3>
        <span class="muted small">Avg <b class="mono">${wkScores.length ? Math.round(avg(wkScores)) : '–'}</b> · Best <b class="mono">${bestDay?.value != null ? bestDay.label + ' ' + bestDay.value : '–'}</b></span></div>
        ${bars(week, { hi: 6, h: 200, fmt: v => v })}<p class="muted small">Daily discipline score for the last 7 days.</p></div>`;
  }

  const un = store.subscribe(draw); draw();
  const h = {
    ...actHandlers(() => t),
    resched: el => reschedule(el.dataset.id, t),
    how: () => openBreakdown(t), add: () => openActivityEditor(null, { quick: true }),
    backup: () => { store.backup(); },
  };
  bind(root, h);
  const iv = setInterval(() => { if (!document.hidden && !document.querySelector('.modal-bg')) draw(); }, 60000);
  return () => { un(); clearInterval(iv); hx.stop(); mx.stop(); };
}
const sum_ = a => a.reduce((x, y) => x + y, 0);
