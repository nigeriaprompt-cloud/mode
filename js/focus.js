// Focus / learning timer. Survives reloads (stores the start timestamp) and logs a session when stopped.
import * as store from './store.js';
import { DOMAINS } from './store.js';
import { today, uid, esc, pad, fmtDate } from './util.js';
import { modal, formModal, toast, field, seg, icon } from './ui.js';

export const running = () => store.get().timer;
export const elapsedMs = () => (running() ? Date.now() - running().start : 0);
export const clock = ms => { const s = Math.floor(ms / 1000); return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`; };

export function start({ kind, topic, domain }) { store.update(s => { s.timer = { start: Date.now(), kind, topic, domain }; }); }
export function stop({ save = true } = {}) {
  const t = running(); if (!t) return;
  const min = Math.round((Date.now() - t.start) / 60000);
  store.update(s => {
    if (save && min >= 1) s.sessions.push({ id: uid(), date: today(), min, kind: t.kind, topic: t.topic, domain: t.domain });
    s.timer = null;
  });
  toast(save ? (min >= 1 ? `Logged ${min} min of ${t.kind === 'focus' ? 'focus' : 'learning'}` : 'Under a minute, not logged') : 'Timer discarded');
}

export function logManual(defaults = {}) {
  formModal({
    title: 'Log time', submit: 'Log',
    html: `${seg('kind', [['focus', 'Focus work'], ['learn', 'Learning']], defaults.kind || 'learn')}
      ${field('Topic', `<input name="topic" placeholder="e.g. MySQL joins, cell biology chapter 4" value="${esc(defaults.topic || '')}">`)}
      <div class="row2">${field('Domain', `<select name="domain">${DOMAINS.map(d => `<option ${d === defaults.domain ? 'selected' : ''}>${esc(d)}</option>`).join('')}</select>`)}
      ${field('Minutes', `<input type="number" name="min" min="1" max="720" value="${defaults.min || 30}" required>`)}</div>
      ${field('Date', `<input type="date" name="date" value="${today()}" max="${today()}">`)}`,
    onSubmit: fd => { store.update(s => s.sessions.push({ id: uid(), date: fd.get('date') || today(), min: Math.max(1, +fd.get('min') || 0), kind: fd.get('kind'), topic: fd.get('topic'), domain: fd.get('domain') })); toast('Time logged'); },
  });
}

export function openFocus() {
  let iv = 0;
  const t = running();
  const m = modal({
    title: t ? 'Timer running' : 'Start a timer', onClose: () => clearInterval(iv),
    body: t
      ? `<div class="timer-big mono" id="tclock">${clock(elapsedMs())}</div><p class="center muted">${t.kind === 'focus' ? 'Focus' : 'Learning'} · ${esc(t.domain)}${t.topic ? ' · ' + esc(t.topic) : ''}</p>
         <div class="btn-row center"><button class="btn primary" data-s>${icon('square', 16)} Stop &amp; log</button><button class="btn ghost" data-d>Discard</button></div>`
      : `<form class="form">${seg('kind', [['focus', 'Focus work'], ['learn', 'Learning']], 'focus')}
         ${field('What are you working on?', `<input name="topic" placeholder="e.g. ThePrompt checkout flow">`)}
         ${field('Domain', `<select name="domain">${DOMAINS.map(d => `<option>${d}</option>`).join('')}</select>`)}
         <div class="form-foot"><button type="button" class="btn ghost" data-m>Log time manually</button><span class="grow"></span><button class="btn primary" type="submit">${icon('play', 16)} Start</button></div></form>`,
    onOpen: (el, close) => {
      if (t) {
        iv = setInterval(() => { const c = el.querySelector('#tclock'); if (c) c.textContent = clock(elapsedMs()); }, 1000);
        el.querySelector('[data-s]').onclick = () => { stop(); close(); };
        el.querySelector('[data-d]').onclick = () => { stop({ save: false }); close(); };
      } else {
        const f = el.querySelector('form');
        f.onsubmit = e => { e.preventDefault(); const d = new FormData(f); start({ kind: d.get('kind'), topic: (d.get('topic') || '').trim(), domain: d.get('domain') }); close(); toast('Timer started'); };
        el.querySelector('[data-m]').onclick = () => { close(); logManual(); };
      }
    },
  });
  return m;
}
