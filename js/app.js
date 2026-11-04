// App shell: routing, navigation, theme, bell, timer pill, onboarding, service worker.
import * as store from './store.js';
import { newChallenge } from './store.js';
import * as fx from './fx.js';
import * as pwa from './pwa.js';
import * as reminders from './reminders.js';
import * as focus from './focus.js';
import { $, esc, fmtLong, today, uid, addDays, relDay } from './util.js';
import { icon, modal, formModal, toast, field, switchEl } from './ui.js';
import { openActivityEditor } from './acts.js';
import { streak } from './stats.js';
import { hydrate } from './charts.js';

export const ROUTES = [
  ['dashboard', 'Dashboard', 'layout-dashboard', 'Home'], ['schedule', 'Routine', 'calendar-clock', 'Routine'], ['checkin', 'Check-in', 'sun-moon', 'Check-in'],
  ['fitness', 'Fitness', 'dumbbell', 'Fitness'], ['nutrition', 'Nutrition', 'utensils', 'Food'], ['habits', 'Habits', 'repeat', 'Habits'], ['career', 'Career & Learning', 'briefcase', 'Career'],
  ['goals', 'Goals & Challenges', 'target', 'Goals'], ['analytics', 'Analytics & Reports', 'bar-chart-3', 'Analytics'], ['journal', 'Journal', 'book-open', 'Journal'], ['settings', 'Settings', 'settings', 'Settings'],
];
const TABS = ['dashboard', 'schedule', 'checkin', 'habits'];
let view = $('#view');
let cleanup = null, token = 0, current = '';

/* ---------- Theme ---------- */
function applyTheme() {
  const t = store.get().settings.theme;
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#060f2b' : '#f4f7ff');
  requestAnimationFrame(() => fx.readColors());
}
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);

/* ---------- Shell ---------- */
function renderShell() {
  const s = store.get();
  $('#side').innerHTML = `<a class="brand" href="#/dashboard"><img src="assets/logo.svg" alt="" width="38" height="38"><div><b class="mono">MODE</b><small class="muted">Personal OS</small></div></a>
    <nav class="nav" aria-label="Main">${ROUTES.map(([k, l, ic]) => `<a href="#/${k}" data-r="${k}">${icon(ic, 19)}<span>${esc(l)}</span></a>`).join('')}</nav>
    <div class="side-foot"><div class="streak-mini" id="sideStreak"></div><small class="muted mono">v1.0 · data stays on this device</small></div>`;
  $('#tabbar').innerHTML = TABS.map(k => { const r = ROUTES.find(x => x[0] === k); return `<a href="#/${k}" data-r="${k}">${icon(r[2], 21)}<span>${r[3]}</span></a>`; }).join('') + `<button id="moreBtn" aria-label="More">${icon('menu', 21)}<span>More</span></button>`;
  $('#fab').innerHTML = icon('plus', 26);
  renderTop();
}
function renderTop() {
  const s = store.get(), run = focus.running(), un = reminders.unread();
  $('#topActions').innerHTML = `${run ? `<button class="btn sm timer-pill" id="tpill">${icon('timer', 15)}<span class="mono" id="tclock2">${focus.clock(focus.elapsedMs())}</span></button>` : `<button class="btn icon ghost" id="tbtn" aria-label="Focus timer" title="Focus timer">${icon('timer', 19)}</button>`}
    ${pwa.canInstall() ? `<button class="btn sm primary" id="installBtn">${icon('download', 15)}<span class="hide-s">Install</span></button>` : ''}
    <button class="btn icon ghost bell" id="bellBtn" aria-label="Reminders" title="Reminders">${icon('bell', 19)}${un ? `<em>${un > 9 ? '9+' : un}</em>` : ''}</button>
    <button class="btn icon ghost" id="themeBtn" aria-label="Toggle theme" title="Toggle theme">${icon(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon', 19)}</button>`;
  const st = streak();
  const el = $('#sideStreak'); if (el) el.innerHTML = `${icon('flame', 16)}<b class="mono">${st}</b><span>day streak</span>`;
  $('#pdate').textContent = fmtLong(today());
}
function setActive(r) {
  document.querySelectorAll('[data-r]').forEach(a => a.classList.toggle('on', a.dataset.r === r));
  $('#moreBtn')?.classList.toggle('on', !TABS.includes(r));
  const meta = ROUTES.find(x => x[0] === r);
  $('#ptitle').textContent = meta ? meta[1] : 'Mode';
  document.title = `${meta ? meta[1] + ' · ' : ''}Mode`;
}

/* ---------- Router ---------- */
async function go() {
  const r = (location.hash.replace(/^#\/?/, '').split(/[/?]/)[0] || 'dashboard');
  const name = ROUTES.some(x => x[0] === r) ? r : 'dashboard';
  const my = ++token;
  setActive(name);
  try {
    const mod = await import(`./pages/${name}.js`);
    if (my !== token) return;
    cleanup?.(); cleanup = null;
    // brand-new container per route so delegated listeners from the previous page can never stack up
    const fresh = document.createElement('main'); fresh.id = 'view'; fresh.tabIndex = -1; fresh.className = 'page page-enter';
    view.replaceWith(fresh); view = fresh; mo.disconnect(); mo.observe(view, { childList: true, subtree: true }); scrollTo(0, 0);
    current = name;
    cleanup = mod.default(view) || null;
    fx.countUp(view);
    view.classList.remove('settled'); setTimeout(() => view.classList.add('settled'), 1500);
  } catch (e) {
    console.error(e);
    view.innerHTML = `<div class="card pad"><h3>Something went wrong loading this page</h3><p class="muted">${esc(e.message)}</p><a class="btn" href="#/dashboard">Back to dashboard</a></div>`;
  }
}
addEventListener('hashchange', go);
const mo = new MutationObserver(() => hydrate(view));
mo.observe(view, { childList: true, subtree: true });
let rz = 0; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => hydrate(view), 120); });

/* ---------- Bell ---------- */
function openBell() {
  const s = store.get(), up = reminders.upcoming();
  const m = modal({
    title: 'Reminders', wide: true,
    body: `<h4 class="eyebrow mono">Coming up today</h4>
      ${up.length ? `<div class="list">${up.slice(0, 8).map(r => `<div class="li"><span class="mono">${r.time}</span><div><b>${esc(r.title)}</b><small class="muted">${esc(r.body)}</small></div></div>`).join('')}</div>` : '<p class="muted">Nothing else scheduled for today.</p>'}
      <h4 class="eyebrow mono" style="margin-top:18px">Recent</h4>
      ${s.inbox.length ? `<div class="list">${s.inbox.slice(0, 12).map(i => `<a class="li ${i.read ? '' : 'unread'}" href="${i.route}" data-close><span class="mono">${new Date(i.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><div><b>${esc(i.title)}</b><small class="muted">${esc(i.body)}</small></div></a>`).join('')}</div>` : '<p class="muted">Reminders you receive will be kept here.</p>'}
      <p class="small muted" style="margin-top:14px">${reminders.permission() === 'granted' && s.settings.notify ? 'Browser notifications are on.' : 'Browser notifications are off. Turn them on in Settings. In-app alerts always work while Mode is open.'}</p>`,
    footer: `<a class="btn ghost" href="#/settings" data-close>Reminder settings</a><button class="btn" data-clear>Mark all read</button>`,
    onOpen: el => { el.querySelector('[data-clear]').onclick = () => { store.update(st => st.inbox.forEach(i => (i.read = true))); renderTop(); el.querySelectorAll('.unread').forEach(x => x.classList.remove('unread')); }; },
  });
}
function openMore() {
  modal({ title: 'More', body: `<div class="more-grid">${ROUTES.filter(r => !TABS.includes(r[0])).map(([k, l, ic]) => `<a href="#/${k}" data-close class="more-i">${icon(ic, 22)}<span>${esc(l)}</span></a>`).join('')}</div>` });
}

/* ---------- Onboarding ---------- */
function onboard() {
  formModal({
    title: 'Welcome to Mode', submit: 'Start my day',
    html: `<p class="muted">Your private operating system for prayer, fitness, business, career and discipline. Everything is saved on this device only. No account, no server.</p>
      ${field('What should I call you?', '<input name="name" placeholder="Your first name" maxlength="30" autocomplete="given-name">')}
      ${switchEl('challenge', true, 'Start the 30-day discipline challenge today')}
      ${switchEl('notify', true, 'Turn on reminders (asks your browser for permission)')}
      <p class="small muted">A starter routine, habits and workout plan are already loaded. Edit or delete anything.</p>`,
    onSubmit: async fd => {
      const name = fd.get('name');
      store.update(s => {
        s.settings.name = name; s.onboarded = true;
        if (fd.has('challenge')) s.goals.push(newChallenge('challenge30'));
      });
      renderTop();
      if (fd.has('notify')) { const p = await reminders.enable(); if (p !== 'granted') toast('Reminders will show inside the app. You can allow notifications later in Settings.'); }
      toast(`Let's go${name ? ', ' + name : ''}.`, { type: 'ok' });
    },
  });
}
/* ---------- Boot ---------- */
async function boot() {
  const s = store.load();
  applyTheme(); fx.setMotion(s.settings.motion); fx.initTilt();
  const quick = sessionStorage.getItem('mode.boot') === '1'; sessionStorage.setItem('mode.boot', '1');
  const splash = fx.boot(s.settings.name, { quick });
  const t0 = performance.now();
  renderShell();
  await go();
  const wait = Math.max(0, (quick ? 120 : 1350) - (performance.now() - t0));
  setTimeout(() => { splash.hide?.(); if (!store.get().onboarded) setTimeout(onboard, 350); }, wait);

  store.subscribe(() => { renderTop(); });
  setInterval(() => { const c = $('#tclock2'); if (c) c.textContent = focus.clock(focus.elapsedMs()); }, 1000);
  document.addEventListener('click', e => {
    const t = e.target.closest('#bellBtn,#themeBtn,#tbtn,#tpill,#installBtn,#moreBtn,#fab'); if (!t) return;
    if (t.id === 'bellBtn') openBell();
    if (t.id === 'themeBtn') { store.update(st => { st.settings.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; }, { silent: true }); applyTheme(); renderTop(); }
    if (t.id === 'tbtn' || t.id === 'tpill') focus.openFocus();
    if (t.id === 'moreBtn') openMore();
    if (t.id === 'fab') openActivityEditor(null, { quick: true });
    if (t.id === 'installBtn') installFlow();
  });
  document.addEventListener('keydown', e => {
    if (e.target.matches('input,textarea,select') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'n' && !document.querySelector('.modal-bg')) { e.preventDefault(); openActivityEditor(null, { quick: true }); }
    if (e.key === 'Enter' && e.target.matches?.('[role=button]')) e.target.click();
  });
  document.addEventListener('mode:error', e => toast(e.detail, { type: 'warn', ms: 7000 }));
  document.addEventListener('mode:prefs', () => { const c = store.get().settings; applyTheme(); fx.setMotion(c.motion); renderTop(); });
  pwa.onChange(renderTop);
  reminders.start();
  pwa.persist();
  registerSW();
}
export async function installFlow() {
  const r = await pwa.install();
  if (r === 'ios') modal({ title: 'Install on iPhone', body: `<ol class="steps"><li>Open Mode in <b>Safari</b>.</li><li>Tap the <b>Share</b> button.</li><li>Choose <b>Add to Home Screen</b>, then <b>Add</b>.</li></ol><p class="muted small">Mode then opens full screen like a native app and works offline.</p>` });
  else if (r === 'unavailable') toast('Use your browser menu: “Install app” or “Add to Home screen”.');
}

function registerSW() {
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  const had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW failed', e));
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (had) toast('Mode was updated.', { action: { label: 'Reload', fn: () => location.reload() }, ms: 9000 }); });
  navigator.serviceWorker.addEventListener('message', e => { if (e.data?.type === 'route') location.hash = e.data.route; });
}

boot();
