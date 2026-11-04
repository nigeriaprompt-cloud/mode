import * as store from '../store.js';
import { dayPlan, completion, score } from '../stats.js';
import { esc, today, addDays, fmtLong, fmt12, toMin, lastNDays, fmtDate, relDay, WEEK_ORDER, DAY1, DAYS } from '../util.js';
import { icon, ring, bind, tabs, pageHead, empty, catPill, stars, confirmDlg } from '../ui.js';
import { rowHtml, actHandlers, isLate, reschedule, openActivityEditor, deleteActivity, openBreakdown, toggleItem } from '../acts.js';

export default function schedule(root) {
  const st = { tab: 'day', date: today() };

  function missedList() {
    const out = [];
    for (const d of lastNDays(7).filter(x => x <= today())) for (const it of dayPlan(d).items) if (isLate(it, d)) out.push({ ...it, date: d });
    return out.sort((a, b) => (a.date < b.date ? 1 : -1) || toMin(a.time) - toMin(b.time));
  }

  function dayView() {
    const { items, moved } = dayPlan(st.date), c = completion(st.date), sc = score(st.date), isToday = st.date === today();
    const missed = missedList();
    return `<div class="date-nav card"><button class="btn icon ghost" data-act="prev" aria-label="Previous day">${icon('chevron-left', 18)}</button>
        <div class="dn-mid"><b>${esc(relDay(st.date))}</b><small class="muted">${esc(fmtLong(st.date))}</small></div>
        <button class="btn icon ghost" data-act="next" aria-label="Next day">${icon('chevron-right', 18)}</button>
        <input type="date" value="${st.date}" data-change="pick" aria-label="Pick a date">${isToday ? '' : '<button class="btn sm" data-act="todayBtn">Today</button>'}</div>
      <div class="dash">
        <div class="card"><div class="card-h"><h3>${isToday ? "Today's plan" : 'Plan for the day'}</h3><button class="btn sm primary" data-act="addOne">${icon('plus', 15)} Add</button></div>
          ${items.length ? `<div class="acts">${items.map(i => rowHtml(i, st.date)).join('')}</div>` : empty('Nothing planned', 'No routine activities fall on this day. Add a one-off or edit your routine.', '<button class="btn primary" data-act="addOne">Add activity</button>')}
          ${moved.length ? `<p class="muted small moved">${icon('arrow-right', 13)} Moved: ${moved.map(m => `${esc(m.title)} → ${esc(fmtDate(m.movedTo))}`).join(', ')}</p>` : ''}
          <p class="muted small">Tap the box to complete. Tap a row to record the actual time, add notes or reschedule.</p></div>
        <div class="stack">
          <div class="card center"><div class="eyebrow mono">${isToday ? 'Today' : 'That day'}</div>${ring({ value: c.pct, size: 120, stroke: 11, label: 'complete' })}
            <small class="muted">${c.done}/${c.total} done · score <b class="mono">${sc.score ?? '–'}</b></small><button class="link" data-act="how">How is the score calculated?</button></div>
          <div class="card"><div class="card-h"><h3>${icon('alert-triangle', 17)} Missed (7 days)</h3><span class="badge ${missed.length ? 'warn' : 'ok'}">${missed.length}</span></div>
            ${missed.length ? `<div class="acts compact">${missed.slice(0, 10).map(m => `<div class="pend"><div class="act c-${m.cat} late"><div class="act-main"><div class="act-t">${esc(m.title)}</div><div class="act-s"><span class="mono">${esc(relDay(m.date))} · ${fmt12(m.time)}</span></div></div></div>
              <button class="btn icon ghost" data-act="mdone" data-id="${m.uid}" data-date="${m.date}" title="Mark done">${icon('check', 16)}</button><button class="btn icon ghost" data-act="mres" data-id="${m.uid}" data-date="${m.date}" title="Reschedule">${icon('calendar-clock', 16)}</button></div>`).join('')}</div>` : '<p class="muted">Nothing missed this week. Keep it up.</p>'}
          </div></div></div>`;
  }

  function routineView() {
    const acts = store.get().acts.filter(a => !a.end).slice().sort((a, b) => toMin(a.time) - toMin(b.time) || a.title.localeCompare(b.title));
    return `<div class="card"><div class="card-h"><h3>Your routine</h3><button class="btn sm primary" data-act="addR">${icon('plus', 15)} Add activity</button></div>
      <p class="muted small">Everything here repeats on the days you choose. Change times, categories, importance and days at any time. History is kept.</p>
      ${acts.length ? `<div class="rt">${acts.map(a => `<div class="rt-row c-${a.cat}"><span class="mono rt-time">${fmt12(a.time)}</span>
        <div class="rt-main"><b>${esc(a.title)}</b><div class="act-s">${catPill(a.cat)} ${stars(a.imp)} ${a.dur ? `<span class="mono">${a.dur} min</span>` : ''}${a.remind === false ? '<span class="tag">no reminder</span>' : ''}</div></div>
        <div class="rt-days">${WEEK_ORDER.map(i => `<i class="${a.days.includes(i) ? 'on' : ''}" title="${DAYS[i]}">${DAY1[i]}</i>`).join('')}</div>
        <div class="rt-act"><button class="btn icon ghost" data-act="editR" data-id="${a.id}" aria-label="Edit ${esc(a.title)}">${icon('pencil', 16)}</button><button class="btn icon ghost" data-act="delR" data-id="${a.id}" aria-label="Delete ${esc(a.title)}">${icon('trash-2', 16)}</button></div></div>`).join('')}</div>` : empty('No routine yet', 'Add the activities you want to repeat each week.', '<button class="btn primary" data-act="addR">Add activity</button>')}</div>`;
  }

  function draw() {
    const keep = scrollY;
    root.innerHTML = `${pageHead('Routine', 'Plan your day, record what really happened, and recover what you missed.')}
      ${tabs([['day', 'Day view'], ['routine', 'Edit routine']], st.tab)}<div class="gap"></div>${st.tab === 'day' ? dayView() : routineView()}`;
    scrollTo(0, keep);
  }

  bind(root, {
    ...actHandlers(() => st.date),
    tab: el => { st.tab = el.dataset.v; draw(); },
    prev: () => { st.date = addDays(st.date, -1); draw(); }, next: () => { st.date = addDays(st.date, 1); draw(); },
    todayBtn: () => { st.date = today(); draw(); },
    pick: el => { if (el.value) { st.date = el.value; draw(); } },
    addOne: () => openActivityEditor(null, { quick: true, date: st.date }),
    addR: () => openActivityEditor(null), editR: el => openActivityEditor(el.dataset.id),
    delR: async el => { const a = store.get().acts.find(x => x.id === el.dataset.id); if (await confirmDlg(`Delete “${a.title}” from your routine? Past history is kept.`)) deleteActivity(a.id); },
    how: () => openBreakdown(st.date),
    mres: el => reschedule(el.dataset.id, el.dataset.date),
    mdone: el => toggleItem(el.dataset.id, el.dataset.date, el),
  });
  const un = store.subscribe(draw); draw();
  return un;
}
