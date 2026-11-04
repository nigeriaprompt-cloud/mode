import * as store from '../store.js';
import { activeHabits, habitDone, habitState, habitStreaks, habitRate, setHabit, weeklyHabitCount, habitScheduled } from '../stats.js';
import { esc, today, addDays, addMonths, monthStart, monthEnd, range, lastNDays, dow, fmtMonth, fmtDate, uid, avg, WEEK_ORDER, DAYS, DAY1, parse, fmt12 } from '../util.js';
import { icon, bind, pageHead, catPill, field, seg, dayChips, catOptions, formModal, modal, confirmDlg, toast, empty } from '../ui.js';
import { dots } from '../charts.js';
import { burst } from '../fx.js';

const sched = h => (h.freq === 'weekly' ? `${h.target}× per week` : h.days.length === 7 ? 'Every day' : h.days.length === 5 && !h.days.includes(0) && !h.days.includes(6) ? 'Weekdays' : WEEK_ORDER.filter(i => h.days.includes(i)).map(i => DAYS[i]).join(' · '));

export function habitModal(h) {
  formModal({
    title: h ? 'Edit habit' : 'New habit', submit: h ? 'Save' : 'Create habit',
    html: `${field('Habit', `<input name="name" required maxlength="60" placeholder="e.g. Read 10 pages" value="${esc(h?.name || '')}">`)}
      <div class="row2">${field('Category', `<select name="cat">${catOptions(h?.cat || 'discipline')}</select>`)}${field('Reminder (optional)', `<input type="time" name="reminder" value="${esc(h?.reminder || '')}">`)}</div>
      ${field('How often?', seg('freq', [['daily', 'Daily / chosen days'], ['weekly', 'Weekly target']], h?.freq || 'daily'))}
      <div class="field" id="hd-days"><span>Days</span>${dayChips(h?.days || [0, 1, 2, 3, 4, 5, 6])}</div>
      <div class="field" id="hd-target" hidden><span>Times per week</span><select name="target">${[1, 2, 3, 4, 5, 6, 7].map(n => `<option ${n === (h?.target || 3) ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      ${field('Start tracking from', `<input type="date" name="start" value="${esc(h?.start || today())}" max="${today()}">`, 'Days before this are never counted as missed')}`,
    danger: h ? `<span class="btn-row"><button type="button" class="btn" data-arch>${icon('lock', 15)} ${h.archived ? 'Restore' : 'Archive'}</button><button type="button" class="btn danger" data-del>${icon('trash-2', 15)}</button></span>` : '',
    onOpen: (el, close, f) => {
      const sync = () => { const w = f.freq.value === 'weekly'; el.querySelector('#hd-days').hidden = w; el.querySelector('#hd-target').hidden = !w; };
      f.addEventListener('change', e => { if (e.target.name === 'freq') sync(); }); sync();
      el.querySelector('[data-arch]')?.addEventListener('click', () => { close(); store.update(s => { s.habits.find(x => x.id === h.id).archived = !h.archived; }); toast(h.archived ? 'Habit restored' : 'Archived. History is kept.'); });
      el.querySelector('[data-del]')?.addEventListener('click', async () => { if (await confirmDlg(`Delete “${h.name}” and all its history forever? Archive instead to keep history.`, 'Delete forever')) { close(); store.update(s => { s.habits = s.habits.filter(x => x.id !== h.id); Object.values(s.hlog).forEach(l => delete l[h.id]); s.acts.forEach(a => { if (a.habit === h.id) a.habit = null; }); }); } });
    },
    onSubmit: fd => {
      const freq = fd.get('freq'), days = fd.all('days').map(Number);
      if (freq === 'daily' && !days.length) { toast('Pick at least one day', { type: 'warn' }); return false; }
      const v = { name: fd.get('name'), cat: fd.get('cat'), reminder: fd.get('reminder'), freq, days: freq === 'daily' ? days : [0, 1, 2, 3, 4, 5, 6], target: +fd.get('target') || 3, start: fd.get('start') || today() };
      store.update(s => { if (h) Object.assign(s.habits.find(x => x.id === h.id), v); else s.habits.push({ id: uid(), archived: false, ...v }); });
      toast(h ? 'Habit updated' : 'Habit created');
    },
  });
}

function calendar(h, month) {
  const first = monthStart(month), last = monthEnd(month), lead = (dow(first) + 6) % 7;
  const cells = range(first, last).map(d => { const stt = habitState(h, d); return `<button class="cell ${stt} ${d === today() ? 'today' : ''}" data-d="${d}" ${stt === 'future' ? 'disabled' : ''} title="${esc(fmtDate(d))}${stt === 'done' ? ': done' : stt === 'missed' ? ': missed' : ''}">${parse(d).getDate()}</button>`; });
  return `<div class="cal-h">${WEEK_ORDER.map(i => `<span>${DAY1[i]}</span>`).join('')}</div><div class="cal">${'<i></i>'.repeat(lead)}${cells.join('')}</div>`;
}

export function openDetail(id) {
  let month = monthStart(today()), un = () => {};
  modal({
    title: store.get().habits.find(h => h.id === id)?.name || 'Habit', wide: true, body: '<div id="hdet"></div>', onClose: () => un(),
    onOpen: el => {
      const box = el.querySelector('#hdet');
      const render = () => {
        const h = store.get().habits.find(x => x.id === id); if (!h) return;
        const sk = habitStreaks(h), rate = habitRate(h, 30), u = sk.unit === 'wk' ? 'wk' : 'd';
        box.innerHTML = `<div class="sheet-meta">${catPill(h.cat)} <span class="muted">${esc(sched(h))}${h.reminder ? ` · reminder ${fmt12(h.reminder)}` : ''}</span><button class="btn sm ghost" data-edit>${icon('pencil', 14)} Edit</button></div>
          <div class="grid g4 mini-stats"><div class="mstat"><small>Current streak</small><b class="mono">${sk.cur}${u}</b></div><div class="mstat"><small>Longest streak</small><b class="mono">${sk.best}${u}</b></div><div class="mstat"><small>Total completions</small><b class="mono">${sk.total}</b></div><div class="mstat"><small>Last 30 days</small><b class="mono">${rate ?? '–'}%</b></div></div>
          <div class="cal-nav"><button class="btn icon ghost" data-m="-1" aria-label="Previous month">${icon('chevron-left', 17)}</button><b>${esc(fmtMonth(month))}</b><button class="btn icon ghost" data-m="1" aria-label="Next month" ${monthStart(month) >= monthStart(today()) ? 'disabled' : ''}>${icon('chevron-right', 17)}</button></div>
          ${calendar(h, month)}<p class="small muted">Tap a day to mark or unmark it. Missing a day only breaks the current streak. Your history, best streak and totals are never erased.</p>`;
      };
      render(); un = store.subscribe(render);
      el.addEventListener('click', e => {
        const c = e.target.closest('.cell'), m = e.target.closest('[data-m]');
        if (m) { month = addMonths(month, +m.dataset.m); render(); }
        if (c && !c.disabled) { const h = store.get().habits.find(x => x.id === id); setHabit(id, c.dataset.d, !habitDone(h, c.dataset.d)); }
        if (e.target.closest('[data-edit]')) { el.querySelector('[data-close]').click(); habitModal(store.get().habits.find(x => x.id === id)); }
      });
    },
  });
}

export default function habits(root) {
  const st = { month: monthStart(today()), showArch: false };

  function draw() {
    const s = store.get(), hs = activeHabits(), t = today(), arch = s.habits.filter(h => h.archived);
    const due = hs.filter(h => h.freq === 'weekly' || habitScheduled(h, t));
    const doneN = due.filter(h => habitDone(h, t)).length;
    const streaks = hs.map(h => ({ h, sk: habitStreaks(h) })).sort((a, b) => b.sk.cur - a.sk.cur);
    const rates = hs.map(h => habitRate(h, 30)).filter(x => x !== null);
    const days = range(st.month, monthEnd(st.month)), last7 = lastNDays(7);
    root.innerHTML = `${pageHead('Habits', 'Small, repeatable actions. A missed day never erases your history.', `<button class="btn primary" data-act="add">${icon('plus', 16)} New habit</button>`)}
      <div class="grid g3 stats"><div class="card stat"><div class="eyebrow mono">Today</div><div class="bignum mono">${doneN}<small>/${due.length} due</small></div></div>
        <div class="card stat"><div class="eyebrow mono">Best current streak</div><div class="bignum mono">${icon('flame', 22)}${streaks[0]?.sk.cur ?? 0}<small>${streaks[0] ? esc(streaks[0].h.name) : ''}</small></div></div>
        <div class="card stat"><div class="eyebrow mono">30-day consistency</div><div class="bignum mono">${rates.length ? Math.round(avg(rates)) : '–'}<small>%</small></div></div></div>
      <div class="card"><div class="card-h"><h3>Today</h3><span class="muted small">${doneN}/${due.length} done</span></div>
        ${hs.length ? `<div class="habit-list">${hs.map(h => {
          const sk = habitStreaks(h), isDue = h.freq === 'weekly' || habitScheduled(h, t), done = habitDone(h, t), rate = habitRate(h, 30);
          return `<div class="hrow c-${h.cat} ${done ? 'done' : ''} ${isDue ? '' : 'rest'}"><button class="chk" data-act="tog" data-id="${h.id}" aria-label="${done ? 'Unmark' : 'Mark done'}: ${esc(h.name)}">${icon('check', 16)}</button>
            <div class="hmain" data-act="detail" data-id="${h.id}" tabindex="0" role="button"><b>${esc(h.name)}</b><div class="act-s">${catPill(h.cat)}<span>${h.freq === 'weekly' ? `${weeklyHabitCount(h)}/${h.target} this week` : isDue ? esc(sched(h)) : 'Rest day'}</span></div></div>
            ${dots(last7.map(d => habitState(h, d)))}<span class="streak-chip" title="Current streak">${icon('flame', 13)}<b class="mono">${sk.cur}</b></span><span class="mono rate">${rate ?? '–'}%</span></div>`;
        }).join('')}</div>` : empty('No habits yet', 'Create your first habit.', '<button class="btn primary" data-act="add">New habit</button>')}</div>
      <div class="card"><div class="card-h"><h3>Monthly calendar</h3><div class="cal-nav inline"><button class="btn icon ghost" data-act="mprev" aria-label="Previous month">${icon('chevron-left', 17)}</button><b>${esc(fmtMonth(st.month))}</b><button class="btn icon ghost" data-act="mnext" aria-label="Next month" ${st.month >= monthStart(today()) ? 'disabled' : ''}>${icon('chevron-right', 17)}</button></div></div>
        ${hs.length ? `<div class="tbl-wrap"><table class="matrix"><thead><tr><th></th>${days.map(d => `<th class="${d === t ? 'tdy' : ''}">${parse(d).getDate()}</th>`).join('')}</tr></thead><tbody>
          ${hs.map(h => `<tr><th><button class="link" data-act="detail" data-id="${h.id}">${esc(h.name)}</button></th>${days.map(d => { const stt = habitState(h, d); return `<td><button class="mc ${stt}" data-act="mcell" data-id="${h.id}" data-d="${d}" ${stt === 'future' ? 'disabled' : ''} aria-label="${esc(h.name)} ${esc(d)}"></button></td>`; }).join('')}</tr>`).join('')}</tbody></table></div>
        <p class="small muted legend"><i class="d done"></i> done <i class="d missed"></i> missed <i class="d off"></i> not scheduled</p>` : '<p class="muted">Nothing to show.</p>'}</div>
      ${arch.length ? `<div class="card"><div class="card-h"><h3>Archived</h3></div><div class="list">${arch.map(h => `<div class="li"><div><b>${esc(h.name)}</b><small class="muted">History kept</small></div><button class="btn sm" data-act="restore" data-id="${h.id}">Restore</button></div>`).join('')}</div></div>` : ''}`;
  }

  bind(root, {
    add: () => habitModal(),
    tog: el => { const h = store.get().habits.find(x => x.id === el.dataset.id), on = !habitDone(h, today()); setHabit(h.id, today(), on); if (on) { const r = el.getBoundingClientRect(); burst(r.left + 14, r.top); } },
    detail: el => openDetail(el.dataset.id),
    mcell: el => { const h = store.get().habits.find(x => x.id === el.dataset.id); setHabit(h.id, el.dataset.d, !habitDone(h, el.dataset.d)); },
    mprev: () => { st.month = addMonths(st.month, -1); draw(); }, mnext: () => { if (st.month < monthStart(today())) { st.month = addMonths(st.month, 1); draw(); } },
    restore: el => store.update(s => { s.habits.find(h => h.id === el.dataset.id).archived = false; }),
  });
  const un = store.subscribe(draw); draw();
  return un;
}
