import * as store from '../store.js';
import { fitDay, workoutStreak, targetsHit, workoutDays } from '../stats.js';
import { esc, today, addDays, fmtLong, relDay, weekStart, range, lastNDays, fmtDate, sum, pct, uid, dow, nowHM, DAYS, parse } from '../util.js';
import { icon, bind, pageHead, bar, ring, field, seg, formModal, confirmDlg, toast, empty } from '../ui.js';
import { bars, area } from '../charts.js';
import { burst } from '../fx.js';

const UNITS = [['reps', 'Reps'], ['sec', 'Seconds'], ['min', 'Minutes'], ['km', 'Kilometres']];

export default function fitness(root) {
  const st = { date: today() };
  let restIv = 0, restLeft = 0;
  const S = () => store.get();

  function sessionLog(d = st.date) { const l = (S().fit.log[d] ||= { sets: {}, note: '', weight: '' }); l.sets ||= {}; return l; }

  function syncExerciseActivity() {
    if (!targetsHit(st.date)) return;
    store.update(s => {
      const a = s.acts.find(x => x.key === 'exercise' && !x.end && st.date >= x.start && x.days.includes(dow(st.date)));
      if (!a) return;
      const log = (s.logs[st.date] ||= { acts: {}, extra: [] }); log.acts ||= {};
      const l = (log.acts[a.id] ||= {});
      if (l.done) return;
      l.done = true; l.at = st.date === today() ? nowHM() : a.time; if (a.habit) (s.hlog[st.date] ||= {})[a.habit] = 1;
    });
    burst(0, 0, { big: true }); toast('All targets hit. Exercise ticked on your schedule.', { type: 'ok' });
  }

  function draw() {
    const s = S(), exs = s.fit.exercises, d = st.date, day = fitDay(d), log = s.fit.log[d] || {};
    const wk = weekStart(d), week = range(wk, addDays(wk, 6)), t14 = lastNDays(14, d);
    const trained7 = week.filter(x => fitDay(x).trained).length;
    const vol14 = t14.map(x => ({ label: String(parse(x).getDate()), value: fitDay(x).total || 0, title: `${fmtDate(x)}: ${fitDay(x).total} total` }));
    const wts = Object.entries(s.fit.log).filter(([, l]) => l.weight).sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(-30);
    const maxVol = Math.max(10, ...vol14.map(v => v.value));
    root.innerHTML = `${pageHead('Fitness', 'Strength, consistency and healthy living. Log every set, hit your daily targets.')}
      <div class="date-nav card"><button class="btn icon ghost" data-act="prev" aria-label="Previous day">${icon('chevron-left', 18)}</button><div class="dn-mid"><b>${esc(relDay(d))}</b><small class="muted">${esc(fmtLong(d))}</small></div><button class="btn icon ghost" data-act="next" aria-label="Next day" ${d >= today() ? 'disabled' : ''}>${icon('chevron-right', 18)}</button>${d !== today() ? '<button class="btn sm" data-act="todayBtn">Today</button>' : ''}</div>
      <div class="grid g4 stats">
        <div class="card stat"><div class="eyebrow mono">Streak</div><div class="bignum mono">${icon('flame', 22)}<span>${workoutStreak()}</span><small>days</small></div></div>
        <div class="card stat"><div class="eyebrow mono">This week</div><div class="bignum mono">${trained7}<small>/7 days</small></div></div>
        <div class="card stat"><div class="eyebrow mono">${d === today() ? 'Today' : 'That day'}</div><div class="bignum mono">${day.total}<small>total reps</small></div></div>
        <div class="card stat"><div class="eyebrow mono">Targets</div><div class="bignum mono">${targetsHit(d) ? 'Hit' : exs.filter(e => e.target && day.per[e.id] >= e.target).length + '/' + exs.filter(e => e.target).length}</div></div>
      </div>
      <div class="dash">
        <div class="stack">${exs.length ? exs.map(e => {
          const sets = log.sets?.[e.id] || [], tot = day.per[e.id], step = e.step || 10;
          return `<div class="card exc"><div class="exc-h"><div><b>${esc(e.name)}</b><small class="muted"> ${esc(e.unit)}</small></div><span class="mono"><b>${tot}</b>${e.target ? ` / ${e.target}` : ''}</span><button class="btn icon ghost" data-act="editEx" data-id="${e.id}" aria-label="Edit ${esc(e.name)}">${icon('pencil', 15)}</button></div>
            ${e.target ? bar(pct(tot, e.target), tot >= e.target ? 'var(--ok)' : 'var(--c-fitness)') : ''}
            <div class="sets">${sets.length ? sets.map((n, i) => `<button class="set" data-act="delset" data-id="${e.id}" data-i="${i}" title="Remove this set">${n}<i>${icon('x', 11)}</i></button>`).join('') : '<span class="muted small">No sets yet</span>'}</div>
            <form class="exc-add" data-submit="addset" data-id="${e.id}"><input type="number" name="n" min="1" inputmode="numeric" placeholder="${step}" aria-label="Number for ${esc(e.name)}"><button class="btn primary sm" type="submit">${icon('plus', 14)} Add set</button>
              <span class="quick">${[step, step * 2, step * 5].map(n => `<button type="button" class="chip" data-act="quick" data-id="${e.id}" data-n="${n}">+${n}</button>`).join('')}</span></form></div>`;
        }).join('') : empty('No exercises', 'Add an exercise to start tracking.', '<button class="btn primary" data-act="addEx">Add exercise</button>')}
          <div class="card"><div class="card-h"><h3>Session notes</h3></div>
            <div class="row2">${field('Body weight (kg)', `<input type="number" step="0.1" inputmode="decimal" data-change="weight" value="${esc(log.weight || '')}" placeholder="optional">`)}
            ${field('How did it feel?', `<input data-change="note" value="${esc(log.note || '')}" placeholder="Energy, soreness, PBs…" maxlength="160">`)}</div></div></div>
        <div class="stack">
          <div class="card"><div class="card-h"><h3>${icon('timer', 17)} Rest timer</h3></div>
            <div class="rest mono" id="rest">${restLeft ? restLeft + 's' : '--'}</div>
            <div class="btn-row center">${[30, 60, 90].map(n => `<button class="btn sm" data-act="rest" data-n="${n}">${n}s</button>`).join('')}<button class="btn sm ghost" data-act="rest" data-n="0">Stop</button></div></div>
          <div class="card"><div class="card-h"><h3>Exercises</h3><button class="btn sm" data-act="addEx">${icon('plus', 14)} Add</button></div>
            <div class="list">${exs.map(e => `<div class="li"><div><b>${esc(e.name)}</b><small class="muted">Target ${e.target || '–'} ${esc(e.unit)}/day · quick +${e.step || 10}</small></div><button class="btn icon ghost" data-act="editEx" data-id="${e.id}" aria-label="Edit">${icon('pencil', 15)}</button></div>`).join('') || '<p class="muted">None yet.</p>'}</div></div>
          <div class="card"><div class="card-h"><h3>Personal bests (one day)</h3></div>
            ${exs.map(e => { const best = Math.max(0, ...Object.keys(s.fit.log).map(x => fitDay(x).per[e.id] || 0)); const all = sum(Object.keys(s.fit.log).map(x => fitDay(x).per[e.id] || 0)); return `<div class="kv"><span>${esc(e.name)}</span><b class="mono">${best} <small class="muted">· ${all} all-time</small></b></div>`; }).join('') || '<p class="muted">–</p>'}</div>
        </div>
      </div>
      <div class="grid g2"><div class="card"><div class="card-h"><h3>Volume, last 14 days</h3><span class="muted small">total reps per day</span></div>${bars(vol14, { max: maxVol, ticks: [0, Math.round(maxVol / 2), maxVol], hi: 13, h: 190, color: 'var(--c-fitness)' })}</div>
        <div class="card"><div class="card-h"><h3>Body weight</h3><span class="muted small">kg</span></div>${wts.length > 1 ? area(wts.map(([x, l]) => ({ label: fmtDate(x, { day: 'numeric', month: 'short' }), value: +l.weight })), { min: Math.floor(Math.min(...wts.map(w => +w[1].weight))) - 1, max: Math.ceil(Math.max(...wts.map(w => +w[1].weight))) + 1, ticks: [Math.floor(Math.min(...wts.map(w => +w[1].weight))), Math.ceil(Math.max(...wts.map(w => +w[1].weight)))], color: 'var(--c-fitness)', labelEvery: Math.ceil(wts.length / 5), h: 190 }) : '<p class="muted">Log your weight in two or more sessions to see the trend.</p>'}</div></div>`;
  }

  function exModal(ex) {
    formModal({
      title: ex ? `Edit ${ex.name}` : 'Add exercise', submit: ex ? 'Save' : 'Add',
      html: `${field('Name', `<input name="name" required maxlength="40" placeholder="e.g. Pull-ups" value="${esc(ex?.name || '')}">`)}
        <div class="row2">${field('Unit', `<select name="unit">${UNITS.map(([v, l]) => `<option value="${v}" ${ex?.unit === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
        ${field('Daily target', `<input type="number" name="target" min="0" value="${ex?.target ?? 50}">`, '0 = no target')}</div>
        ${field('Quick-add step', `<input type="number" name="step" min="1" value="${ex?.step ?? 10}">`, 'Buttons add this many, 2× and 5×')}`,
      danger: ex ? `<button type="button" class="btn danger" data-del>${icon('trash-2', 15)} Delete</button>` : '',
      onOpen: (el, close) => el.querySelector('[data-del]')?.addEventListener('click', async () => { if (await confirmDlg(`Delete ${ex.name}? Its logged sets will also be removed.`)) { close(); store.update(s => { s.fit.exercises = s.fit.exercises.filter(e => e.id !== ex.id); Object.values(s.fit.log).forEach(l => delete l.sets?.[ex.id]); }); } }),
      onSubmit: fd => store.update(s => {
        const v = { name: fd.get('name'), unit: fd.get('unit'), target: +fd.get('target') || 0, step: Math.max(1, +fd.get('step') || 10) };
        if (ex) Object.assign(s.fit.exercises.find(e => e.id === ex.id), v); else s.fit.exercises.push({ id: uid(), ...v });
      }),
    });
  }

  function addSet(id, n) {
    n = Math.round(+n); if (!n || n < 1) { toast('Enter a number above 0', { type: 'warn' }); return; }
    const was = targetsHit(st.date);
    store.update(s => { const l = (s.fit.log[st.date] ||= { sets: {}, note: '', weight: '' }); l.sets ||= {}; (l.sets[id] ||= []).push(n); });
    if (!was) syncExerciseActivity();
  }

  bind(root, {
    prev: () => { st.date = addDays(st.date, -1); draw(); }, next: () => { if (st.date < today()) { st.date = addDays(st.date, 1); draw(); } }, todayBtn: () => { st.date = today(); draw(); },
    addset: (form, e) => { e.preventDefault(); addSet(form.dataset.id, form.n.value); },
    quick: el => addSet(el.dataset.id, el.dataset.n),
    delset: el => store.update(s => { const a = s.fit.log[st.date]?.sets?.[el.dataset.id]; a?.splice(+el.dataset.i, 1); }),
    addEx: () => exModal(), editEx: el => exModal(S().fit.exercises.find(e => e.id === el.dataset.id)),
    weight: el => store.update(s => { sessionLog().weight = el.value; }, { silent: true }),
    note: el => store.update(s => { sessionLog().note = el.value; }, { silent: true }),
    rest: el => {
      clearInterval(restIv); restLeft = +el.dataset.n; const out = () => { const r = root.querySelector('#rest'); if (r) r.textContent = restLeft ? restLeft + 's' : '--'; };
      out(); if (!restLeft) return;
      restIv = setInterval(() => { restLeft--; out(); if (restLeft <= 0) { clearInterval(restIv); restLeft = 0; out(); navigator.vibrate?.([200, 100, 200]); toast('Rest over. Next set!', { type: 'ok' }); } }, 1000);
    },
  });
  const un = store.subscribe(draw); draw();
  return () => { un(); clearInterval(restIv); };
}
