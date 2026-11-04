// Nutrition: built from the user's own plan (affordable Nigerian foods, ₦1,000–₦1,500/day, gentle muscle building).
import * as store from '../store.js';
import { dayPlan } from '../stats.js';
import { esc, today, addDays, lastNDays, dow, fmt12, fmtDate, diffDays, uid, sum, pct, DAYS, WEEK_ORDER } from '../util.js';
import { icon, bind, pageHead, bar, field, seg, formModal, modal, confirmDlg, toast, empty, switchEl } from '../ui.js';
import { bars, area } from '../charts.js';
import { toggleItem } from '../acts.js';

// key, title, time, importance, minutes, menu field
export const SLOTS = [
  ['meal_breakfast', 'Breakfast', '07:30', 3, 20, 'breakfast'], ['meal_snack_am', 'Morning snack', '10:30', 1, 10, 'snack'],
  ['meal_lunch', 'Lunch', '13:00', 3, 30, 'lunch'], ['meal_snack_pm', 'Afternoon snack', '16:30', 1, 10, 'pm'], ['meal_dinner', 'Dinner', '18:00', 3, 30, 'dinner'],
];
const ACCESS = [['enough', 'Ate enough'], ['some', 'Skipped some meals'], ['little', 'Little or no food']];
const ALL = [0, 1, 2, 3, 4, 5, 6];

export function applyPlan({ meals = true, workouts = true, weighin = true } = {}) {
  store.update(s => {
    const t = today(), mk = (o) => ({ id: uid(), habit: null, days: ALL, start: t, end: null, remind: true, ...o });
    if (meals) for (const [key, title, time, imp, dur] of SLOTS) if (!s.acts.some(a => a.key === key && !a.end)) s.acts.push(mk({ key, title, time, dur, cat: 'fitness', imp }));
    if (workouts) {
      const setEx = (name, unit, target, step) => { const e = s.fit.exercises.find(x => x.name.toLowerCase().startsWith(name.toLowerCase())); if (e) Object.assign(e, { target, step }); else s.fit.exercises.push({ id: uid(), name, unit, target, step }); };
      setEx('Push-ups', 'reps', 8, 4); setEx('Squats', 'reps', 10, 5); setEx('Sit-ups', 'reps', 0, 5); setEx('Plank', 'sec', 15, 5); setEx('Lunges', 'reps', 16, 8);
      const ex = s.acts.find(a => a.key === 'exercise' && !a.end);
      if (ex) { ex.days = [1, 3, 5]; ex.title = 'Home workout (full body)'; ex.dur = 20; }
      if (!s.acts.some(a => a.key === 'recovery' && !a.end)) s.acts.push(mk({ key: 'recovery', title: 'Recovery walk and light stretching', time: '06:30', dur: 20, cat: 'fitness', imp: 1, days: [2, 6, 0] }));
    }
    if (weighin && !s.habits.some(h => h.name.startsWith('Weekly weigh-in'))) s.habits.push({ id: uid(), name: 'Weekly weigh-in', cat: 'fitness', freq: 'weekly', target: 1, days: ALL, reminder: '', start: t, archived: false });
    s.nutrition.setup = true;
  });
}

export default function nutrition(root) {
  const S = () => store.get(), N = () => S().nutrition;
  const t = today();
  const weights = () => Object.entries(S().fit.log).filter(([, l]) => +l.weight > 0).map(([d, l]) => ({ d, w: +l.weight })).sort((a, b) => (a.d < b.d ? -1 : 1));
  const slotText = (key, field, date = t) => (field === 'pm' ? N().snackPm : N().menu[dow(date)]?.[field] || '');

  function weightWatch() {
    const ws = weights(); if (!ws.length) return null;
    const last = ws.at(-1), ref = [...ws].reverse().find(x => diffDays(x.d, last.d) >= 10);
    if (!ref) return { last, kind: 'new' };
    const diff = +(last.w - ref.w).toFixed(1), days = diffDays(ref.d, last.d);
    return { last, ref, diff, days, kind: diff <= -1 || diff / ref.w <= -0.02 ? 'down' : diff >= 0.5 ? 'up' : 'steady' };
  }

  function draw() {
    const s = S(), n = N(), { items } = dayPlan(t), meals = items.filter(i => i.key?.startsWith('meal_'));
    const setup = n.setup, eaten = meals.filter(m => m.done).length, mains = meals.filter(m => m.imp >= 3);
    const log = n.log[t] || {}, days14 = lastNDays(14), days30 = lastNDays(30);
    const spendBars = days14.map(d => ({ label: String(+d.slice(8)), value: n.log[d]?.spend ? +n.log[d].spend : null, title: `${fmtDate(d)}: ₦${n.log[d]?.spend || 0}` }));
    const spent7 = lastNDays(7).map(d => +n.log[d]?.spend || 0).filter(Boolean), avg7 = spent7.length ? Math.round(sum(spent7) / spent7.length) : null;
    const cnt = k => days30.filter(d => n.log[d]?.access === k).length, logged = days30.filter(d => n.log[d]?.access).length;
    let okRun = 0; for (let d = t; n.log[d]?.access === 'enough' || (d === t && !n.log[d]?.access); d = addDays(d, -1)) { if (n.log[d]?.access === 'enough') okRun++; if (okRun > 400) break; }
    const ww = weightWatch(), ws = weights(), h = +n.height;
    const bmi = ww && h ? +(ww.last.w / ((h / 100) ** 2)).toFixed(1) : null;
    const shop = n.shop, boughtCost = sum(shop.filter(x => x.bought).map(x => +x.cost || 0));

    root.innerHTML = `${pageHead('Nutrition', 'Eat enough, every day, on a budget. Built from your own plan with affordable Nigerian foods.')}
      ${!setup ? `<div class="card promo" data-tilt><div><h3>${icon('utensils', 18)} Set up your nutrition plan</h3><p class="muted">Adds your five meal times to the daily routine (with reminders), switches the workout to your gentle beginner plan, and adds a weekly weigh-in habit. You can edit everything afterwards.</p></div><button class="btn primary" data-act="setup">Set up my plan</button></div>` : ''}
      <div class="grid g4 stats">
        <div class="card stat"><div class="eyebrow mono">Meals today</div><div class="bignum mono">${setup ? eaten : '–'}<small>/ ${setup ? meals.length : 5}</small></div>${setup ? bar(pct(eaten, meals.length), 'var(--c-fitness)') : ''}</div>
        <div class="card stat"><div class="eyebrow mono">Eating-enough streak</div><div class="bignum mono">${icon('flame', 22)}${okRun}<small>days</small></div></div>
        <div class="card stat"><div class="eyebrow mono">Avg spend (7d)</div><div class="bignum mono">${avg7 === null ? '–' : '₦' + avg7.toLocaleString()}</div><small class="muted">budget ₦${(+n.budget.min).toLocaleString()}–₦${(+n.budget.max).toLocaleString()}/day</small></div>
        <div class="card stat"><div class="eyebrow mono">Latest weight</div><div class="bignum mono">${ww ? ww.last.w : '–'}<small>kg</small></div>${ww?.diff !== undefined ? `<small class="${ww.kind === 'down' ? 'warn' : 'muted'}">${ww.diff > 0 ? '+' : ''}${ww.diff} kg in ${ww.days} days</small>` : '<small class="muted">weigh in weekly</small>'}</div></div>

      ${ww?.kind === 'down' ? `<div class="banner warn">${icon('alert-triangle', 18)}<span><b>Your weight is down ${Math.abs(ww.diff)} kg over ${ww.days} days.</b> Put meals and protein first this week. If weight keeps falling even when you are eating enough, book a medical check-up, as your plan says. See the symptom list below.</span></div>`
        : ww?.kind === 'up' || ww?.kind === 'steady' ? `<div class="banner">${icon('check-circle-2', 18)}<span><b>Weight is ${ww.kind === 'up' ? 'rising' : 'steady'}.</b> That is the direction you want. Keep every meal on schedule.</span></div>` : ''}

      <div class="dash">
        <div class="card"><div class="card-h"><h3>${icon('utensils', 18)} Today's menu · ${DAYS[dow(t)]}</h3><span class="muted small">${setup ? `${eaten}/${meals.length} eaten` : 'set up to tick meals'}</span></div>
          <div class="acts">${SLOTS.map(([key, title, time, imp, , f]) => {
            const it = meals.find(m => m.key === key), txt = slotText(key, f);
            return `<div class="act c-fitness ${it?.done ? 'done' : ''}">${it ? `<button class="chk" data-act="eat" data-id="${it.uid}" aria-label="Mark ${esc(title)} eaten">${icon('check', 16)}</button>` : '<span class="chk off"></span>'}
              <div class="act-main"><div class="act-t">${esc(title)}: ${esc(txt || 'Not planned')}</div><div class="act-s"><span class="mono">${fmt12(it?.time || time)}</span>${imp >= 3 ? '<span class="tag">main meal</span>' : ''}${it?.done && it.at ? `<span class="ok mono">✓ ${fmt12(it.at)}</span>` : ''}</div></div></div>`;
          }).join('')}</div>
          <p class="muted small">The goal is to never skip a day of eating and to build a steady pattern. Swap meals freely depending on money and what is available.</p></div>
        <div class="stack">
          <div class="card form"><div class="card-h"><h3>Today's food check</h3></div>
            <div class="field"><span>How did food go today?</span>${seg('access', ACCESS, log.access || '').replace(/<input /g, '<input data-change="access" ')}</div>
            ${field('Spent on food today (₦)', `<input type="number" min="0" step="50" inputmode="numeric" data-change="spend" value="${esc(log.spend ?? '')}" placeholder="e.g. 1200">`)}
            <p class="small muted">Logging honestly shows whether the budget is enough. It is private and stays on this device.</p></div>
          <div class="card form"><div class="card-h"><h3>${icon('scale', 17)} Weigh-in</h3></div>
            <div class="row2">${field('Weight (kg)', `<input type="number" step="0.1" min="20" inputmode="decimal" data-change="weight" value="${esc(S().fit.log[t]?.weight || '')}" placeholder="same time each week">`)}${field('Height (cm)', `<input type="number" min="100" max="230" inputmode="numeric" data-change="height" value="${esc(n.height)}" placeholder="optional">`)}</div>
            ${bmi ? `<div class="kv"><span>BMI</span><b class="mono">${bmi}</b></div><p class="small muted">${bmi < 18.5 ? 'Below 18.5 is the underweight range. Eating enough every day comes first.' : bmi < 25 ? 'In the healthy range (18.5 to 24.9).' : 'Above the healthy range (18.5 to 24.9).'}</p>` : ''}</div></div>
      </div>

      <div class="grid g2">
        <div class="card"><div class="card-h"><h3>Food spend, 14 days</h3><span class="muted small">gridlines = your budget</span></div>${bars(spendBars, { max: Math.max(+n.budget.max * 1.4, ...spendBars.map(b => b.value || 0)), ticks: [0, +n.budget.min, +n.budget.max], fmt: v => (v >= 1000 ? v / 1000 + 'k' : v), hi: 13, color: 'var(--c-career)', values: false })}</div>
        <div class="card"><div class="card-h"><h3>Weight trend</h3><span class="muted small">kg</span></div>${ws.length > 1 ? area(ws.slice(-12).map(x => ({ label: fmtDate(x.d, { day: 'numeric', month: 'short' }), value: x.w })), { min: Math.floor(Math.min(...ws.slice(-12).map(x => x.w))) - 1, max: Math.ceil(Math.max(...ws.slice(-12).map(x => x.w))) + 1, ticks: [Math.floor(Math.min(...ws.slice(-12).map(x => x.w))), Math.ceil(Math.max(...ws.slice(-12).map(x => x.w)))], color: 'var(--c-fitness)', labelEvery: Math.ceil(ws.slice(-12).length / 5), h: 170 }) : '<p class="muted">Log your weight in two or more weeks to see the trend.</p>'}
          ${logged ? `<div class="funnel"><span><b class="mono">${cnt('enough')}</b>Ate enough</span><span><b class="mono">${cnt('some')}</b>Skipped some</span><span><b class="mono">${cnt('little')}</b>Little / none</span></div><p class="small muted">Food days logged in the last 30: ${logged}</p>` : ''}</div></div>

      <div class="card"><div class="card-h"><h3>Weekly food timetable</h3><span class="muted small">tap a day to edit</span></div>
        <div class="week">${WEEK_ORDER.map(i => { const m = n.menu[i] || {}; return `<button class="wday ${i === dow(t) ? 'today' : ''}" data-act="editDay" data-d="${i}"><b>${DAYS[i]}</b><span><i>B</i>${esc(m.breakfast || '–')}</span><span><i>L</i>${esc(m.lunch || '–')}</span><span><i>D</i>${esc(m.dinner || '–')}</span><span><i>S</i>${esc(m.snack || '–')}</span></button>`; }).join('')}</div>
        <p class="small muted">Afternoon snack (every day): <button class="link" data-act="editPm">${esc(n.snackPm)}</button></p></div>

      <div class="dash">
        <div class="card"><div class="card-h"><h3>${icon('shopping-basket', 17)} Shopping list</h3><div class="btn-row" style="margin:0"><button class="btn sm" data-act="shopAdd">${icon('plus', 14)} Add</button><button class="btn sm ghost" data-act="shopReset">Reset</button></div></div>
          <div class="checks">${shop.map(x => `<div class="check ${x.bought ? 'done' : ''}"><button class="chk" data-act="shopTog" data-id="${x.id}" aria-label="Toggle ${esc(x.name)}">${icon('check', 14)}</button><span>${esc(x.name)}</span><input class="cost" type="number" min="0" step="50" inputmode="numeric" placeholder="₦" data-change="shopCost" data-id="${x.id}" value="${esc(x.cost)}" aria-label="Cost of ${esc(x.name)}"><button class="btn icon ghost" data-act="shopDel" data-id="${x.id}" aria-label="Remove">${icon('x', 14)}</button></div>`).join('')}</div>
          <div class="kv"><span>Bought so far</span><b class="mono">₦${boughtCost.toLocaleString()}</b></div>
          <ul class="bul small muted"><li>Buy beans and rice in larger quantities when you can.</li><li>Cook beans in batches for two or three days and portion them.</li><li>Refrigerate what you will not eat straight away.</li><li>Buy fresh vegetables in small amounts. Cook at home.</li></ul></div>
        <div class="stack">
          <div class="card"><div class="card-h"><h3>Habits that matter most</h3></div><ul class="bul"><li>Eat breakfast regularly and never go a whole day without food.</li><li>Put protein in main meals: beans, eggs, fish, groundnuts, moi moi.</li><li>Add vegetables and fruit, and drink clean water.</li><li>Sleep 7 to 9 hours. Weigh weekly under similar conditions.</li><li>Skip expensive supplements and mass gainers.</li></ul></div>
          <div class="card"><div class="card-h"><h3>${icon('alert-triangle', 17)} When to see a doctor</h3></div><p class="small">Unintended weight loss is not always about food. If you keep losing weight even when eating enough, get a medical assessment. Go promptly for any of these:</p>
            <ul class="bul small"><li>Persistent fever or night sweats</li><li>Diarrhoea that does not settle</li><li>Unusual tiredness or weakness</li><li>Loss of appetite or other unexplained symptoms</li></ul>
            <p class="small muted">Stop exercising and eat if you feel dizzy or faint. Keep workouts gentle until you are eating consistently.</p></div></div>
      </div>`;
  }

  const dayModal = i => {
    const m = N().menu[i] || {};
    formModal({
      title: `${DAYS[i]} menu`, html: [['breakfast', 'Breakfast'], ['lunch', 'Lunch'], ['dinner', 'Dinner'], ['snack', 'Snack']].map(([k, l]) => field(l, `<input name="${k}" maxlength="80" value="${esc(m[k] || '')}">`)).join(''),
      onSubmit: fd => store.update(s => { s.nutrition.menu[i] = { breakfast: fd.get('breakfast'), lunch: fd.get('lunch'), dinner: fd.get('dinner'), snack: fd.get('snack') }; }),
    });
  };

  bind(root, {
    setup: () => formModal({
      title: 'Set up your nutrition plan', submit: 'Apply plan',
      html: `<p class="muted">Choose what to apply. Nothing is deleted, and you can edit it all later.</p>
        ${switchEl('meals', true, 'Add 5 meal times to my routine (7:30, 10:30, 1:00, 4:30, 6:00) with reminders')}
        ${switchEl('workouts', true, 'Use my gentle home workout: full body Mon, Wed, Fri (8 push-ups, 10 squats, 15 s plank, lunges), recovery walk on other days, Thursday rest')}
        ${switchEl('weighin', true, 'Add a weekly weigh-in habit')}
        <p class="small muted">Your plan says to avoid intense exercise until you are eating consistently. The starter targets of 50 reps a day are replaced by these gentler ones.</p>`,
      onSubmit: fd => { applyPlan({ meals: fd.has('meals'), workouts: fd.has('workouts'), weighin: fd.has('weighin') }); toast('Nutrition plan set up. Your routine now includes meals.', { type: 'ok' }); },
    }),
    eat: el => toggleItem(el.dataset.id, t, el),
    access: el => store.update(s => { (s.nutrition.log[t] ||= {}).access = el.value; }),
    spend: el => store.update(s => { (s.nutrition.log[t] ||= {}).spend = el.value === '' ? '' : Math.max(0, +el.value); }),
    weight: el => store.update(s => { const l = (s.fit.log[t] ||= { sets: {}, note: '', weight: '' }); l.weight = el.value; }),
    height: el => store.update(s => { s.nutrition.height = el.value; }),
    editDay: el => dayModal(+el.dataset.d),
    editPm: () => formModal({ title: 'Afternoon snack', html: field('Every day', `<input name="v" maxlength="80" value="${esc(N().snackPm)}">`), onSubmit: fd => store.update(s => { s.nutrition.snackPm = fd.get('v'); }) }),
    shopTog: el => store.update(s => { const x = s.nutrition.shop.find(i => i.id === el.dataset.id); x.bought = !x.bought; }),
    shopCost: el => store.update(s => { s.nutrition.shop.find(i => i.id === el.dataset.id).cost = el.value; }),
    shopDel: el => store.update(s => { s.nutrition.shop = s.nutrition.shop.filter(i => i.id !== el.dataset.id); }),
    shopAdd: () => formModal({ title: 'Add to shopping list', html: field('Item', '<input name="v" required maxlength="50">'), onSubmit: fd => store.update(s => s.nutrition.shop.push({ id: uid(), name: fd.get('v'), bought: false, cost: '' })) }),
    shopReset: () => store.update(s => s.nutrition.shop.forEach(x => { x.bought = false; x.cost = ''; })),
  });
  const un = store.subscribe(draw); draw();
  return un;
}
