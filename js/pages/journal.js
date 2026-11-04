import * as store from '../store.js';
import { esc, today, addDays, fmtLong, fmtDate, relDay, nowHM } from '../util.js';
import { icon, bind, pageHead, field, empty, toast, confirmDlg } from '../ui.js';
import { burst } from '../fx.js';

const FIELDS = [
  ['thoughts', 'Daily thoughts', 'What is on your mind today?', 'pencil'],
  ['lesson', 'Lessons learned', 'What did today teach you?', 'brain'],
  ['gratitude', 'Gratitude', 'Three things you are thankful for', 'heart'],
  ['reflection', 'Personal reflection', 'Who are you becoming? Where did you grow or slip?', 'sparkles'],
  ['challenge', 'Challenges', 'What was hard, and how did you respond?', 'shield-check'],
  ['achievement', 'Achievements', 'Wins, big or small', 'award'],
];
const MOODS = [['1', '😞', 'Low'], ['2', '😕', 'Meh'], ['3', '🙂', 'Okay'], ['4', '😄', 'Good'], ['5', '🔥', 'Great']];
const has = e => e && FIELDS.some(([k]) => (e[k] || '').trim());

export default function journal(root) {
  const st = { date: today(), q: '' };
  const entry = () => store.get().journal[st.date] || {};

  function streakDays() {
    const j = store.get().journal; let d = today(), n = 0;
    if (!has(j[d])) d = addDays(d, -1);
    while (has(j[d])) { n++; d = addDays(d, -1); }
    return n;
  }
  function list() {
    const q = st.q.toLowerCase();
    return Object.entries(store.get().journal).filter(([, e]) => has(e)).filter(([d, e]) => !q || FIELDS.some(([k]) => (e[k] || '').toLowerCase().includes(q)) || d.includes(q)).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }

  function draw() {
    const e = entry(), all = Object.values(store.get().journal).filter(has), items = list();
    root.innerHTML = `${pageHead('Journal', 'A private space for thoughts, lessons and gratitude. Saved automatically on this device.')}
      <div class="grid g4 stats"><div class="card stat"><div class="eyebrow mono">Entries</div><div class="bignum mono">${all.length}</div></div>
        <div class="card stat"><div class="eyebrow mono">Journal streak</div><div class="bignum mono">${icon('flame', 22)}${streakDays()}<small>days</small></div></div>
        <div class="card stat"><div class="eyebrow mono">Gratitude notes</div><div class="bignum mono">${all.filter(x => (x.gratitude || '').trim()).length}</div></div>
        <div class="card stat"><div class="eyebrow mono">Achievements logged</div><div class="bignum mono">${all.filter(x => (x.achievement || '').trim()).length}</div></div></div>
      <div class="dash">
        <form class="card pad form" data-submit="save" novalidate>
          <div class="date-nav inner"><button type="button" class="btn icon ghost" data-act="prev" aria-label="Previous day">${icon('chevron-left', 18)}</button><div class="dn-mid"><b>${esc(relDay(st.date))}</b><small class="muted">${esc(fmtLong(st.date))}</small></div><button type="button" class="btn icon ghost" data-act="next" aria-label="Next day" ${st.date >= today() ? 'disabled' : ''}>${icon('chevron-right', 18)}</button>${st.date !== today() ? '<button type="button" class="btn sm" data-act="todayBtn">Today</button>' : ''}</div>
          <div class="field"><span>How was today?</span><div class="moods">${MOODS.map(([v, em, l]) => `<label><input type="radio" name="mood" value="${v}" data-input="auto" ${e.mood === v ? 'checked' : ''}><span title="${l}"><i>${em}</i><small>${l}</small></span></label>`).join('')}</div></div>
          ${FIELDS.map(([k, l, ph, ic]) => field(l, `<textarea name="${k}" rows="${k === 'thoughts' || k === 'reflection' ? 4 : 3}" placeholder="${esc(ph)}" data-input="auto">${esc(e[k] || '')}</textarea>`)).join('')}
          <div class="form-foot"><span class="muted small mono" id="saved">${e.savedAt ? 'Saved ' + new Date(e.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Not saved yet'}</span><span class="grow"></span>${has(e) ? '<button type="button" class="btn ghost danger-t" data-act="del">Delete entry</button>' : ''}<button class="btn primary" type="submit">Save entry</button></div>
        </form>
        <div class="card"><div class="card-h"><h3>Past entries</h3></div><input class="search" type="search" placeholder="Search your journal…" value="${esc(st.q)}" data-input="search" aria-label="Search journal">
          ${items.length ? `<div class="entries">${items.slice(0, 40).map(([d, x]) => { const f = FIELDS.find(([k]) => (x[k] || '').trim()); return `<button class="entry ${d === st.date ? 'on' : ''}" data-act="open" data-d="${d}"><span class="mono">${esc(fmtDate(d, { day: 'numeric', month: 'short', year: 'numeric' }))} ${x.mood ? MOODS[+x.mood - 1][1] : ''}</span><small class="muted">${esc(f[1])}</small><p>${esc(x[f[0]].slice(0, 110))}${x[f[0]].length > 110 ? '…' : ''}</p></button>`; }).join('')}</div>` : empty('No entries', st.q ? 'Nothing matches your search.' : 'Write your first entry today.')}</div>
      </div>`;
  }

  const collect = form => { const fd = new FormData(form), o = { savedAt: Date.now() }; for (const [k] of FIELDS) o[k] = (fd.get(k) || '').toString(); o.mood = (fd.get('mood') || '').toString(); return o; };
  const timer = { t: 0 };
  bind(root, {
    auto: (el) => {
      clearTimeout(timer.t);
      timer.t = setTimeout(() => {
        const o = collect(el.closest('form'));
        store.update(s => { if (has(o) || o.mood) s.journal[st.date] = o; else delete s.journal[st.date]; }, { silent: true });
        const sv = root.querySelector('#saved'); if (sv) sv.textContent = 'Saved ' + nowHM();
      }, 500);
    },
    search: el => { st.q = el.value; const pos = el.selectionStart; draw(); const n = root.querySelector('.search'); n.focus(); n.setSelectionRange(pos, pos); },
    save: (form, ev) => { ev.preventDefault(); clearTimeout(timer.t); const o = collect(form); if (!has(o) && !o.mood) { toast('Write something first', { type: 'warn' }); return; } store.update(s => { s.journal[st.date] = o; }, { silent: true }); burst(innerWidth / 2, innerHeight / 2); toast('Entry saved', { type: 'ok' }); draw(); },
    prev: () => { st.date = addDays(st.date, -1); draw(); }, next: () => { if (st.date < today()) { st.date = addDays(st.date, 1); draw(); } }, todayBtn: () => { st.date = today(); draw(); },
    open: el => { st.date = el.dataset.d; draw(); scrollTo(0, 0); },
    del: async () => { if (await confirmDlg('Delete this journal entry?')) { store.update(s => { delete s.journal[st.date]; }, { silent: true }); draw(); } },
  });
  draw();
  return () => clearTimeout(timer.t);
}
