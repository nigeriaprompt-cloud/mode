import * as store from '../store.js';
import { newChallenge } from '../store.js';
import { completion } from '../stats.js';
import { esc, today, addDays, addMonths, monthEnd, weekStart, range, diffDays, fmtDate, relDay, pct, uid, clamp } from '../util.js';
import { icon, bind, tabs, pageHead, field, seg, formModal, confirmDlg, toast, empty, bar } from '../ui.js';
import { burst } from '../fx.js';

const TYPES = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', challenge30: '30-Day Challenge', transform90: '90-Day Transformation' };
const isCh = g => g.type === 'challenge30' || g.type === 'transform90';
const deadlineFor = (type, start = today()) => ({ daily: start, weekly: addDays(weekStart(start), 6), monthly: monthEnd(start), challenge30: addDays(start, 29), transform90: addDays(start, 89) }[type]);

function chDays(g) {
  const n = g.target, t = today();
  return range(g.start, addDays(g.start, n - 1)).map(d => {
    const auto = d > t ? 'future' : (completion(d).pct ?? -1) >= g.threshold ? 'yes' : d === t ? 'today' : 'no';
    const ov = g.over?.[d];
    const state = d > t ? 'future' : ov === true ? 'yes' : ov === false ? 'no' : auto;
    return { d, state, auto, manual: ov !== undefined };
  });
}
export function progressOf(g) { return isCh(g) ? chDays(g).filter(x => x.state === 'yes').length : g.progress; }
function status(g) {
  const p = progressOf(g);
  if (g.status === 'abandoned' || g.status === 'paused') return g.status;
  if (g.status === 'completed' || p >= g.target) return 'completed';
  if (g.deadline && g.deadline < today()) return 'overdue';
  return 'active';
}
const STATUS_LABEL = { active: 'Active', completed: 'Completed', overdue: 'Overdue', paused: 'Paused', abandoned: 'Stopped' };

export default function goals(root) {
  const st = { tab: 'active' };
  const S = () => store.get();

  function goalModal(g, type = 'weekly') {
    const cur = g || { type, title: '', description: '', target: 5, unit: '', progress: 0, deadline: deadlineFor(type), status: 'active', start: today(), threshold: 70 };
    formModal({
      title: g ? 'Edit goal' : 'New goal', submit: g ? 'Save' : 'Create goal',
      html: `${field('Type', `<select name="type" ${g ? 'disabled' : ''}>${Object.entries(TYPES).map(([k, v]) => `<option value="${k}" ${k === cur.type ? 'selected' : ''}>${v}</option>`).join('')}</select>`)}
        ${field('Title', `<input name="title" required maxlength="80" placeholder="e.g. Send 10 job applications" value="${esc(cur.title)}">`)}
        ${field('Description', `<textarea name="description" rows="2" placeholder="Why does this matter?">${esc(cur.description)}</textarea>`)}
        <div class="row2" id="g-target">${field('Target', `<input type="number" name="target" min="1" value="${cur.target}" required>`)}${field('Unit', `<input name="unit" maxlength="20" placeholder="applications, pages, km…" value="${esc(cur.unit)}">`)}</div>
        <div class="row2">${field('Deadline', `<input type="date" name="deadline" value="${esc(cur.deadline || '')}">`)}${field('Progress so far', `<input type="number" name="progress" min="0" value="${cur.progress || 0}">`)}</div>
        <div class="row2" id="g-ch" hidden>${field('Start date', `<input type="date" name="start" value="${esc(cur.start)}">`)}${field('A day counts at', `<input type="number" name="threshold" min="10" max="100" step="5" value="${cur.threshold}">`, '% of the day’s plan completed')}</div>
        ${field('Status', seg('status', [['active', 'Active'], ['paused', 'Paused'], ['completed', 'Done'], ['abandoned', 'Stopped']], cur.status === 'overdue' ? 'active' : cur.status))}`,
      danger: g ? `<button type="button" class="btn danger" data-del>${icon('trash-2', 15)} Delete</button>` : '',
      onOpen: (el, close, f) => {
        const sync = e => {
          const ty = g ? g.type : f.type.value, ch = ty === 'challenge30' || ty === 'transform90';
          el.querySelector('#g-ch').hidden = !ch; el.querySelector('#g-target').hidden = ch; f.progress.closest('.field').hidden = ch;
          if (e && e.target.name === 'type' && !g) { f.deadline.value = deadlineFor(ty, f.start.value || today()); if (ch) f.target.value = ty === 'challenge30' ? 30 : 90; }
          if (e && e.target.name === 'start' && ch) f.deadline.value = deadlineFor(ty, f.start.value);
        };
        f.addEventListener('change', sync); sync();
        el.querySelector('[data-del]')?.addEventListener('click', async () => { if (await confirmDlg(`Delete “${g.title}”?`)) { close(); store.update(s => { s.goals = s.goals.filter(x => x.id !== g.id); }); } });
      },
      onSubmit: fd => {
        const ty = g ? g.type : fd.get('type'), ch = ty === 'challenge30' || ty === 'transform90';
        const v = { title: fd.get('title'), description: fd.get('description'), target: ch ? (ty === 'challenge30' ? 30 : 90) : Math.max(1, +fd.get('target') || 1), unit: ch ? 'days' : fd.get('unit'), deadline: fd.get('deadline'), progress: ch ? 0 : Math.max(0, +fd.get('progress') || 0), status: fd.get('status'), start: fd.get('start') || today(), threshold: clamp(+fd.get('threshold') || 70, 10, 100) };
        store.update(s => { if (g) Object.assign(s.goals.find(x => x.id === g.id), v); else s.goals.push({ id: uid(), type: ty, over: {}, ...v }); });
        toast(g ? 'Goal updated' : 'Goal created', { type: 'ok' });
      },
    });
  }

  function bump(id, delta) {
    let finished = false;
    store.update(s => {
      const g = s.goals.find(x => x.id === id); g.progress = Math.max(0, g.progress + delta);
      if (g.progress >= g.target && g.status !== 'completed') { g.status = 'completed'; g.completedOn = today(); finished = true; }
      else if (g.progress < g.target && g.status === 'completed') g.status = 'active';
    });
    if (finished) { burst(0, 0, { big: true }); toast('Goal completed. Well done.', { type: 'ok' }); }
  }

  const card = g => {
    const p = progressOf(g), stt = status(g), ch = isCh(g), pc = pct(p, g.target), left = g.deadline ? diffDays(today(), g.deadline) : null;
    const days = ch ? chDays(g) : [], dayNo = ch ? clamp(diffDays(g.start, today()) + 1, 1, g.target) : 0;
    const phase = g.type === 'transform90' ? (dayNo <= 30 ? 'Foundation' : dayNo <= 60 ? 'Build' : 'Transform') : '';
    return `<div class="card goal ${stt}"><div class="goal-h"><div><span class="eyebrow mono">${TYPES[g.type]}</span><h3>${esc(g.title)}</h3></div><span class="badge ${stt === 'completed' ? 'ok' : stt === 'overdue' ? 'warn' : ''}">${STATUS_LABEL[stt]}</span></div>
      ${g.description ? `<p class="muted">${esc(g.description)}</p>` : ''}
      <div class="goal-p"><b class="mono">${p}<small> / ${g.target} ${esc(g.unit || '')}</small></b><span class="mono">${pc}%</span></div>${bar(pc, stt === 'completed' ? 'var(--ok)' : 'var(--accent)')}
      <div class="act-s">${g.deadline ? `<span class="${stt === 'overdue' ? 'bad' : ''}">${icon('calendar', 13)} ${left === 0 ? 'Due today' : left > 0 ? `${left} day${left === 1 ? '' : 's'} left · ${esc(fmtDate(g.deadline))}` : `Overdue by ${-left} day${left === -1 ? '' : 's'}`}</span>` : ''}${ch ? `<span class="mono">Day ${dayNo} of ${g.target}${phase ? ' · ' + phase : ''}</span>` : ''}</div>
      ${ch ? `<div class="daygrid ${g.target > 30 ? 'd90' : ''}">${days.map((x, i) => `<button class="dg ${x.state} ${x.manual ? 'man' : ''}" ${x.state === 'future' ? 'disabled' : ''} data-act="dg" data-id="${g.id}" data-d="${x.d}" title="Day ${i + 1} · ${esc(fmtDate(x.d))}${x.manual ? ' (edited)' : ''}">${i + 1}</button>`).join('')}</div><p class="small muted">A day counts when you complete ≥ ${g.threshold}% of your plan. Tap a day to override it. Missing a day never resets the challenge.</p>` : ''}
      <div class="btn-row">${ch ? '' : `<button class="btn sm" data-act="bump" data-id="${g.id}" data-n="-1" aria-label="Minus one">−1</button><button class="btn sm primary" data-act="bump" data-id="${g.id}" data-n="1">+1</button><button class="btn sm" data-act="setp" data-id="${g.id}">Set</button>`}
        ${!ch && ['completed', 'overdue'].includes(stt) && g.type !== 'daily' || (!ch && g.type === 'daily' && stt !== 'active') ? `<button class="btn sm" data-act="repeat" data-id="${g.id}">${icon('rotate-ccw', 14)} Repeat</button>` : ''}
        <span class="grow"></span><button class="btn sm ghost" data-act="edit" data-id="${g.id}">${icon('pencil', 14)} Edit</button></div></div>`;
  };

  function draw() {
    const gs = S().goals, withS = gs.map(g => ({ g, s: status(g) }));
    const act = withS.filter(x => ['active', 'overdue', 'paused'].includes(x.s));
    const shown = st.tab === 'active' ? act : st.tab === 'done' ? withS.filter(x => ['completed', 'abandoned'].includes(x.s)) : st.tab === 'challenge' ? withS.filter(x => isCh(x.g)) : withS.filter(x => x.g.type === st.tab && x.s !== 'completed' && x.s !== 'abandoned');
    const hasCh = type => gs.some(g => g.type === type && ['active', 'overdue'].includes(status(g)));
    root.innerHTML = `${pageHead('Goals & Challenges', 'Daily, weekly and monthly goals, plus the 30-day discipline and 90-day transformation challenges.', `<button class="btn primary" data-act="new">${icon('plus', 16)} New goal</button>`)}
      ${!hasCh('challenge30') || !hasCh('transform90') ? `<div class="card promo" data-tilt><div><h3>${icon('rocket', 18)} Challenges</h3><p class="muted">Commit to a streak of showing up. Your score decides which days count.</p></div><div class="btn-row">${!hasCh('challenge30') ? '<button class="btn primary" data-act="start" data-t="challenge30">Start 30-day discipline</button>' : ''}${!hasCh('transform90') ? '<button class="btn" data-act="start" data-t="transform90">Start 90-day transformation</button>' : ''}</div></div>` : ''}
      ${tabs([['active', 'Active', act.length], ['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly'], ['challenge', 'Challenges'], ['done', 'Done']], st.tab)}<div class="gap"></div>
      ${shown.length ? `<div class="grid g2 goals">${shown.map(x => card(x.g)).join('')}</div>` : empty('Nothing here yet', 'Create a goal with a clear target and a deadline.', '<button class="btn primary" data-act="new">New goal</button>')}`;
  }

  bind(root, {
    tab: el => { st.tab = el.dataset.v; draw(); }, new: () => goalModal(null, st.tab === 'daily' || st.tab === 'monthly' ? st.tab : 'weekly'),
    edit: el => goalModal(S().goals.find(g => g.id === el.dataset.id)),
    start: el => { store.update(s => s.goals.push(newChallenge(el.dataset.t))); toast('Challenge started. Day 1 is today.', { type: 'ok' }); },
    bump: el => bump(el.dataset.id, +el.dataset.n),
    setp: el => { const g = S().goals.find(x => x.id === el.dataset.id); formModal({ title: 'Set progress', html: field(`Progress (${g.unit || 'units'})`, `<input type="number" name="p" min="0" value="${g.progress}" required>`), onSubmit: fd => bump(g.id, Math.max(0, +fd.get('p')) - g.progress) }); },
    repeat: el => store.update(s => { const g = s.goals.find(x => x.id === el.dataset.id); s.goals.push({ ...g, id: uid(), progress: 0, status: 'active', completedOn: null, deadline: g.type === 'daily' ? today() : g.type === 'weekly' ? deadlineFor('weekly', addDays(today(), 0)) : deadlineFor('monthly', today()) }); toast('New cycle started'); }),
    dg: el => store.update(s => { const g = s.goals.find(x => x.id === el.dataset.id); const x = chDays(g).find(y => y.d === el.dataset.d); g.over ||= {}; const want = x.state !== 'yes'; if (want === (x.auto === 'yes')) delete g.over[x.d]; else g.over[x.d] = want; }),
  });
  const un = store.subscribe(draw); draw();
  return un;
}
