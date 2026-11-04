// Shared activity components: rows, completion toggle, detail sheet, reschedule, add/edit.
import * as store from './store.js';
import { dayLog } from './store.js';
import { dayPlan, completion } from './stats.js';
import { esc, today, nowHM, toMin, fmt12, fmtDate, relDay, addDays, uid, fromMin, DAYS } from './util.js';
import { icon, toast, modal, formModal, confirmDlg, catPill, stars, field, seg, catOptions, dayChips, switchEl } from './ui.js';
import { burst } from './fx.js';

export const isLate = (it, date) => !it.done && (date < today() || (date === today() && toMin(it.time) + Math.max(it.dur || 0, 15) < toMin(nowHM())));

export function rowHtml(it, date, { compact = false } = {}) {
  const late = isLate(it, date);
  return `<div class="act c-${it.cat} ${it.done ? 'done' : ''} ${late ? 'late' : ''}">
    <button class="chk" data-act="tog" data-id="${it.uid}" aria-label="${it.done ? 'Mark not done' : 'Mark complete'}: ${esc(it.title)}">${icon('check', 16)}</button>
    <div class="act-main" data-act="open" data-id="${it.uid}" tabindex="0" role="button">
      <div class="act-t">${esc(it.title)}</div>
      <div class="act-s"><span class="mono">${fmt12(it.time)}</span>${it.time !== it.baseTime ? `<span class="tag">moved</span>` : ''}${compact ? '' : ` ${catPill(it.cat)} ${stars(it.imp)}`}
        ${it.done && it.at ? `<span class="ok mono">✓ ${fmt12(it.at)}</span>` : ''}${late ? '<span class="tag warn">missed</span>' : ''}${it.from ? `<span class="tag">from ${esc(relDay(it.from.date))}</span>` : ''}${it.note ? `<span class="muted" title="${esc(it.note)}">${icon('pencil', 12)}</span>` : ''}</div>
    </div></div>`;
}

export function dateOfItem(id, date) { return dayPlan(date).items.find(i => i.uid === id); }

export function toggleItem(id, date, srcEl) {
  const it = dateOfItem(id, date); if (!it) return;
  const on = !it.done; const stamp = date === today() ? nowHM() : it.time;
  store.update(s => {
    const log = dayLog(date);
    if (it.rec) {
      const l = (log.acts[id] ||= {}); l.done = on; l.at = on ? stamp : '';
      if (it.habit) { const h = (s.hlog[date] ||= {}); if (on) h[it.habit] = 1; else delete h[it.habit]; if (!Object.keys(h).length) delete s.hlog[date]; }
    } else { const e = log.extra.find(x => x.id === id); e.done = on; e.at = on ? stamp : ''; }
  });
  if (on) {
    const r = srcEl?.getBoundingClientRect?.();
    burst(r ? r.left + r.width / 2 : innerWidth / 2, r ? r.top : innerHeight / 2);
    const c = completion(date);
    if (c.total > 1 && c.pct === 100) { burst(0, 0, { big: true }); toast('Perfect day. Every activity done.', { type: 'ok' }); }
  }
}

/* ---------- Detail sheet ---------- */
export function openItem(id, date) {
  const it = dateOfItem(id, date); if (!it) return;
  formModal({
    title: it.title,
    html: `<div class="sheet-meta">${catPill(it.cat)} ${stars(it.imp)} <span class="mono muted">planned ${fmt12(it.baseTime)} · ${esc(fmtDate(date))}</span></div>
      ${switchEl('done', it.done, 'Completed')}
      <div class="row2">${field('Actual completion time', `<input type="time" name="at" value="${esc(it.at || (date === today() ? nowHM() : it.time))}">`)}
      ${field(date === today() ? 'Time today' : 'Time that day', `<input type="time" name="time" value="${esc(it.time)}">`, it.rec ? 'Changes this day only' : '')}</div>
      ${field('Notes', `<textarea name="note" rows="3" placeholder="How did it go? What got in the way?">${esc(it.note)}</textarea>`)}
      <div class="btn-row"><button type="button" class="btn" data-x="resched">${icon('calendar-clock', 16)} Reschedule</button>${it.rec ? `<button type="button" class="btn" data-x="edit">${icon('pencil', 16)} Edit routine</button>` : `<button type="button" class="btn danger" data-x="del">${icon('trash-2', 16)} Delete</button>`}</div>`,
    onOpen: (el, close, f) => {
      f.addEventListener('click', e => {
        const b = e.target.closest('[data-x]'); if (!b) return;
        const x = b.dataset.x; close();
        if (x === 'resched') reschedule(id, date);
        if (x === 'edit') openActivityEditor(it.actId, { date });
        if (x === 'del') store.update(() => { const l = dayLog(date); l.extra = l.extra.filter(e2 => e2.id !== id); });
      });
    },
    onSubmit: fd => {
      const done = fd.has('done'), at = fd.get('at') || it.time, time = fd.get('time') || it.baseTime, note = fd.get('note');
      store.update(s => {
        const log = dayLog(date);
        if (it.rec) {
          const l = (log.acts[id] ||= {}); l.done = done; l.at = done ? at : ''; l.note = note;
          if (time !== it.baseTime) l.time = time; else delete l.time;
          if (it.habit) { const h = (s.hlog[date] ||= {}); if (done) h[it.habit] = 1; else delete h[it.habit]; if (!Object.keys(h).length) delete s.hlog[date]; }
        } else { const e = log.extra.find(x => x.id === id); Object.assign(e, { done, at: done ? at : '', note, time }); }
      });
      if (done && !it.done) burst(innerWidth / 2, innerHeight / 2);
    },
  });
}

/* ---------- Reschedule ---------- */
export function reschedule(id, date) {
  const it = dateOfItem(id, date); if (!it) return;
  const nowM = toMin(nowHM()), later = fromMin(Math.min(23 * 60 + 30, Math.ceil((nowM + 45) / 15) * 15));
  formModal({
    title: `Reschedule “${it.title}”`, submit: 'Move',
    html: `${seg('when', [['today', 'Later today'], ['tomorrow', 'Tomorrow'], ['other', 'Pick a day']], date === today() ? 'today' : 'tomorrow')}
      <div class="row2">${field('Day', `<input type="date" name="day" value="${date === today() ? today() : addDays(today(), 1)}">`)}${field('Time', `<input type="time" name="time" value="${date === today() ? later : it.baseTime}" required>`)}</div>
      <p class="muted small">Moving to another day takes it off ${esc(relDay(date).toLowerCase())}'s plan so it is not counted as missed, and adds it to the new day.</p>`,
    onOpen: (el, close, f) => {
      f.addEventListener('change', e => {
        if (e.target.name !== 'when') return;
        f.day.value = e.target.value === 'today' ? today() : e.target.value === 'tomorrow' ? addDays(today(), 1) : f.day.value;
      });
    },
    onSubmit: fd => {
      const td = fd.get('day') || today(), tm = fd.get('time');
      store.update(s => {
        const log = dayLog(date);
        if (td === date) { if (it.rec) { (log.acts[id] ||= {}).time = tm; } else log.extra.find(x => x.id === id).time = tm; return; }
        if (it.rec) { const l = (log.acts[id] ||= {}); l.movedTo = td; l.done = false; l.at = ''; }
        else log.extra = log.extra.filter(x => x.id !== id);
        dayLog(td).extra.push({ id: uid(), title: it.title, time: tm, cat: it.cat, imp: it.imp, dur: it.dur, note: it.note, done: false, at: '', from: { date, actId: it.actId } });
      });
      toast(td === date ? `Moved to ${fmt12(tm)}` : `Moved to ${relDay(td)} at ${fmt12(tm)}`);
    },
  });
}

/* ---------- Add / edit ---------- */
export function openActivityEditor(actId, { date = today(), quick = false } = {}) {
  const s = store.get(); const a = actId ? s.acts.find(x => x.id === actId) : null;
  const t = fromMin(Math.min(23 * 60, Math.ceil((toMin(nowHM()) + 20) / 15) * 15));
  const habits = s.habits.filter(h => !h.archived);
  formModal({
    title: a ? 'Edit routine activity' : quick ? 'Quick add' : 'Add activity', submit: a ? 'Save changes' : 'Add',
    html: `${field('Activity', `<input name="title" required placeholder="e.g. Read 20 pages" value="${esc(a?.title || '')}" maxlength="80">`)}
      <div class="row2">${field('Time', `<input type="time" name="time" required value="${esc(a?.time || t)}">`)}${field('Duration (min)', `<input type="number" name="dur" min="0" step="5" value="${a?.dur ?? 30}">`)}</div>
      <div class="row2">${field('Category', `<select name="cat">${catOptions(a?.cat || 'discipline')}</select>`)}
      ${field('Importance', seg('imp', [[1, 'Easy'], [2, 'Normal'], [3, 'Critical']], a?.imp || 2), 'Critical tasks move your score the most')}</div>
      ${!a ? field('Repeat', seg('rep', [['once', 'Just today'], ['daily', 'Every day'], ['days', 'Chosen days']], quick ? 'once' : 'daily')) : ''}
      <div class="field" id="days-f" ${!a && quick ? 'hidden' : ''}><span>Days</span>${dayChips(a?.days || [0, 1, 2, 3, 4, 5, 6])}</div>
      ${!quick || a ? field('Linked habit', `<select name="habit"><option value="">None</option>${habits.map(h => `<option value="${h.id}" ${a?.habit === h.id ? 'selected' : ''}>${esc(h.name)}</option>`).join('')}</select>`, 'Completing this activity ticks the habit') : ''}
      ${switchEl('remind', a ? a.remind !== false : true, 'Remind me at this time')}`,
    danger: a ? `<button type="button" class="btn danger" data-del>${icon('trash-2', 16)} Delete</button>` : '',
    onOpen: (el, close, f) => {
      const days = el.querySelector('#days-f');
      f.addEventListener('change', e => { if (e.target.name === 'rep') days.hidden = e.target.value !== 'days'; });
      if (!a && !quick) days.hidden = true;
      el.querySelector('[data-del]')?.addEventListener('click', async () => { if (await confirmDlg(`Delete “${a.title}” from your routine? Past history is kept; it will not appear from today onward.`)) { close(); deleteActivity(a.id); } });
    },
    onSubmit: fd => {
      const rep = !a ? fd.get('rep') : 'edit';
      let sel = fd.all('days').map(Number);
      if (rep === 'daily') sel = [0, 1, 2, 3, 4, 5, 6];
      if ((rep === 'days' || rep === 'edit') && !sel.length) { toast('Pick at least one day', { type: 'warn' }); return false; }
      const base = { title: fd.get('title'), time: fd.get('time'), dur: +fd.get('dur') || 0, cat: fd.get('cat'), imp: +fd.get('imp') || 2, remind: fd.has('remind'), habit: fd.get('habit') || null };
      store.update(st => {
        if (a) { const x = st.acts.find(y => y.id === a.id); Object.assign(x, base, { days: sel }); }
        else if (rep === 'once') dayLog(date).extra.push({ id: uid(), ...base, habit: undefined, done: false, at: '', note: '' });
        else st.acts.push({ id: uid(), key: null, ...base, days: sel, start: today(), end: null });
      });
      toast(a ? 'Routine updated' : rep === 'once' ? 'Added for today' : 'Added to your routine');
    },
  });
}

export function deleteActivity(id) {
  store.update(s => {
    const used = Object.values(s.logs).some(l => l.acts?.[id]?.done || l.acts?.[id]?.note) || Object.values(s.logs).some(l => l.extra?.some(e => e.from?.actId === id));
    const a = s.acts.find(x => x.id === id);
    if (used && a.start < today()) a.end = today(); else s.acts = s.acts.filter(x => x.id !== id);
  });
  toast('Activity deleted');
}

export function actHandlers(getDate) {
  return {
    tog: (el) => toggleItem(el.dataset.id, getDate(), el),
    open: (el) => openItem(el.dataset.id, getDate()),
  };
}

/* ---------- Transparent score breakdown ---------- */
import { score } from './stats.js';
import { CATS, CAT_KEYS } from './store.js';
import { fmtLong } from './util.js';

export function breakdownHtml(date) {
  const r = score(date);
  const rows = CAT_KEYS.map(k => {
    const c = r.cats[k]; const on = c.P > 0 && c.w > 0;
    return `<tr class="${on ? '' : 'dim'}"><td><span class="pill c-${k}"><i></i>${CATS[k].short}</span></td>
      <td class="mono">${c.P ? `${+c.D.toFixed(1)} / ${+c.P.toFixed(1)}` : '–'}${c.capped ? ' <span class="tag" title="Easy items are capped at 25% of a category">capped</span>' : ''}</td>
      <td class="mono">${c.P ? Math.round(c.pct * 100) + '%' : 'not planned'}</td><td class="mono">${on ? Math.round(c.eff * 100) + '%' : c.w + '%*'}</td><td class="mono"><b>${on ? c.contrib.toFixed(1) : '0'}</b></td></tr>`;
  }).join('');
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Category</th><th>Points done / planned</th><th>Done</th><th>Weight</th><th>Adds</th></tr></thead><tbody>${rows}</tbody>
    <tfoot><tr><td colspan="4"><b>Discipline score · ${esc(fmtLong(date))}</b></td><td class="mono"><b>${r.score ?? '–'}</b></td></tr></tfoot></table></div>
    <ul class="small muted rules"><li><b>Points</b> = importance: Easy 1, Normal 2, Critical 3. Critical work counts three times as much as an easy tick.</li>
    <li><b>Anti-padding rule:</b> easy items can never make up more than 25% of a category, so adding many trivial habits will not lift your score.</li>
    <li><b>Weights</b> are yours (Settings). Categories with nothing planned today (*) are left out and the rest are re-balanced, so a rest day is not punished.</li>
    <li>Only <b>completed scheduled activities</b> earn points. Check-ins, journaling and habits on their own do not.</li></ul>`;
}
export function openBreakdown(date = today()) { modal({ title: 'How your score is calculated', wide: true, body: breakdownHtml(date) }); }
