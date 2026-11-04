import * as store from '../store.js';
import { CATS, CAT_KEYS, DEFAULT_WEIGHTS, defaults } from '../store.js';
import * as pwa from '../pwa.js';
import * as reminders from '../reminders.js';
import { esc, today, sum, uid } from '../util.js';
import { icon, bind, pageHead, field, seg, switchEl, toast, confirmDlg, modal } from '../ui.js';
import { breakdownHtml } from '../acts.js';
import { installFlow } from '../app.js';

const prefs = () => document.dispatchEvent(new Event('mode:prefs'));
const setPath = (o, path, v) => { const p = path.split('.'); const last = p.pop(); p.reduce((a, k) => a[k], o)[last] = v; };

export default function settings(root) {
  let storageInfo = null;
  pwa.estimate().then(e => { storageInfo = e; draw(); });
  pwa.persist().then(p => { persisted = p; draw(); });
  let persisted = null;

  function draw() {
    const s = store.get(), set = s.settings, R = set.remind, w = set.weights, tw = sum(CAT_KEYS.map(k => w[k])) || 1;
    const perm = reminders.permission();
    const rem = (k, label, extra = '') => `<div class="rem-row"><label class="switch"><input type="checkbox" data-change="rem" data-k="${k}.on" ${R[k].on ? 'checked' : ''}><i></i><span>${label}</span></label>${R[k].time !== undefined ? `<input type="time" data-change="rem" data-k="${k}.time" value="${R[k].time}" aria-label="${label} time">` : extra}</div>`;
    root.innerHTML = `${pageHead('Settings', 'Make Mode yours. Everything here is stored on this device.')}
      <div class="grid g2">
      <div class="card pad form"><div class="card-h"><h3>${icon('user', 17)} Profile & look</h3></div>
        ${field('Your name', `<input data-change="pref" data-k="name" value="${esc(set.name)}" maxlength="30" placeholder="Your first name">`)}
        <div class="field"><span>Theme</span>${seg('theme', [['dark', 'Navy'], ['light', 'White'], ['auto', 'Auto']], set.theme).replace(/<input /g, '<input data-change="pref" data-k="theme" ')}</div>
        <label class="switch"><input type="checkbox" data-change="pref" data-k="motion" ${set.motion ? 'checked' : ''}><i></i><span>3D motion effects (helix, matrix rain, tilt)</span></label>
        <label class="switch"><input type="checkbox" data-change="pref" data-k="verse" ${set.verse ? 'checked' : ''}><i></i><span>Show a Bible verse on the dashboard</span></label>
        <p class="small muted">Motion also turns off automatically if your device asks for reduced motion.</p></div>

      <div class="card pad form"><div class="card-h"><h3>${icon('bell', 17)} Reminders</h3><span class="badge ${perm === 'granted' && set.notify ? 'ok' : ''}">${perm === 'granted' && set.notify ? 'Notifications on' : 'In-app only'}</span></div>
        ${rem('morning', 'Morning check-in')}${rem('workout', 'Workout time')}${rem('evening', 'Evening review')}${rem('sleep', 'Sleep target (wind-down)')}
        ${rem('activities', 'Scheduled activities', `<span class="inline">lead <input type="number" min="0" max="60" data-change="rem" data-k="activities.lead" value="${R.activities.lead}" aria-label="Minutes before"> min</span>`)}
        ${rem('habits', 'Habit reminders (set per habit)', '<span></span>')}
        <div class="btn-row">${perm === 'granted' ? `<button class="btn" data-act="notifyToggle">${set.notify ? 'Pause browser notifications' : 'Resume browser notifications'}</button>` : perm === 'denied' ? '<span class="small muted">Notifications are blocked in your browser settings for this site.</span>' : perm === 'unsupported' ? '<span class="small muted">This browser does not support notifications.</span>' : `<button class="btn primary" data-act="notifyOn">${icon('bell', 15)} Enable browser notifications</button>`}<button class="btn ghost" data-act="testNotify">Send test</button></div>
        <p class="small muted">Browsers deliver reminders while Mode is open or running in the background. Installed apps on Android keep running more reliably. Without permission you still get in-app alerts and the bell.</p></div>

      <div class="card pad form"><div class="card-h"><h3>${icon('shield-check', 17)} Discipline score weights</h3><button class="link" data-act="wReset">Reset</button></div>
        ${CAT_KEYS.map(k => `<div class="wrow c-${k}"><span class="pill c-${k}"><i></i>${esc(CATS[k].label)}</span><input type="range" min="0" max="50" step="5" value="${w[k]}" data-input="wLive" data-change="wSet" data-k="${k}" aria-label="${esc(CATS[k].label)} weight"><b class="mono" id="w-${k}">${Math.round((w[k] / tw) * 100)}%</b></div>`).join('')}
        <p class="small muted">Weights are balanced to total 100%. Currently entered: <b class="mono" id="wsum">${sum(CAT_KEYS.map(k => w[k]))}</b> points.</p>
        <div class="row2">${field('Streak counts days at', `<input type="number" min="10" max="100" step="5" data-change="pref" data-k="streakMin" value="${set.streakMin}">`, '% of the day completed')}${field('Applications per week', `<input type="number" min="1" max="50" data-change="pref" data-k="weeklyApps" value="${set.weeklyApps}">`, 'Career target')}</div>
        <button class="btn" data-act="how">${icon('info', 15)} Show today's score breakdown</button></div>

      <div class="card pad form"><div class="card-h"><h3>${icon('smartphone', 17)} Install & storage</h3></div>
        ${pwa.isStandalone() ? '<p>✅ Running as an installed app.</p>' : pwa.canInstall() ? `<button class="btn primary" data-act="install">${icon('download', 15)} Install Mode on this device</button>` : '<p class="muted small">To install: use your browser menu → “Install app” (Chrome/Edge) or Share → “Add to Home Screen” (iPhone Safari).</p>'}
        <div class="kv"><span>Offline ready</span><b>${'serviceWorker' in navigator && navigator.serviceWorker.controller ? 'Yes' : 'After first load'}</b></div>
        <div class="kv"><span>Persistent storage</span><b>${persisted === null ? '…' : persisted ? 'Protected' : 'Not guaranteed'}</b></div>
        <div class="kv"><span>Data size</span><b class="mono">${(store.usage() / 1024).toFixed(0)} KB${storageInfo ? ` of ${(storageInfo.quota / 1048576).toFixed(0)} MB` : ''}</b></div>
        <p class="small muted">Your data lives only in this browser. Clearing site data or switching browsers removes it, so export a backup regularly.</p></div>

      <div class="card pad form span2"><div class="card-h"><h3>${icon('download', 17)} Your data</h3><span class="muted small">Last backup: ${set.lastBackup || 'never'}</span></div>
        <div class="btn-row"><button class="btn primary" data-act="export">${icon('download', 15)} Export backup (JSON)</button><button class="btn" data-act="import">${icon('upload', 15)} Import backup</button><button class="btn" data-act="restoreRoutine">${icon('rotate-ccw', 15)} Restore suggested routine</button><span class="grow"></span><button class="btn danger" data-act="wipe">${icon('trash-2', 15)} Erase everything</button></div>
        <input type="file" id="file" accept="application/json,.json" hidden></div>
      <div class="card pad span2"><p class="muted small mono">Mode v1.0 · private, offline-first · no account, no tracking · press <kbd>N</kbd> anywhere to quick-add an activity</p></div>
      </div>`;
  }

  const num = (el) => (el.type === 'checkbox' ? el.checked : el.type === 'number' ? +el.value : el.value);
  bind(root, {
    pref: el => { store.update(s => setPath(s.settings, el.dataset.k, el.type === 'checkbox' ? el.checked : el.type === 'number' ? Math.max(1, +el.value || 1) : el.type === 'radio' ? el.value : el.value.trim())); prefs(); },
    rem: el => store.update(s => setPath(s.settings.remind, el.dataset.k, num(el)), { silent: true }),
    wLive: el => {
      const k = el.dataset.k, w = { ...store.get().settings.weights, [k]: +el.value }, tw = sum(CAT_KEYS.map(x => w[x])) || 1;
      CAT_KEYS.forEach(x => { const o = root.querySelector('#w-' + x); if (o) o.textContent = Math.round((w[x] / tw) * 100) + '%'; });
      root.querySelector('#wsum').textContent = sum(CAT_KEYS.map(x => w[x]));
    },
    wSet: el => store.update(s => { s.settings.weights[el.dataset.k] = +el.value; }),
    wReset: () => store.update(s => { s.settings.weights = { ...DEFAULT_WEIGHTS }; }),
    how: () => modal({ title: 'How your score is calculated', wide: true, body: breakdownHtml(today()) }),
    notifyOn: async () => { const p = await reminders.enable(); toast(p === 'granted' ? 'Browser notifications enabled' : 'Permission not granted. In-app reminders still work.', { type: p === 'granted' ? 'ok' : 'warn' }); draw(); },
    notifyToggle: () => store.update(s => { s.settings.notify = !s.settings.notify; }),
    testNotify: () => reminders.test(),
    install: () => installFlow(),
    export: () => { store.backup(); toast('Backup downloaded', { type: 'ok' }); },
    import: () => root.querySelector('#file').click(),
    restoreRoutine: () => {
      const d = defaults(); let n = 0;
      store.update(s => { for (const a of d.acts) if (!s.acts.some(x => x.key === a.key && !x.end)) { s.acts.push({ ...a, id: uid(), habit: null }); n++; } });
      toast(n ? `Restored ${n} suggested activities` : 'Your routine already has every suggested activity');
    },
    wipe: async () => { if (await confirmDlg('This permanently erases all routines, habits, check-ins, journal and history on this device. Export a backup first if unsure.', 'Erase everything')) { store.reset(); localStorage.removeItem('mode.v1'); location.hash = '#/dashboard'; location.reload(); } },
  });
  root.addEventListener('change', async e => {
    if (e.target.id !== 'file' || !e.target.files[0]) return;
    try {
      const data = JSON.parse(await e.target.files[0].text());
      if (!Array.isArray(data.acts) || !data.settings) throw new Error('This does not look like a Mode backup.');
      if (await confirmDlg('Replace everything on this device with the backup? Current data will be overwritten.', 'Import', { danger: false })) { store.replaceAll(data); prefs(); toast('Backup imported', { type: 'ok' }); }
    } catch (err) { toast(err.message || 'Could not read that file', { type: 'warn' }); }
    e.target.value = '';
  });
  const un = store.subscribe(draw); draw();
  return un;
}
