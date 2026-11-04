// UI kit: toasts, modals, confirm, rings, delegated events, shared field builders.
import { esc, $, DAY1, WEEK_ORDER, formData } from './util.js';
import { icon } from './icons.js';
import { CATS, CAT_KEYS } from './store.js';

export { icon };

/* ---------- Toasts ---------- */
export function toast(msg, { action, ms = 3200, type = '' } = {}) {
  let host = $('#toasts');
  if (!host) { host = document.createElement('div'); host.id = 'toasts'; host.setAttribute('aria-live', 'polite'); document.body.append(host); }
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button class="btn sm ghost">${esc(action.label)}</button>` : ''}`;
  if (action) t.querySelector('button').onclick = () => { action.fn(); t.remove(); };
  host.append(t);
  const kill = () => { t.classList.add('out'); setTimeout(() => t.remove(), 250); };
  setTimeout(kill, ms);
  while (host.children.length > 3) host.firstChild.remove();
}

/* ---------- Modals ---------- */
let openCount = 0;
export function modal({ title, body, footer = '', wide = false, onOpen, onClose, id = '' }) {
  const prev = document.activeElement;
  const el = document.createElement('div');
  el.className = 'modal-bg';
  el.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}" id="${id}">
    <header><h3>${esc(title)}</h3><button class="btn icon ghost" data-close aria-label="Close">${icon('x')}</button></header>
    <div class="modal-body">${body}</div>${footer ? `<footer>${footer}</footer>` : ''}</div>`;
  document.body.append(el); openCount++; document.body.classList.add('lock');
  requestAnimationFrame(() => el.classList.add('in'));
  const close = () => {
    if (!el.isConnected) return;
    el.classList.remove('in'); openCount--; if (!openCount) document.body.classList.remove('lock');
    setTimeout(() => el.remove(), 200); document.removeEventListener('keydown', esc_); onClose?.(); prev?.focus?.();
  };
  const esc_ = e => { if (e.key === 'Escape' && el === [...document.querySelectorAll('.modal-bg')].at(-1)) close(); };
  document.addEventListener('keydown', esc_);
  el.addEventListener('mousedown', e => { if (e.target === el) close(); });
  el.addEventListener('click', e => { if (e.target.closest('[data-close]')) close(); });
  onOpen?.(el, close);
  setTimeout(() => el.querySelector('input:not([type=hidden]):not([type=checkbox]),textarea,select')?.focus({ preventScroll: true }), 60);
  return { el, close };
}

/** Form modal. onSubmit(fd, close, formEl) — return false to keep it open. */
export function formModal({ title, html, submit = 'Save', onSubmit, extra = '', wide = false, onOpen, danger }) {
  const m = modal({
    title, wide,
    body: `<form class="form" novalidate>${html}<div class="form-foot">${danger || ''}<span class="grow"></span><button type="button" class="btn ghost" data-close>Cancel</button><button type="submit" class="btn primary">${esc(submit)}</button></div></form>${extra}`,
    onOpen: (el, close) => {
      const f = el.querySelector('form');
      f.addEventListener('submit', e => {
        e.preventDefault();
        const bad = [...f.querySelectorAll('[required]')].find(i => !i.value.trim());
        if (bad) { bad.classList.add('err'); bad.focus(); return; }
        if (onSubmit(formData(f), close, f) !== false) close();
      });
      f.addEventListener('input', e => e.target.classList.remove('err'));
      onOpen?.(el, close, f);
    },
  });
  return m;
}

export function confirmDlg(msg, ok = 'Delete', { danger = true } = {}) {
  return new Promise(res => {
    let done = false; const fin = v => { if (!done) { done = true; res(v); } };
    modal({
      title: 'Are you sure?', body: `<p class="muted">${esc(msg)}</p>`,
      footer: `<button class="btn ghost" data-close>Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" data-ok>${esc(ok)}</button>`,
      onOpen: (el, close) => { el.querySelector('[data-ok]').onclick = () => { fin(true); close(); }; },
      onClose: () => fin(false),
    });
  });
}

/* ---------- Event delegation helper ---------- */
export function bind(root, map) {
  for (const type of ['click', 'change', 'input', 'submit', 'keydown']) {
    const attr = `data-${type === 'click' ? 'act' : type}`;
    root.addEventListener(type, e => {
      const t = e.target.closest?.(`[${attr}]`);
      if (!t || !root.contains(t)) return;
      const fn = map[t.getAttribute(attr)];
      if (fn) fn(t, e);
    });
  }
}

/* ---------- Visual atoms ---------- */
export function ring({ value, size = 140, stroke = 12, label = '', sub = '', id = 'r' + Math.random().toString(36).slice(2, 6) }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, v = value === null ? 0 : Math.max(0, Math.min(100, value));
  return `<div class="ring ${size < 100 ? 'sm' : ''}" style="width:${size}px;height:${size}px">
    <svg viewBox="0 0 ${size} ${size}"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--ring-a)"/><stop offset="1" stop-color="var(--ring-b)"/></linearGradient></defs>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-bg" stroke-width="${stroke}"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-fg" stroke="url(#${id})" stroke-width="${stroke}" style="--c:${c.toFixed(1)};--o:${(c * (1 - v / 100)).toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>
    <div class="ring-t"><b class="mono" ${value === null ? '' : `data-count="${v}"`}>${value === null ? '–' : v}</b>${label ? `<small>${esc(label)}</small>` : ''}${sub ? `<small class="muted">${esc(sub)}</small>` : ''}</div></div>`;
}
export const bar = (v, color = 'var(--accent)') => `<div class="bar-t"><i style="width:${Math.max(0, Math.min(100, v))}%;background:${color}"></i></div>`;
export const catPill = k => `<span class="pill c-${k}"><i></i>${esc(CATS[k]?.short || k)}</span>`;
export const stars = n => `<span class="stars" title="Importance ${n}/3">${[1, 2, 3].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;
export const empty = (title, text, cta = '') => `<div class="empty"><div class="empty-ic">${icon('sparkles', 26)}</div><b>${esc(title)}</b><p class="muted">${esc(text)}</p>${cta}</div>`;
export const catOptions = sel => CAT_KEYS.map(k => `<option value="${k}" ${k === sel ? 'selected' : ''}>${esc(CATS[k].label)}</option>`).join('');
export const dayChips = (days, name = 'days') => `<div class="chips">${WEEK_ORDER.map(i => `<label class="chip-cb"><input type="checkbox" name="${name}" value="${i}" ${days.includes(i) ? 'checked' : ''}><span>${DAY1[i]}</span></label>`).join('')}</div>`;
export const seg = (name, opts, sel) => `<div class="seg">${opts.map(([v, l]) => `<label><input type="radio" name="${name}" value="${esc(v)}" ${String(v) === String(sel) ? 'checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div>`;
export const field = (label, inner, hint = '') => `<label class="field"><span>${esc(label)}</span>${inner}${hint ? `<small class="muted">${esc(hint)}</small>` : ''}</label>`;
export const switchEl = (name, on, label = '') => `<label class="switch"><input type="checkbox" name="${name}" ${on ? 'checked' : ''}><i></i>${label ? `<span>${esc(label)}</span>` : ''}</label>`;
export const yesNo = (name, v) => seg(name, [['yes', 'Yes'], ['no', 'No']], v);

export function tabs(items, active, act = 'tab') {
  return `<div class="tabs" role="tablist">${items.map(([k, l, n]) => `<button role="tab" class="${k === active ? 'on' : ''}" data-act="${act}" data-v="${k}">${esc(l)}${n !== undefined ? `<em>${n}</em>` : ''}</button>`).join('')}</div>`;
}
export function pageHead(title, sub = '', actions = '') {
  return `<div class="page-head"><div><h1>${esc(title)}</h1>${sub ? `<p class="muted">${sub}</p>` : ''}</div><div class="page-actions">${actions}</div></div>`;
}
