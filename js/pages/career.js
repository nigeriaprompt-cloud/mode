import * as store from '../store.js';
import { APP_STATUS, CHANNELS, DOMAINS } from '../store.js';
import { appsIn, sessionMin, followUpsDue } from '../stats.js';
import { esc, today, addDays, weekStart, range, fmtDate, relDay, hrs, pct, uid, sum, parse } from '../util.js';
import { icon, bind, tabs, pageHead, field, formModal, confirmDlg, toast, empty, bar } from '../ui.js';
import { bars, hbar } from '../charts.js';
import * as focus from '../focus.js';

const OUTCOMES = ['Awaiting', 'Replied', 'Meeting set', 'No response', 'Closed'];
const statusClass = s => ({ Saved: '', Applied: 'info', Interview: 'warn', Offer: 'ok', Rejected: 'bad', 'No response': '' }[s] || '');
const opts = (list, sel) => list.map(v => `<option ${v === sel ? 'selected' : ''}>${esc(v)}</option>`).join('');

export default function career(root) {
  const st = { tab: 'apps', filter: 'All' };
  const S = () => store.get();

  function appModal(a) {
    formModal({
      title: a ? 'Edit application' : 'Track an application', submit: a ? 'Save' : 'Add',
      html: `<div class="row2">${field('Company', `<input name="company" required maxlength="60" value="${esc(a?.company || '')}">`)}${field('Role', `<input name="role" maxlength="80" placeholder="e.g. PHP Developer" value="${esc(a?.role || '')}">`)}</div>
        <div class="row2">${field('Status', `<select name="status">${opts(APP_STATUS, a?.status || 'Applied')}</select>`)}${field('Date applied', `<input type="date" name="date" value="${esc(a?.date || today())}">`)}</div>
        <div class="row2">${field('Contact person', `<input name="contact" maxlength="60" placeholder="Recruiter / hiring manager" value="${esc(a?.contact || '')}">`)}${field('Follow up on', `<input type="date" name="followUp" value="${esc(a?.followUp || '')}">`)}</div>
        ${field('Interview date', `<input type="date" name="interview" value="${esc(a?.interview || '')}">`)}${field('Job link', `<input type="url" name="link" placeholder="https://" value="${esc(a?.link || '')}">`)}
        ${field('Notes', `<textarea name="notes" rows="3">${esc(a?.notes || '')}</textarea>`)}`,
      danger: a ? `<button type="button" class="btn danger" data-del>${icon('trash-2', 15)} Delete</button>` : '',
      onOpen: (el, close) => el.querySelector('[data-del]')?.addEventListener('click', async () => { if (await confirmDlg(`Delete the ${a.company} application?`)) { close(); store.update(s => { s.career.apps = s.career.apps.filter(x => x.id !== a.id); }); } }),
      onSubmit: fd => {
        const v = { company: fd.get('company'), role: fd.get('role'), status: fd.get('status'), date: fd.get('date'), contact: fd.get('contact'), followUp: fd.get('followUp'), interview: fd.get('interview'), link: fd.get('link'), notes: fd.get('notes') };
        store.update(s => { if (a) Object.assign(s.career.apps.find(x => x.id === a.id), v); else s.career.apps.push({ id: uid(), ...v }); });
        toast(a ? 'Application updated' : 'Application added. Keep going.', { type: 'ok' });
      },
    });
  }
  function contactModal(c) {
    formModal({
      title: c ? 'Edit outreach' : 'Log a company contacted', submit: c ? 'Save' : 'Add',
      html: `<div class="row2">${field('Company', `<input name="company" required maxlength="60" value="${esc(c?.company || '')}">`)}${field('Person contacted', `<input name="person" maxlength="60" value="${esc(c?.person || '')}">`)}</div>
        <div class="row2">${field('Channel', `<select name="channel">${opts(CHANNELS, c?.channel || 'WhatsApp')}</select>`)}${field('Date', `<input type="date" name="date" value="${esc(c?.date || today())}">`)}</div>
        <div class="row2">${field('Outcome', `<select name="outcome">${opts(OUTCOMES, c?.outcome || 'Awaiting')}</select>`)}${field('Follow up on', `<input type="date" name="followUp" value="${esc(c?.followUp || addDays(today(), 3))}">`)}</div>
        ${field('Notes', `<textarea name="notes" rows="3" placeholder="What did you say? What did they say?">${esc(c?.notes || '')}</textarea>`)}`,
      danger: c ? `<button type="button" class="btn danger" data-del>${icon('trash-2', 15)} Delete</button>` : '',
      onOpen: (el, close) => el.querySelector('[data-del]')?.addEventListener('click', async () => { if (await confirmDlg(`Delete outreach to ${c.company}?`)) { close(); store.update(s => { s.career.contacts = s.career.contacts.filter(x => x.id !== c.id); }); } }),
      onSubmit: fd => {
        const v = { company: fd.get('company'), person: fd.get('person'), channel: fd.get('channel'), date: fd.get('date'), outcome: fd.get('outcome'), followUp: fd.get('followUp'), notes: fd.get('notes') };
        store.update(s => { if (c) Object.assign(s.career.contacts.find(x => x.id === c.id), v); else s.career.contacts.push({ id: uid(), ...v }); });
        toast('Saved', { type: 'ok' });
      },
    });
  }
  function textModal(title, label, onDone, extra = '') {
    formModal({ title, html: `${field(label, '<input name="t" required maxlength="200">')}${extra}`, onSubmit: fd => onDone(fd.get('t')) });
  }

  const tAppsHtml = () => {
    const apps = S().career.apps, t = today(), wk = weekStart(t), week = range(wk, addDays(wk, 6)), target = S().settings.weeklyApps || 5;
    const applied = apps.filter(a => a.status !== 'Saved'), responded = apps.filter(a => ['Interview', 'Offer', 'Rejected'].includes(a.status));
    const counts = Object.fromEntries(['All', ...APP_STATUS].map(k => [k, k === 'All' ? apps.length : apps.filter(a => a.status === k).length]));
    const list = apps.filter(a => st.filter === 'All' || a.status === st.filter).sort((a, b) => ((b.date || '') > (a.date || '') ? 1 : -1));
    const fu = followUpsDue();
    return `<div class="grid g4 stats"><div class="card stat"><div class="eyebrow mono">This week</div><div class="bignum mono">${appsIn(week).length}<small>/ ${target}</small></div>${bar(pct(appsIn(week).length, target), 'var(--c-career)')}</div>
      <div class="card stat"><div class="eyebrow mono">Total applied</div><div class="bignum mono">${applied.length}</div></div>
      <div class="card stat"><div class="eyebrow mono">Interviews / offers</div><div class="bignum mono">${apps.filter(a => a.status === 'Interview').length}<small>/ ${apps.filter(a => a.status === 'Offer').length}</small></div></div>
      <div class="card stat"><div class="eyebrow mono">Response rate</div><div class="bignum mono">${applied.length ? pct(responded.length, applied.length) : '–'}<small>%</small></div></div></div>
      ${fu.length ? `<div class="banner warn">${icon('bell', 18)}<span><b>${fu.length} follow-up${fu.length > 1 ? 's' : ''} due:</b> ${fu.slice(0, 3).map(f => esc(f.label)).join(', ')}${fu.length > 3 ? '…' : ''}</span></div>` : ''}
      <div class="card"><div class="card-h"><h3>Applications</h3><button class="btn sm primary" data-act="addApp">${icon('plus', 14)} Add</button></div>
        <div class="chips-row">${Object.entries(counts).map(([k, n]) => `<button class="chip ${st.filter === k ? 'on' : ''}" data-act="filter" data-v="${k}">${esc(k)} <em>${n}</em></button>`).join('')}</div>
        ${list.length ? `<div class="app-list">${list.map(a => `<div class="app-row"><div class="app-main" data-act="editApp" data-id="${a.id}" role="button" tabindex="0"><b>${esc(a.company)}</b><span class="muted">${esc(a.role || 'Role not set')}</span>
          <div class="act-s">${a.date ? `<span class="mono">${esc(fmtDate(a.date))}</span>` : ''}${a.contact ? `<span>${icon('user', 12)} ${esc(a.contact)}</span>` : ''}${a.interview ? `<span class="tag warn">Interview ${esc(relDay(a.interview))}</span>` : ''}${a.followUp ? `<span class="tag ${a.followUp <= today() && !['Offer', 'Rejected'].includes(a.status) ? 'warn' : ''}">Follow up ${esc(relDay(a.followUp))}</span>` : ''}${a.link ? `<a href="${esc(a.link)}" target="_blank" rel="noopener noreferrer" class="link">${icon('link', 12)} link</a>` : ''}</div></div>
          <select class="status ${statusClass(a.status)}" data-change="appStatus" data-id="${a.id}" aria-label="Status for ${esc(a.company)}">${opts(APP_STATUS, a.status)}</select></div>`).join('')}</div>` : empty(apps.length ? 'No matches' : 'No applications yet', apps.length ? 'Try another filter.' : 'Track each job you apply to. Aim for a steady weekly number.', '<button class="btn primary" data-act="addApp">Add application</button>')}</div>`;
  };

  const tContactsHtml = () => {
    const cs = S().career.contacts.slice().sort((a, b) => ((b.date || '') > (a.date || '') ? 1 : -1));
    return `<div class="card"><div class="card-h"><h3>Companies contacted</h3><button class="btn sm primary" data-act="addContact">${icon('plus', 14)} Log contact</button></div>
      ${cs.length ? `<div class="app-list">${cs.map(c => `<div class="app-row"><div class="app-main" data-act="editContact" data-id="${c.id}" role="button" tabindex="0"><b>${esc(c.company)}</b><span class="muted">${esc(c.person || 'Contact not named')} · ${icon('phone', 12)} ${esc(c.channel)}</span>
        <div class="act-s"><span class="mono">${esc(fmtDate(c.date))}</span>${c.followUp ? `<span class="tag ${c.followUp <= today() && ['Awaiting', 'No response'].includes(c.outcome) ? 'warn' : ''}">Follow up ${esc(relDay(c.followUp))}</span>` : ''}${c.notes ? `<span class="muted">${esc(c.notes.slice(0, 60))}${c.notes.length > 60 ? '…' : ''}</span>` : ''}</div></div>
        <select class="status" data-change="contactOutcome" data-id="${c.id}" aria-label="Outcome for ${esc(c.company)}">${opts(OUTCOMES, c.outcome)}</select></div>`).join('')}</div>` : empty('No outreach logged', 'Record every company, recruiter or person you reach out to, and when to follow up.', '<button class="btn primary" data-act="addContact">Log a contact</button>')}</div>`;
  };

  const tPrepHtml = () => {
    const prep = S().career.prep, checks = prep.filter(p => p.type === 'check'), qa = prep.filter(p => p.type === 'qa');
    const done = checks.filter(c => c.done).length;
    return `<div class="dash"><div class="card"><div class="card-h"><h3>Prep checklist</h3><span class="muted small mono">${done}/${checks.length}</span></div>${bar(pct(done, checks.length), 'var(--c-career)')}
        <div class="checks">${checks.map(c => `<div class="check ${c.done ? 'done' : ''}"><button class="chk" data-act="pcheck" data-id="${c.id}" aria-label="Toggle">${icon('check', 14)}</button><span>${esc(c.text)}</span><button class="btn icon ghost" data-act="pdel" data-id="${c.id}" aria-label="Remove">${icon('x', 14)}</button></div>`).join('')}</div>
        <button class="btn sm" data-act="addCheck">${icon('plus', 14)} Add item</button></div>
      <div class="card"><div class="card-h"><h3>Interview question bank</h3><button class="btn sm" data-act="addQ">${icon('plus', 14)} Add</button></div>
        <div class="qa">${qa.map(q => `<div class="qa-i"><div class="qa-h"><b>${esc(q.text)}</b><button class="btn icon ghost" data-act="pdel" data-id="${q.id}" aria-label="Remove">${icon('x', 14)}</button></div>
          <textarea rows="3" data-change="qans" data-id="${q.id}" placeholder="Write your answer. Use STAR: situation, task, action, result.">${esc(q.answer)}</textarea>
          <div class="conf"><small class="muted">Confidence</small>${[1, 2, 3].map(n => `<button class="chip ${q.conf === n ? 'on' : ''}" data-act="qconf" data-id="${q.id}" data-n="${n}">${['Shaky', 'OK', 'Ready'][n - 1]}</button>`).join('')}</div></div>`).join('')}</div></div></div>`;
  };

  const tLearnHtml = () => {
    const t = today(), wk = weekStart(t), week = range(wk, addDays(wk, 6)), mo = range(t.slice(0, 8) + '01', t), run = focus.running();
    const weeks = Array.from({ length: 8 }, (_, i) => addDays(wk, -7 * (7 - i)));
    const wdata = weeks.map(w => { const r = range(w, addDays(w, 6)); return { label: fmtDate(w, { day: 'numeric', month: 'short' }), value: Math.round((sessionMin(r) / 60) * 10) / 10 }; });
    const dom = DOMAINS.map(d => [d, sum(S().sessions.filter(x => week.includes(x.date) && x.domain === d).map(x => x.min))]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]);
    const maxD = Math.max(1, ...dom.map(d => d[1]));
    const recent = S().sessions.slice().sort((a, b) => (b.date + b.id > a.date + a.id ? 1 : -1)).slice(0, 12);
    return `<div class="grid g4 stats"><div class="card stat"><div class="eyebrow mono">Learning this week</div><div class="bignum mono">${hrs(sessionMin(week, 'learn'))}<small>h</small></div></div>
      <div class="card stat"><div class="eyebrow mono">Focus this week</div><div class="bignum mono">${hrs(sessionMin(week, 'focus'))}<small>h</small></div></div>
      <div class="card stat"><div class="eyebrow mono">This month</div><div class="bignum mono">${hrs(sessionMin(mo))}<small>h</small></div></div>
      <div class="card stat"><div class="eyebrow mono">Timer</div>${run ? `<div class="bignum mono" id="lclock">${focus.clock(focus.elapsedMs())}</div><button class="btn sm primary" data-act="timer">Stop</button>` : `<button class="btn primary" data-act="timer">${icon('play', 15)} Start timer</button>`}</div></div>
      <div class="grid g2"><div class="card"><div class="card-h"><h3>Hours per week</h3><button class="btn sm" data-act="logTime">${icon('plus', 14)} Log time</button></div>${bars(wdata, { max: Math.max(5, Math.ceil(Math.max(...wdata.map(w => w.value)))), ticks: [0, Math.max(5, Math.ceil(Math.max(...wdata.map(w => w.value)))) / 2, Math.max(5, Math.ceil(Math.max(...wdata.map(w => w.value))))].map(Math.round), hi: 7, color: 'var(--c-career)', fmt: v => v })}</div>
        <div class="card"><div class="card-h"><h3>This week by subject</h3></div>${dom.length ? dom.map(([d, m]) => hbar(d, Math.round((m / maxD) * 100), { color: 'var(--c-career)', suffix: '%', sub: `${hrs(m)} h` })).join('') : '<p class="muted">Start the timer or log time to see where your hours go.</p>'}</div></div>
      <div class="card"><div class="card-h"><h3>Recent sessions</h3></div>${recent.length ? `<div class="list">${recent.map(x => `<div class="li"><span class="mono">${esc(fmtDate(x.date))}</span><div><b>${esc(x.topic || x.domain)}</b><small class="muted">${x.kind === 'focus' ? 'Focus' : 'Learning'} · ${esc(x.domain)} · ${x.min} min</small></div><button class="btn icon ghost" data-act="delSess" data-id="${x.id}" aria-label="Delete">${icon('trash-2', 14)}</button></div>`).join('')}</div>` : '<p class="muted">No sessions yet.</p>'}</div>`;
  };

  function draw() {
    const fu = followUpsDue().length;
    root.innerHTML = `${pageHead('Career & Learning', 'Land the role, sharpen your skills, and keep learning every day.')}
      ${tabs([['apps', 'Applications', S().career.apps.length], ['contacts', 'Outreach', S().career.contacts.length], ['prep', 'Interview prep'], ['learn', 'Learning & focus']], st.tab)}<div class="gap"></div>
      ${st.tab === 'apps' ? tAppsHtml() : st.tab === 'contacts' ? tContactsHtml() : st.tab === 'prep' ? tPrepHtml() : tLearnHtml()}`;
  }

  bind(root, {
    tab: el => { st.tab = el.dataset.v; draw(); }, filter: el => { st.filter = el.dataset.v; draw(); },
    addApp: () => appModal(), editApp: el => appModal(S().career.apps.find(a => a.id === el.dataset.id)),
    appStatus: el => store.update(s => { const a = s.career.apps.find(x => x.id === el.dataset.id); a.status = el.value; if (el.value === 'Applied' && !a.date) a.date = today(); }),
    addContact: () => contactModal(), editContact: el => contactModal(S().career.contacts.find(c => c.id === el.dataset.id)),
    contactOutcome: el => store.update(s => { s.career.contacts.find(x => x.id === el.dataset.id).outcome = el.value; }),
    pcheck: el => store.update(s => { const p = s.career.prep.find(x => x.id === el.dataset.id); p.done = !p.done; }),
    pdel: el => store.update(s => { s.career.prep = s.career.prep.filter(x => x.id !== el.dataset.id); }),
    addCheck: () => textModal('Add prep item', 'What do you need to prepare?', t => store.update(s => s.career.prep.push({ id: uid(), type: 'check', text: t, done: false }))),
    addQ: () => textModal('Add interview question', 'Question', t => store.update(s => s.career.prep.push({ id: uid(), type: 'qa', text: t, answer: '', conf: 1 }))),
    qans: el => store.update(s => { s.career.prep.find(x => x.id === el.dataset.id).answer = el.value; }, { silent: true }),
    qconf: el => store.update(s => { s.career.prep.find(x => x.id === el.dataset.id).conf = +el.dataset.n; }),
    timer: () => focus.openFocus(), logTime: () => focus.logManual(),
    delSess: async el => { if (await confirmDlg('Delete this session?')) store.update(s => { s.sessions = s.sessions.filter(x => x.id !== el.dataset.id); }); },
  });
  const un = store.subscribe(draw); draw();
  const iv = setInterval(() => { const c = root.querySelector('#lclock'); if (c) c.textContent = focus.clock(focus.elapsedMs()); }, 1000);
  return () => { un(); clearInterval(iv); };
}
