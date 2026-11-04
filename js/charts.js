// Tiny dependency-free SVG charts. Every function returns an HTML string. Colors come from CSS variables.
import { esc, parse, pad } from './util.js';

const reg = new Map(); let seq = 0;
const wrap = svg => svg;
const make = (fn, data, opts = {}) => { const id = ++seq; reg.set(id, { fn, data, opts }); return `<div class="chart" data-cid="${id}">${fn(data, opts)}</div>`; };
/** Re-render every chart at its real pixel width so text stays 1:1 and crisp on any screen. */
export function hydrate(root = document) {
  const live = new Set();
  root.querySelectorAll('.chart[data-cid]').forEach(el => {
    const id = +el.dataset.cid; live.add(id);
    const r = reg.get(id), w = Math.round(el.clientWidth);
    if (!r || w < 160 || +el.dataset.w === w) return;
    el.dataset.w = w; el.innerHTML = r.fn(r.data, { ...r.opts, w });
  });
  if (reg.size > 400) for (const k of reg.keys()) if (!live.has(k)) reg.delete(k);
}

function barsSvg(data, { w = 480, h = 190, max = 100, hi = -1, ticks = [0, 50, 100], fmt = v => v, labelEvery = 1, color = 'var(--accent)', values = true } = {}) {
  const pl = 30, pr = 6, pt = 14, pb = 24, iw = w - pl - pr, ih = h - pt - pb, step = iw / Math.max(1, data.length);
  const bw = Math.min(34, step * 0.6);
  const y = v => pt + ih - (Math.min(v, max) / max) * ih;
  let s = `<svg viewBox="0 0 ${w} ${h}" role="img">`;
  for (const t of ticks) s += `<line x1="${pl}" x2="${w - pr}" y1="${y(t)}" y2="${y(t)}" class="gl"/><text x="${pl - 6}" y="${y(t) + 3.5}" class="ax" text-anchor="end">${fmt(t)}</text>`;
  data.forEach((d, i) => {
    const x = pl + step * i + (step - bw) / 2, v = d.value;
    if (v === null || v === undefined) { s += `<rect x="${x}" y="${y(0) - 3}" width="${bw}" height="3" rx="1.5" class="nil"/>`; }
    else {
      const bh = Math.max(2, ih - (y(v) - pt));
      s += `<rect x="${x}" y="${y(v)}" width="${bw}" height="${bh}" rx="${Math.min(7, bw / 3)}" fill="${d.color || color}" class="bar ${i === hi ? 'hi' : ''}" style="animation-delay:${i * 28}ms"><title>${esc(d.title || `${d.label}: ${fmt(v)}`)}</title></rect>`;
      if (values && data.length <= 14 && v > 0) s += `<text x="${x + bw / 2}" y="${y(v) - 5}" class="vl" text-anchor="middle">${fmt(Math.round(v * 10) / 10)}</text>`;
    }
    if (i % labelEvery === 0) s += `<text x="${x + bw / 2}" y="${h - 7}" class="ax ${i === hi ? 'hi' : ''}" text-anchor="middle">${esc(d.label)}</text>`;
  });
  return s + '</svg>';
}

function areaSvg(data, { w = 560, h = 190, min = 0, max = 100, ticks = [0, 50, 100], color = 'var(--accent)', labelEvery = 5, id = 'a' + Math.random().toString(36).slice(2, 6), fmt = v => v } = {}) {
  const pl = 30, pr = 10, pt = 12, pb = 24, iw = w - pl - pr, ih = h - pt - pb;
  const n = data.length, x = i => pl + (n === 1 ? iw / 2 : (iw * i) / (n - 1)), y = v => pt + ih - ((Math.min(Math.max(v, min), max) - min) / (max - min || 1)) * ih;
  let s = `<svg viewBox="0 0 ${w} ${h}" role="img"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".35"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>`;
  for (const t of ticks) s += `<line x1="${pl}" x2="${w - pr}" y1="${y(t)}" y2="${y(t)}" class="gl"/><text x="${pl - 6}" y="${y(t) + 3.5}" class="ax" text-anchor="end">${fmt(t)}</text>`;
  const segs = []; let cur = [];
  data.forEach((d, i) => { if (d.value === null || d.value === undefined) { if (cur.length) segs.push(cur); cur = []; } else cur.push([x(i), y(d.value)]); });
  if (cur.length) segs.push(cur);
  for (const seg of segs) {
    const line = seg.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('');
    if (seg.length > 1) s += `<path d="${line}L${seg.at(-1)[0].toFixed(1)} ${y(min)}L${seg[0][0].toFixed(1)} ${y(min)}Z" fill="url(#${id})"/>`;
    s += `<path d="${line}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="draw"/>`;
  }
  data.forEach((d, i) => {
    if (d.value !== null && d.value !== undefined && n <= 40) s += `<circle cx="${x(i)}" cy="${y(d.value)}" r="${n <= 14 ? 3.4 : 2.2}" fill="${color}"><title>${esc(d.title || `${d.label}: ${fmt(d.value)}`)}</title></circle>`;
    if (i % labelEvery === 0) s += `<text x="${x(i)}" y="${h - 7}" class="ax" text-anchor="middle">${esc(d.label)}</text>`;
  });
  return s + '</svg>';
}

/** GitHub-style heat calendar. cells: [{date, value|null}] ordered by date, starting on a Monday. */
function heatSvg(cells, { w: W = 420, gap = 4 } = {}) {
  const weeks = Math.ceil(cells.length / 7), cell = Math.max(10, Math.min(26, Math.floor((W - 26) / weeks) - gap)), w = 26 + weeks * (cell + gap), h = 20 + 7 * (cell + gap);
  let s = `<svg viewBox="0 0 ${w} ${h}" role="img">`;
  ['M', '', 'W', '', 'F', '', 'S'].forEach((l, i) => { if (l) s += `<text x="0" y="${20 + i * (cell + gap) + cell - 3}" class="ax">${l}</text>`; });
  let lastMonth = -1;
  cells.forEach((c, i) => {
    const wk = Math.floor(i / 7), r = i % 7, x = 22 + wk * (cell + gap), y = 20 + r * (cell + gap);
    const m = parse(c.date).getMonth();
    if (r === 0 && m !== lastMonth) { s += `<text x="${x}" y="11" class="ax">${parse(c.date).toLocaleDateString(undefined, { month: 'short' })}</text>`; lastMonth = m; }
    const v = c.value;
    s += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="4" ${v === null || v === undefined ? 'class="nil"' : `fill="var(--accent)" fill-opacity="${(0.14 + 0.86 * (v / 100)).toFixed(2)}"`}><title>${esc(c.date)}: ${v === null || v === undefined ? 'no plan' : v + '%'}</title></rect>`;
  });
  return s + '</svg>';
}

export function radar(axes, { size = 260 } = {}) {
  const c = size / 2, R = size / 2 - 38, n = axes.length;
  const pt = (i, r) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; return [c + r * Math.cos(a), c + r * Math.sin(a)]; };
  let s = `<svg viewBox="0 0 ${size} ${size}" role="img" class="radar">`;
  for (const f of [0.25, 0.5, 0.75, 1]) s += `<polygon points="${axes.map((_, i) => pt(i, R * f).join(',')).join(' ')}" class="gl" fill="none"/>`;
  axes.forEach((_, i) => { const [x, y] = pt(i, R); s += `<line x1="${c}" y1="${c}" x2="${x}" y2="${y}" class="gl"/>`; });
  s += `<polygon points="${axes.map((a, i) => pt(i, (R * (a.value || 0)) / 100).join(',')).join(' ')}" fill="var(--accent)" fill-opacity=".22" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" class="pop"/>`;
  axes.forEach((a, i) => {
    const [x, y] = pt(i, R + 18), [px, py] = pt(i, (R * (a.value || 0)) / 100);
    s += `<circle cx="${px}" cy="${py}" r="3.4" fill="var(--accent)"/><text x="${x}" y="${y + 3.5}" class="ax" text-anchor="middle">${esc(a.label)}</text>`;
  });
  return s + '</svg>';
}

export function spark(values, { w = 90, h = 28 } = {}) {
  const v = values.map(x => x ?? 0), max = Math.max(1, ...v);
  const pts = v.map((x, i) => `${((i / Math.max(1, v.length - 1)) * (w - 4) + 2).toFixed(1)},${(h - 3 - (x / max) * (h - 6)).toFixed(1)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

export function dots(states) { // habit last-N dots
  return `<span class="dots">${states.map(s => `<i class="d ${s}"></i>`).join('')}</span>`;
}

export const hbar = (label, value, { color = 'var(--accent)', suffix = '%', sub = '' } = {}) =>
  `<div class="hb"><div class="hb-l"><span>${esc(label)}</span><b>${value === null ? '–' : value + suffix}</b></div><div class="hb-t"><i style="width:${value === null ? 0 : Math.min(100, value)}%;background:${color}"></i></div>${sub ? `<small class="muted">${esc(sub)}</small>` : ''}</div>`;

export const monthLabel = d => `${pad(parse(d).getDate())}`;

export const bars = (d, o) => make(barsSvg, d, o);
export const area = (d, o) => make(areaSvg, d, o);
export const heat = (d, o) => make(heatSvg, d, o);
