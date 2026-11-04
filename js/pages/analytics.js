import * as store from '../store.js';
import { CATS, CAT_KEYS, APP_STATUS } from '../store.js';
import { rangeStats, completion, score, catSeries, fitDay, activeHabits, habitDone, habitScheduled, appsIn, sessionMin, streak } from '../stats.js';
import { esc, today, addDays, addMonths, weekStart, monthStart, monthEnd, range, lastNDays, fmtDate, fmtMonth, hrs, pct, avg, sum, clamp, parse, download } from '../util.js';
import { icon, bind, tabs, pageHead, ring, empty, toast } from '../ui.js';
import { bars, area, heat, radar, hbar } from '../charts.js';

const catColor = k => `var(--c-${k})`;
const wkLabel = w => fmtDate(w, { day: 'numeric', month: 'short' });

function rateIn(h, dates) {
  const ds = dates.filter(d => d >= h.start && d <= today()); if (!ds.length) return null;
  if (h.freq === 'weekly') { const exp = (h.target * ds.length) / 7; return exp ? clamp(Math.round((ds.filter(d => habitDone(h, d)).length / exp) * 100), 0, 100) : null; }
  const sch = ds.filter(d => habitScheduled(h, d)); return sch.length ? pct(sch.filter(d => habitDone(h, d)).length, sch.length) : null;
}
const delta = (a, b, unit = ' pts') => (a === null || b === null ? '' : a === b ? 'no change' : `${a > b ? '▲' : '▼'} ${Math.abs(a - b)}${unit}`);

const ADVICE = {
  spiritual: 'Anchor prayer and Bible study to one fixed time and place, and protect the first 30 minutes of the day for them.',
  fitness: 'Pick three fixed training days, lay out your kit the night before, and log sets right after each exercise.',
  business: 'Block a 90-minute ThePrompt session before noon and decide one shippable outcome for each day.',
  career: 'Use a daily 60-minute application block, follow up on every lead older than three days, and rehearse one interview answer.',
  discipline: 'Fix wake-up and sleep times first. Everything else gets easier when those two are steady.',
};

export function buildReport(kind, anchor) {
  const s = store.get(), t = today();
  const start = kind === 'week' ? weekStart(anchor) : monthStart(anchor);
  const fullEnd = kind === 'week' ? addDays(start, 6) : monthEnd(anchor), end = fullEnd > t ? t : fullEnd;
  const dates = start > t ? [] : range(start, end), len = range(start, fullEnd).length;
  const pStart = kind === 'week' ? addDays(start, -7) : addMonths(start, -1), pDates = range(pStart, kind === 'week' ? addDays(pStart, 6) : monthEnd(pStart));
  const r = rangeStats(dates), p = rangeStats(pDates);
  const trained = dates.filter(d => fitDay(d).trained).length;
  const habits = activeHabits().map(h => ({ h, rate: rateIn(h, dates) })).filter(x => x.rate !== null).sort((a, b) => b.rate - a.rate);
  const apps = appsIn(dates).length, contacts = s.career.contacts.filter(c => dates.includes(c.date)).length;
  const learn = sessionMin(dates, 'learn'), focus = sessionMin(dates, 'focus');
  const cis = dates.filter(d => s.checkins[d]?.morning || s.checkins[d]?.evening).length, jr = dates.filter(d => s.journal[d] && Object.values(s.journal[d]).some(v => typeof v === 'string' && v.trim())).length;
  const nl = s.nutrition?.log || {}, nd = dates.filter(d => nl[d]?.access), tight = nd.filter(d => nl[d].access !== 'enough').length;
  const title = kind === 'week' ? `Weekly report · ${fmtDate(start, { day: 'numeric', month: 'short' })} – ${fmtDate(fullEnd, { day: 'numeric', month: 'short', year: 'numeric' })}` : `Monthly report · ${fmtMonth(start)}`;
  const rows = [
    ['Completion rate', r.comp === null ? '–' : r.comp + '%', delta(r.comp, p.comp)],
    ['Average discipline score', r.avgScore ?? '–', delta(r.avgScore, p.avgScore)],
    ['Best day', r.best ? `${fmtDate(r.best.date)} (${r.best.score})` : '–', ''],
    ['Weakest category', r.weakest ? `${CATS[r.weakest].label} (${r.catPct[r.weakest]}%)` : '–', ''],
    ['Workout days', `${trained} of ${dates.length}`, ''],
    ['Applications sent', apps, ''], ['Companies contacted', contacts, ''],
    ['Learning hours', hrs(learn), ''], ['Focus hours', hrs(focus), ''],
    ...(nd.length ? [['Days you ate enough', `${nd.length - tight} of ${nd.length} logged`, '']] : []),
    ['Check-in days', `${cis} of ${dates.length}`, ''], ['Journal days', jr, ''],
  ];
  const hi = [];
  if (r.comp !== null) hi.push(`You completed ${r.done} of ${r.planned} planned activities (${r.comp}%)${p.comp !== null ? `, ${r.comp >= p.comp ? 'up' : 'down'} ${Math.abs(r.comp - p.comp)} points on the previous ${kind}` : ''}.`);
  const strong = CAT_KEYS.filter(k => r.catPct[k] !== null).sort((a, b) => r.catPct[b] - r.catPct[a])[0];
  if (strong) hi.push(`Strongest area: ${CATS[strong].label} at ${r.catPct[strong]}%.`);
  if (r.weakest && r.weakest !== strong) hi.push(`Weakest area: ${CATS[r.weakest].label} at ${r.catPct[r.weakest]}%.`);
  if (dates.length) hi.push(`You trained on ${trained} of ${dates.length} days.`);
  if (habits[0]) hi.push(`Most consistent habit: ${habits[0].h.name} (${habits[0].rate}%).${habits.length > 1 ? ` Needs attention: ${habits.at(-1).h.name} (${habits.at(-1).rate}%).` : ''}`);
  hi.push(`Career: ${apps} application${apps === 1 ? '' : 's'}, ${contacts} outreach contact${contacts === 1 ? '' : 's'}, ${hrs(learn)}h learning, ${hrs(focus)}h deep focus.`);
  const sg = [];
  if (r.weakest) sg.push(ADVICE[r.weakest]);
  const perWeek = kind === 'week' ? 1 : 4.3;
  if (dates.length >= 3 && trained < 3 * perWeek * Math.min(1, dates.length / len)) sg.push('Aim for at least three workout days a week. Even a 10-minute session keeps the streak alive.');
  if (apps < (s.settings.weeklyApps || 5) * perWeek * Math.min(1, dates.length / len)) sg.push(`Your target is ${s.settings.weeklyApps || 5} applications a week. Block a fixed daily hour to close the gap.`);
  if (tight >= 2) sg.push(`Food was tight on ${tight} logged days. Cook beans in batches and keep eggs or groundnuts as a backup so no day passes without a proper meal.`);
  if (!jr && dates.length) sg.push('Write three lines in your journal each evening: one win, one lesson, one thing to be grateful for.');
  if (r.comp !== null && r.comp < 50) sg.push('Your plan may be too heavy. Cut it to the five most important activities, win those for a week, then add back.');
  if (r.comp !== null && r.comp >= 80) sg.push('Strong consistency. Raise the bar: add one critical activity or increase a workout target.');
  const md = `# ${title}\n\n${rows.map(([a, b, c]) => `- **${a}:** ${b}${c ? ` (${c})` : ''}`).join('\n')}\n\n## Highlights\n${hi.map(x => `- ${x}`).join('\n')}\n\n## Focus for next ${kind}\n${sg.map(x => `- ${x}`).join('\n') || '- Keep going.'}\n`;
  return { title, rows, hi, sg, md, empty: !dates.length || r.comp === null };
}

export default function analytics(root) {
  const st = { range: 30, rk: 'week', anchor: today() };

  function draw() {
    const s = store.get(), t = today(), n = st.range, days = lastNDays(n), prevDays = lastNDays(n, addDays(t, -n));
    const r = rangeStats(days), p = rangeStats(prevDays), d7 = rangeStats(lastNDays(7)), d30 = rangeStats(lastNDays(30)), tc = completion(t), ts = score(t);
    const started = d => d !== t || completion(d).done > 0; // an unstarted today is not a zero-day yet
    const series = days.map((d, i) => ({ label: n <= 7 ? fmtDate(d, { weekday: 'short' }) : String(parse(d).getDate()), value: started(d) ? score(d).score : null, title: `${fmtDate(d)}: score ${score(d).score ?? '–'}` }));
    const comps = days.map(d => ({ label: n <= 7 ? fmtDate(d, { weekday: 'short' }) : String(parse(d).getDate()), value: started(d) ? completion(d).pct : null, title: `${fmtDate(d)}: ${completion(d).pct ?? '–'}% complete` }));
    const le = n <= 7 ? 1 : n <= 30 ? 5 : 10;
    const wk0 = weekStart(t), weeks = Array.from({ length: 8 }, (_, i) => addDays(wk0, -7 * (7 - i))), wRange = w => range(w, addDays(w, 6));
    const wkWorkouts = weeks.map(w => ({ label: wkLabel(w), value: wRange(w).filter(d => d <= t && fitDay(d).trained).length }));
    const wkBusiness = weeks.map(w => { const c = rangeStats(wRange(w)).catPct.business; return { label: wkLabel(w), value: c }; });
    const wkApps = weeks.map(w => ({ label: wkLabel(w), value: appsIn(wRange(w)).length }));
    const wkLearn = weeks.map(w => ({ label: wkLabel(w), value: Math.round((sessionMin(wRange(w), 'learn') / 60) * 10) / 10 }));
    const wkFocus = weeks.map(w => ({ label: wkLabel(w), value: Math.round((sessionMin(wRange(w), 'focus') / 60) * 10) / 10 }));
    const hStart = addDays(wk0, -77), heatCells = range(hStart, addDays(hStart, 83)).map(d => ({ date: d, value: d > t ? null : score(d).score }));
    const habits = activeHabits().map(h => ({ h, rate: rateIn(h, days) })).filter(x => x.rate !== null).sort((a, b) => b.rate - a.rate);
    const spirit = catSeries('spiritual', days).map(x => ({ label: String(parse(x.date).getDate()), value: started(x.date) ? x.value : null, title: `${fmtDate(x.date)}: ${x.value ?? '–'}%` }));
    const spVals = spirit.map(x => x.value).filter(v => v !== null);
    const maxOf = a => Math.max(4, Math.ceil(Math.max(0, ...a.map(x => x.value || 0))));
    const tk = m => [0, Math.round(m / 2), m];
    const funnel = APP_STATUS.map(k => [k, s.career.apps.filter(a => a.status === k).length]);
    const rep = buildReport(st.rk, st.anchor);
    const canNext = st.rk === 'week' ? addDays(weekStart(st.anchor), 7) <= t : addMonths(st.anchor, 1) <= t;

    root.innerHTML = `${pageHead('Analytics & Reports', 'Everything Mode knows about your discipline, in one place.')}
      <div class="grid g4 stats">
        <div class="card stat"><div class="eyebrow mono">Daily completion</div>${ring({ value: tc.pct, size: 96, stroke: 9 })}<small class="muted">${tc.done}/${tc.total} today</small></div>
        <div class="card stat"><div class="eyebrow mono">Weekly completion</div>${ring({ value: d7.comp, size: 96, stroke: 9 })}<small class="muted">last 7 days</small></div>
        <div class="card stat"><div class="eyebrow mono">Monthly completion</div>${ring({ value: d30.comp, size: 96, stroke: 9 })}<small class="muted">last 30 days</small></div>
        <div class="card stat"><div class="eyebrow mono">Current streak</div><div class="bignum mono">${icon('flame', 22)}${streak()}<small>days</small></div></div></div>
      <div class="card"><div class="card-h"><h3>${icon('shield-check', 18)} Discipline scoring</h3><button class="link" data-act="how">How it works</button></div>
        <div class="grid g5 kpis"><div class="kpi"><small>Daily score</small><b class="mono">${ts.score ?? '–'}</b></div><div class="kpi"><small>Weekly average</small><b class="mono">${d7.avgScore ?? '–'}</b></div><div class="kpi"><small>Monthly average</small><b class="mono">${d30.avgScore ?? '–'}</b></div>
          <div class="kpi"><small>Best day (30d)</small><b class="mono">${d30.best ? d30.best.score : '–'}</b><em>${d30.best ? esc(fmtDate(d30.best.date)) : ''}</em></div><div class="kpi"><small>Weakest category</small><b>${d30.weakest ? esc(CATS[d30.weakest].short) : '–'}</b><em>${d30.weakest ? d30.catPct[d30.weakest] + '%' : ''}</em></div></div></div>
      ${tabs([[7, 'Last 7 days'], [30, 'Last 30 days'], [90, 'Last 90 days']], st.range, 'range')}<div class="gap"></div>
      <div class="grid g2"><div class="card"><div class="card-h"><h3>Discipline score</h3><span class="muted small">avg <b class="mono">${r.avgScore ?? '–'}</b> ${p.avgScore !== null ? `<em class="delta">${delta(r.avgScore, p.avgScore)}</em>` : ''}</span></div>${area(series, { labelEvery: le, h: 200 })}</div>
        <div class="card"><div class="card-h"><h3>Daily completion rate</h3><span class="muted small">avg <b class="mono">${r.comp ?? '–'}%</b></span></div>${area(comps, { labelEvery: le, h: 200, color: 'var(--c-fitness)' })}</div>
        <div class="card"><div class="card-h"><h3>Balance across your life</h3></div><div class="radar-wrap">${radar(CAT_KEYS.map(k => ({ label: CATS[k].short, value: r.catPct[k] || 0 })))}<div class="cat-bars">${CAT_KEYS.map(k => hbar(CATS[k].label, r.catPct[k], { color: catColor(k), sub: `weight ${s.settings.weights[k]}%` })).join('')}</div></div></div>
        <div class="card"><div class="card-h"><h3>Score heatmap</h3><span class="muted small">last 12 weeks</span></div>${heat(heatCells)}</div>
        <div class="card"><div class="card-h"><h3>${icon('dumbbell', 17)} Workout frequency</h3><span class="muted small">${days.filter(d => fitDay(d).trained).length} workout days in range</span></div>${bars(wkWorkouts, { max: 7, ticks: [0, 3, 7], hi: 7, color: 'var(--c-fitness)', fmt: v => v })}<p class="small muted">Training days per week, last 8 weeks.</p></div>
        <div class="card"><div class="card-h"><h3>${icon('repeat', 17)} Habit consistency</h3><span class="muted small">${n}-day completion</span></div>${habits.length ? habits.map(x => hbar(x.h.name, x.rate, { color: catColor(x.h.cat) })).join('') : '<p class="muted">No habits tracked in this range.</p>'}</div>
        <div class="card"><div class="card-h"><h3>${icon('sparkles', 17)} Spiritual routine</h3><span class="muted small">avg <b class="mono">${spVals.length ? Math.round(avg(spVals)) : '–'}%</b></span></div>${area(spirit, { labelEvery: le, h: 190, color: 'var(--c-spiritual)' })}</div>
        <div class="card"><div class="card-h"><h3>${icon('rocket', 17)} Business activity</h3><span class="muted small">${hrs(sessionMin(days, 'focus'))}h focus in range</span></div>${bars(wkBusiness, { hi: 7, color: 'var(--c-business)', fmt: v => v + '%', values: false })}<p class="small muted">Business plan completion per week.</p></div>
        <div class="card"><div class="card-h"><h3>${icon('briefcase', 17)} Career progress</h3><span class="muted small">${appsIn(days).length} applications in range</span></div>${bars(wkApps, { max: maxOf(wkApps), ticks: tk(maxOf(wkApps)), hi: 7, color: 'var(--c-career)', fmt: v => v })}
          <div class="funnel">${funnel.map(([k, c]) => `<span><b class="mono">${c}</b>${esc(k)}</span>`).join('')}</div></div>
        <div class="card"><div class="card-h"><h3>${icon('graduation-cap', 17)} Learning hours</h3><span class="muted small">${hrs(sessionMin(days, 'learn'))}h in range</span></div>${bars(wkLearn, { max: maxOf(wkLearn), ticks: tk(maxOf(wkLearn)), hi: 7, color: 'var(--accent)', fmt: v => v })}</div>
        <div class="card"><div class="card-h"><h3>${icon('zap', 17)} Focus hours</h3><span class="muted small">${hrs(sessionMin(days, 'focus'))}h in range</span></div>${bars(wkFocus, { max: maxOf(wkFocus), ticks: tk(maxOf(wkFocus)), hi: 7, color: 'var(--accent-2)', fmt: v => v })}</div>
      </div>
      <div class="card" id="report"><div class="card-h no-print"><h3>${icon('list-checks', 18)} Reports</h3>${tabs([['week', 'Weekly'], ['month', 'Monthly']], st.rk, 'rk')}</div>
        <div class="date-nav inner no-print"><button class="btn icon ghost" data-act="rprev" aria-label="Previous period">${icon('chevron-left', 18)}</button><div class="dn-mid"><b>${esc(rep.title.split(' · ')[1])}</b></div><button class="btn icon ghost" data-act="rnext" aria-label="Next period" ${canNext ? '' : 'disabled'}>${icon('chevron-right', 18)}</button></div>
        <h2 class="print-only">${esc(rep.title)}</h2>
        ${rep.empty ? empty('No data for this period', 'Complete some activities and your report will appear here.') : `<div class="tbl-wrap"><table class="tbl rep"><tbody>${rep.rows.map(([a, b, c]) => `<tr><td>${esc(a)}</td><td class="mono"><b>${esc(b)}</b></td><td class="muted small">${esc(c)}</td></tr>`).join('')}</tbody></table></div>
        <div class="grid g2"><div><h4>Highlights</h4><ul class="bul">${rep.hi.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div><div><h4>Focus for next ${st.rk}</h4><ul class="bul">${rep.sg.map(x => `<li>${esc(x)}</li>`).join('') || '<li>Keep going.</li>'}</ul></div></div>
        <div class="btn-row no-print"><button class="btn" data-act="copy">${icon('copy', 15)} Copy</button><button class="btn" data-act="md">${icon('download', 15)} Download .md</button><button class="btn" data-act="print">${icon('printer', 15)} Print / Save PDF</button></div>`}</div>`;
  }

  bind(root, {
    range: el => { st.range = +el.dataset.v; draw(); }, rk: el => { st.rk = el.dataset.v; st.anchor = today(); draw(); },
    rprev: () => { st.anchor = st.rk === 'week' ? addDays(st.anchor, -7) : addMonths(st.anchor, -1); draw(); },
    rnext: () => { st.anchor = st.rk === 'week' ? addDays(st.anchor, 7) : addMonths(st.anchor, 1); if (st.anchor > today()) st.anchor = today(); draw(); },
    how: async () => { const { openBreakdown } = await import('../acts.js'); openBreakdown(today()); },
    copy: async () => { try { await navigator.clipboard.writeText(buildReport(st.rk, st.anchor).md); toast('Report copied', { type: 'ok' }); } catch { toast('Copy blocked by the browser. Use Download instead.', { type: 'warn' }); } },
    md: () => download(`mode-${st.rk}-report-${st.anchor}.md`, buildReport(st.rk, st.anchor).md, 'text/markdown'),
    print: () => { document.body.classList.add('printing'); setTimeout(() => { window.print(); document.body.classList.remove('printing'); }, 50); },
  });
  const un = store.subscribe(draw); draw();
  return un;
}
