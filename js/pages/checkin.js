import * as store from '../store.js';
import { dayLog } from '../store.js';
import { dayPlan, completion, score, fitDay } from '../stats.js';
import { esc, today, addDays, fmtLong, fmtDate, relDay, nowHM, dow, formData, fmt12 } from '../util.js';
import { icon, bind, tabs, pageHead, field, seg, toast, empty } from '../ui.js';
import { burst } from '../fx.js';

const WORKOUTS = ['Push-ups, sit-ups, squats', 'Upper body', 'Lower body', 'Cardio / run', 'Rest day', 'Mobility and stretching'];

export default function checkin(root) {
  const st = { tab: new Date().getHours() < 15 ? 'morning' : 'evening', date: today() };
  const get = () => store.get().checkins[st.date] || {};
  const badge = (ok, ts) => ok ? `<span class="badge ok">${icon('check', 12)} saved${ts ? ' ' + new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>` : '<span class="badge">not done</span>';

  function morning() {
    const m = get().morning || {}, prev = store.get().checkins[addDays(st.date, -1)]?.evening?.improve;
    return `${prev ? `<div class="banner soft">${icon('info', 18)}<span><b>Yesterday you wanted to improve:</b> ${esc(prev)}</span></div>` : ''}
    <form class="form card pad" data-submit="saveM" novalidate>
      <div class="card-h"><h3>${icon('sunrise', 18)} Morning check-in</h3>${badge(!!m.savedAt, m.savedAt)}</div>
      <div class="row2">${field('Wake-up time', `<input type="time" name="wake" value="${esc(m.wake || '')}">`)}${field('Sleep duration (hours)', `<input type="number" name="sleep" min="0" max="16" step="0.25" inputmode="decimal" placeholder="7.5" value="${esc(m.sleep ?? '')}">`)}</div>
      <div class="row2">${field('Morning prayer completed?', seg('prayer', [['yes', 'Yes'], ['no', 'Not yet']], m.prayer || 'no'))}${field('Bible study completed?', seg('bible', [['yes', 'Yes'], ['no', 'Not yet']], m.bible || 'no'))}</div>
      ${field('Planned workout', `<input name="workout" list="wo" placeholder="What will you train today?" value="${esc(m.workout || '')}"><datalist id="wo">${WORKOUTS.map(w => `<option value="${esc(w)}">`).join('')}</datalist>`)}
      <div class="field"><span>Three most important goals today</span>
        ${[0, 1, 2].map(i => `<div class="numbered"><b class="mono">${i + 1}</b><input name="g${i}" placeholder="${['The must-do', 'The important one', 'The one that moves things forward'][i]}" value="${esc(m.goals?.[i] || '')}" maxlength="120"></div>`).join('')}</div>
      ${field("Today's biggest priority", `<input name="priority" placeholder="If I only do one thing today…" value="${esc(m.priority || '')}" maxlength="140">`)}
      <div class="form-foot"><span class="muted small">Saving also ticks Wake up, Morning prayer and Bible study on your schedule when answered.</span><span class="grow"></span><button class="btn primary" type="submit">${m.savedAt ? 'Update check-in' : 'Save check-in'}</button></div>
    </form>`;
  }

  function evening() {
    const e = get().evening || {}, c = completion(st.date), sc = score(st.date), trained = fitDay(st.date).trained;
    const ex = e.exercised || (trained ? 'yes' : 'no');
    return `<div class="grid g3 sum"><div class="card stat"><div class="eyebrow mono">Completed</div><div class="bignum mono">${c.done}<small>/${c.total}</small></div></div>
      <div class="card stat"><div class="eyebrow mono">Score</div><div class="bignum mono">${sc.score ?? '–'}<small>/100</small></div></div>
      <div class="card stat"><div class="eyebrow mono">Workout</div><div class="bignum mono">${trained ? 'Logged' : '–'}</div></div></div>
    <form class="form card pad" data-submit="saveE" novalidate>
      <div class="card-h"><h3>${icon('moon', 18)} Evening review</h3>${badge(!!e.savedAt, e.savedAt)}</div>
      ${field('What did I accomplish?', `<textarea name="done" rows="3" placeholder="Wins, big or small">${esc(e.done || '')}</textarea>`)}
      ${field('What did I fail to complete?', `<textarea name="failed" rows="3" placeholder="Be honest, then forgive and plan">${esc(e.failed || '')}</textarea>`)}
      <button type="button" class="btn sm ghost" data-act="fill">${icon('list-checks', 15)} Fill from my pending list</button>
      ${field('What distracted me?', `<textarea name="distract" rows="2" placeholder="Phone, social media, people, tiredness…">${esc(e.distract || '')}</textarea>`)}
      <div class="row2">${field('Did I exercise?', seg('exercised', [['yes', 'Yes'], ['no', 'No']], ex))}${field('Did I spend time productively?', seg('productive', [['yes', 'Yes'], ['partly', 'Partly'], ['no', 'No']], e.productive || 'partly'))}</div>
      ${field('What did I learn?', `<textarea name="learned" rows="2">${esc(e.learned || '')}</textarea>`)}
      ${field('What should I improve tomorrow?', `<textarea name="improve" rows="2" placeholder="One concrete change">${esc(e.improve || '')}</textarea>`)}
      <div class="form-foot"><span class="grow"></span><button class="btn primary" type="submit">${e.savedAt ? 'Update review' : 'Save review'}</button></div>
    </form>`;
  }

  function history() {
    const all = Object.entries(store.get().checkins).sort((a, b) => (a[0] < b[0] ? 1 : -1));
    if (!all.length) return empty('No check-ins yet', 'Your saved morning and evening check-ins will appear here.');
    return `<div class="hist">${all.map(([d, c]) => `<div class="card pad"><div class="card-h"><h3>${esc(fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' }))}</h3><span>${c.morning ? '<span class="badge ok">AM</span>' : ''} ${c.evening ? '<span class="badge ok">PM</span>' : ''}</span></div>
      ${c.morning ? `<div class="h-sec"><small class="eyebrow mono">Morning</small><p>${c.morning.wake ? `Woke ${fmt12(c.morning.wake)}` : ''}${c.morning.sleep ? ` · slept ${esc(c.morning.sleep)}h` : ''} · prayer ${c.morning.prayer === 'yes' ? '✓' : '✗'} · Bible ${c.morning.bible === 'yes' ? '✓' : '✗'}${c.morning.workout ? ` · ${esc(c.morning.workout)}` : ''}</p>
        ${c.morning.priority ? `<p><b>Priority:</b> ${esc(c.morning.priority)}</p>` : ''}${c.morning.goals?.some(Boolean) ? `<ol>${c.morning.goals.filter(Boolean).map(g => `<li>${esc(g)}</li>`).join('')}</ol>` : ''}</div>` : ''}
      ${c.evening ? `<div class="h-sec"><small class="eyebrow mono">Evening</small>${[['Accomplished', 'done'], ['Not completed', 'failed'], ['Distractions', 'distract'], ['Learned', 'learned'], ['Improve tomorrow', 'improve']].filter(([, k]) => c.evening[k]).map(([l, k]) => `<p><b>${l}:</b> ${esc(c.evening[k])}</p>`).join('')}<p class="muted small">Exercised: ${esc(c.evening.exercised || '–')} · Productive: ${esc(c.evening.productive || '–')}</p></div>` : ''}
      <button class="btn sm" data-act="edit" data-d="${d}" data-t="${c.morning && !c.evening ? 'morning' : 'evening'}">Edit</button></div>`).join('')}</div>`;
  }

  function draw() {
    const g = get();
    root.innerHTML = `${pageHead('Daily check-in', 'Start the day with intention and end it with honest review. Every check-in is saved on this device.')}
      <div class="date-nav card"><button class="btn icon ghost" data-act="prev" aria-label="Previous day">${icon('chevron-left', 18)}</button><div class="dn-mid"><b>${esc(relDay(st.date))}</b><small class="muted">${esc(fmtLong(st.date))}</small></div><button class="btn icon ghost" data-act="next" aria-label="Next day" ${st.date >= today() ? 'disabled' : ''}>${icon('chevron-right', 18)}</button>${st.date !== today() ? '<button class="btn sm" data-act="todayBtn">Today</button>' : ''}</div>
      ${tabs([['morning', 'Morning', g.morning ? '✓' : undefined], ['evening', 'Evening', g.evening ? '✓' : undefined], ['history', 'History']], st.tab)}<div class="gap"></div>
      ${st.tab === 'morning' ? morning() : st.tab === 'evening' ? evening() : history()}`;
  }

  function mark(s, key, at) {
    const a = s.acts.find(x => x.key === key && !x.end && st.date >= x.start && x.days.includes(dow(st.date)));
    if (!a) return;
    const l = (dayLog(st.date).acts[a.id] ||= {});
    if (l.done || l.movedTo) return;
    l.done = true; l.at = at || nowHM();
    if (a.habit) (s.hlog[st.date] ||= {})[a.habit] = 1;
  }

  bind(root, {
    tab: el => { st.tab = el.dataset.v; draw(); },
    prev: () => { st.date = addDays(st.date, -1); draw(); }, next: () => { if (st.date < today()) { st.date = addDays(st.date, 1); draw(); } }, todayBtn: () => { st.date = today(); draw(); },
    edit: el => { st.date = el.dataset.d; st.tab = el.dataset.t; draw(); scrollTo(0, 0); },
    fill: () => {
      const pend = dayPlan(st.date).items.filter(i => !i.done).map(i => i.title);
      const t = root.querySelector('[name=failed]'); t.value = pend.length ? pend.join(', ') : 'Nothing. I completed everything.'; t.focus();
    },
    saveM: (form, e) => {
      e.preventDefault(); const fd = formData(form);
      const m = { wake: fd.get('wake'), sleep: fd.get('sleep'), prayer: fd.get('prayer'), bible: fd.get('bible'), workout: fd.get('workout'), goals: [0, 1, 2].map(i => fd.get('g' + i)), priority: fd.get('priority'), savedAt: Date.now() };
      store.update(s => {
        (s.checkins[st.date] ||= {}).morning = m;
        if (m.wake) mark(s, 'wake', m.wake);
        if (m.prayer === 'yes') mark(s, 'prayer_am', m.wake || nowHM());
        if (m.bible === 'yes') mark(s, 'bible', nowHM());
      });
      burst(innerWidth / 2, innerHeight / 2); toast('Morning check-in saved. Make it count.', { type: 'ok' }); st.tab = 'evening' === st.tab ? st.tab : 'morning'; draw();
    },
    saveE: (form, e) => {
      e.preventDefault(); const fd = formData(form);
      const ev = { done: fd.get('done'), failed: fd.get('failed'), distract: fd.get('distract'), exercised: fd.get('exercised'), productive: fd.get('productive'), learned: fd.get('learned'), improve: fd.get('improve'), savedAt: Date.now() };
      store.update(s => { (s.checkins[st.date] ||= {}).evening = ev; if (ev.exercised === 'yes') mark(s, 'exercise'); });
      toast('Evening review saved. Rest well.', { type: 'ok' }); draw();
    },
  });
  draw();
  return () => {};
}
