// Commitments: rules and promises you tick off, each with a progress model that fits it.
import * as store from '../store.js';
import { info, actions, TYPES, ICONS } from '../commits.js';
import { esc, today, addDays, addMonthsKeep, diffDays, weekStart, range, fmtDate, uid, DAY1, clamp, parse } from '../util.js';
import { icon, bind, tabs, pageHead, field, seg, formModal, confirmDlg, toast, empty, ring } from '../ui.js';
import { burst } from '../fx.js';

const S = () => store.get();
const hue = it => TYPES[it.type].hue === 'accent' ? 'var(--accent)' : `var(--c-${TYPES[it.type].hue})`;
const pips = (n, of) => `<div class="pips">${Array.from({ length: Math.min(of, 20) }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</div>`;
const week = it => { const w = weekStart(today()); return range(w, addDays(w, 6)); };

function strip(it, clickable) {
  const t = today();
  return `<div class="wk">${week(it).map((d, i) => `<button type="button" class="${it.log[d] ? 'on' : ''} ${d === t ? 'now' : ''}" ${d > t || !clickable ? 'disabled' : ''} data-act="day" data-id="${it.id}" data-d="${d}" title="${fmtDate(d)}">${DAY1[(i + 1) % 7]}</button>`).join('')}</div>`;
}

function body(it, f) {
  switch (it.type) {
    case 'abstain': return `<div class="cm-row">${ring({ value: f.pct, size: 92, stroke: 9, label: f.finished ? 'complete' : f.left + 'd left', sub: '' })}
      <div class="cm-meta"><b>${f.headline}</b><span>of ${f.total} days</span><small class="muted">Ends ${fmtDate(it.until)}</small>${it.slips?.length ? `<small class="warn">${it.slips.length} slip${it.slips.length > 1 ? 's' : ''}</small>` : '<small class="ok">Clean so far</small>'}</div></div>`;
    case 'count': return `<div class="cm-row"><div class="cm-big">${it.count}<small>/ ${it.target}</small></div>${pips(it.count, it.target)}</div>`;
    case 'daily': return `<div class="cm-row"><div class="cm-big">${f.streak}<small>day streak</small></div><div class="cm-meta"><small class="muted">${f.total} days kept in total</small></div></div>${strip(it, true)}`;
    case 'weekly': return `<div class="cm-row"><div class="cm-big">${f.week}<small>/ ${it.perWeek} this week</small></div><div class="cm-meta"><small class="muted">${f.streak} week streak</small></div></div>${strip(it, true)}`;
    case 'limit': return `<div class="cm-row"><div class="cm-big ${f.over ? 'bad' : ''}">${f.used}<small>/ ${it.cap} this month</small></div>${pips(f.used, Math.max(it.cap, f.used))}</div>
      <small class="muted">${f.last ? `Last: ${fmtDate(f.last)}` : 'Not used yet this month'}</small>`;
    default: return `<div class="cm-row"><div class="cm-big ${f.overdue ? 'bad' : ''}">${f.headline}<small>${f.sub}</small></div>${it.deadline ? `<small class="muted">Due ${fmtDate(it.deadline, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</small>` : ''}</div>`;
  }
}
function foot(it, f) {
  const id = `data-id="${it.id}"`;
  switch (it.type) {
    case 'abstain': return f.finished ? '' : `<button class="btn sm ghost" data-act="slip" ${id}>${icon('rotate-ccw', 14)} I slipped</button>`;
    case 'count': return `<button class="btn sm" data-act="cnt" data-n="-1" ${id} ${it.count ? '' : 'disabled'}>${icon('minus', 14)}</button><button class="btn sm primary" data-act="cnt" data-n="1" ${id}>${icon('plus', 14)} Add one</button>`;
    case 'daily': return `<button class="btn sm ${f.todayDone ? '' : 'primary'}" data-act="day" ${id} data-d="${today()}">${icon(f.todayDone ? 'check' : 'circle', 14)} ${f.todayDone ? 'Done today' : 'Mark today'}</button>`;
    case 'weekly': return `<button class="btn sm ${f.todayDone ? '' : 'primary'}" data-act="day" ${id} data-d="${today()}">${icon(f.todayDone ? 'check' : 'calendar-check', 14)} ${f.todayDone ? 'Logged today' : 'Log today'}</button>`;
    case 'limit': return `<button class="btn sm ${f.atCap ? '' : 'primary'}" data-act="use" ${id}>${icon('scissors', 14)} Log it</button><button class="btn sm ghost" data-act="unuse" ${id} ${f.used ? '' : 'disabled'}>Undo</button>`;
    default: return '';
  }
}
function card(it) {
  const f = info(it), cls = f.done ? 'done' : f.overdue || f.over ? 'alert' : '';
  return `<article class="cm t-${it.type} ${cls}" style="--cc:${hue(it)}" data-tilt>
    <header><button class="cm-chk" data-act="done" data-id="${it.id}" aria-label="${f.done ? 'Mark not done' : 'Mark complete'}" aria-pressed="${f.done}">${icon('check', 18)}</button>
      <span class="cm-ic">${icon(it.icon || 'flag', 18)}</span>
      <div class="cm-t"><h4>${esc(it.title)}</h4><small>${TYPES[it.type].label}${it.type === 'abstain' ? ` · ${esc(it.label || '')}` : ''}${f.done && it.doneOn ? ` · done ${fmtDate(it.doneOn)}` : ''}</small></div>
      <button class="btn icon ghost" data-act="edit" data-id="${it.id}" title="Edit">${icon('pencil', 16)}</button></header>
    <div class="cm-body">${body(it, f)}</div>
    ${it.note ? `<p class="cm-note">${esc(it.note)}</p>` : ''}
    <footer>${foot(it, f)}</footer></article>`;
}

export default function commit(root) {
  const st = { tab: 'active' };

  function modalFor(it) {
    const c = it || { type: 'todo', title: '', icon: 'flag', note: '', deadline: '', target: 10, perWeek: 1, cap: 1, dur: 7, unit: 'weeks', start: today() };
    let dur = 7, unit = 'weeks';
    if (it?.type === 'abstain') { const n = diffDays(it.start, it.until); [dur, unit] = n % 7 === 0 ? [n / 7, 'weeks'] : [n, 'days']; }
    formModal({
      title: it ? 'Edit commitment' : 'New commitment', submit: it ? 'Save' : 'Add',
      html: `${field('What are you committing to?', `<input name="title" required maxlength="80" value="${esc(c.title)}" placeholder="e.g. No sugary drinks">`)}
        ${field('Kind', `<select name="type" ${it ? 'disabled' : ''}>${Object.entries(TYPES).map(([k, v]) => `<option value="${k}" ${k === c.type ? 'selected' : ''}>${v.label}</option>`).join('')}</select>`)}
        <div class="field"><span>Icon</span><div class="icopick">${ICONS.map(n => `<label><input type="radio" name="icon" value="${n}" ${(c.icon || 'flag') === n ? 'checked' : ''}><span>${icon(n, 18)}</span></label>`).join('')}</div></div>
        <div data-k="abstain" class="row2">${field('Stay away for', `<input type="number" name="dur" min="1" max="999" value="${dur}">`)}${field('Unit', `<select name="unit">${['days', 'weeks', 'months'].map(u => `<option ${u === unit ? 'selected' : ''}>${u}</option>`).join('')}</select>`)}</div>
        <div data-k="abstain">${field('Started on', `<input type="date" name="start" value="${esc(c.start || today())}">`)}</div>
        <div data-k="count">${field('Target number', `<input type="number" name="target" min="1" value="${c.target || 10}">`)}</div>
        <div data-k="weekly">${field('Times per week', `<input type="number" name="perWeek" min="1" max="7" value="${c.perWeek || 1}">`)}</div>
        <div data-k="limit">${field('At most, per month', `<input type="number" name="cap" min="1" value="${c.cap || 1}">`)}</div>
        <div data-k="todo">${field('Deadline (optional)', `<input type="date" name="deadline" value="${esc(c.deadline || '')}">`)}</div>
        ${field('Note', `<textarea name="note" rows="2" maxlength="200" placeholder="Why it matters, or the rule in your own words">${esc(c.note || '')}</textarea>`)}`,
      danger: it ? `<button type="button" class="btn danger" data-del>${icon('trash-2', 15)} Delete</button>` : '',
      onOpen: (el, close, f) => {
        const sync = () => { const ty = it ? it.type : f.type.value; el.querySelectorAll('[data-k]').forEach(n => { n.hidden = n.dataset.k !== ty; }); };
        f.addEventListener('change', sync); sync();
        el.querySelector('[data-del]')?.addEventListener('click', async () => { if (await confirmDlg(`Delete “${it.title}”?`)) { close(); actions.remove(it.id); } });
      },
      onSubmit: fd => {
        const ty = it ? it.type : fd.get('type'), base = { title: fd.get('title'), icon: fd.get('icon') || 'flag', note: fd.get('note') };
        if (ty === 'abstain') {
          const n = clamp(+fd.get('dur') || 1, 1, 999), u = fd.get('unit'), start = fd.get('start') || today();
          Object.assign(base, { start, until: u === 'months' ? addMonthsKeep(start, n) : addDays(start, u === 'weeks' ? n * 7 : n), label: `${n} ${n === 1 ? u.slice(0, -1) : u}` });
        }
        if (ty === 'count') base.target = Math.max(1, +fd.get('target') || 1);
        if (ty === 'weekly') base.perWeek = clamp(+fd.get('perWeek') || 1, 1, 7);
        if (ty === 'limit') base.cap = Math.max(1, +fd.get('cap') || 1);
        if (ty === 'todo') base.deadline = fd.get('deadline') || null;
        store.update(s => {
          if (it) Object.assign(s.commit.find(x => x.id === it.id), base);
          else s.commit.push({ id: uid(), type: ty, created: today(), done: false, doneOn: null, ...(ty === 'count' ? { count: 0 } : {}), ...(ty === 'abstain' ? { slips: [] } : {}), ...(['daily', 'weekly', 'limit'].includes(ty) ? { log: {} } : {}), ...base });
        });
        toast(it ? 'Saved' : 'Commitment added', { type: 'ok' });
      },
    });
  }

  function draw() {
    const all = S().commit, infos = all.map(i => [i, info(i)]);
    const active = infos.filter(([, f]) => !f.done), doneL = infos.filter(([, f]) => f.done);
    const list = st.tab === 'active' ? active : st.tab === 'done' ? doneL : infos;
    const total = all.length, p = total ? Math.round(doneL.length / total * 100) : 0;
    const due = active.filter(([i, f]) => (i.type === 'daily' || i.type === 'weekly') && !f.todayDone).length;
    const nextDl = active.filter(([i]) => i.type === 'todo' && i.deadline).sort((a, b) => a[0].deadline.localeCompare(b[0].deadline))[0];
    root.innerHTML = `${pageHead('Commitments', 'Rules you set for yourself. Tick them off as you keep or finish them.', `<button class="btn primary" data-act="new">${icon('plus', 16)} New</button>`)}
      <section class="cm-hero"><div class="cm-hero-r">${ring({ value: p, size: 118, stroke: 11, label: `${doneL.length}/${total}`, sub: 'complete' })}</div>
        <div class="cm-hero-t"><span class="eyebrow">Your word</span><h2>${active.length ? `${active.length} still in play` : 'Every promise kept'}</h2>
        <div class="cm-chips"><span>${icon('flame', 14)} ${due} to tick today</span>${nextDl ? `<span>${icon('flag', 14)} ${esc(nextDl[0].title.slice(0, 28))}: ${info(nextDl[0]).mini}</span>` : ''}</div></div></section>
      ${tabs([['active', 'Active', active.length], ['done', 'Completed', doneL.length], ['all', 'All', total]], st.tab)}
      ${list.length ? `<div class="cm-grid">${list.map(([i]) => card(i)).join('')}</div>` : empty(st.tab === 'done' ? 'Nothing completed yet' : 'No commitments here', 'Add a rule you want to keep.', `<button class="btn primary" data-act="new">Add commitment</button>`)}`;
  }

  const fin = (el, now, msg, undo) => { if (now) { const r = el.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, { big: true }); toast(msg, { type: 'ok', ms: 5000, action: undo && { label: 'Undo', fn: undo } }); } };
  bind(root, {
    tab: el => { st.tab = el.dataset.v; draw(); }, new: () => modalFor(null),
    edit: el => modalFor(S().commit.find(c => c.id === el.dataset.id)),
    done: el => { const now = actions.toggleDone(el.dataset.id); const id = el.dataset.id; fin(el, now, 'Complete. Well done.', () => actions.toggleDone(id)); },
    day: el => { const it = S().commit.find(c => c.id === el.dataset.id), was = !!it.log[el.dataset.d]; actions.toggleDay(it.id, el.dataset.d); if (!was && el.dataset.d === today()) fin(el, true, it.type === 'weekly' ? 'Logged' : 'Kept today'); },
    cnt: el => { const r = actions.count(el.dataset.id, +el.dataset.n); const id = el.dataset.id; fin(el, r, 'Target reached!', () => actions.count(id, -1)); },
    use: el => { const it = S().commit.find(c => c.id === el.dataset.id); actions.logUse(it.id); if (info(S().commit.find(c => c.id === it.id)).over) toast('Over your monthly limit', { type: 'warn' }); },
    unuse: el => actions.undoUse(el.dataset.id),
    slip: async el => { const it = S().commit.find(c => c.id === el.dataset.id); if (await confirmDlg(`Restart “${it.title}” from today? Your count goes back to day 1.`, 'I slipped', { danger: false })) { actions.slip(it.id); toast('Clock reset. Begin again.'); } },
  });
  const un = store.subscribe(draw); draw();
  return un;
}
