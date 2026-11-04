// Motion layer: 3D DNA helix, matrix rain, tilt cards, count-up, particle bursts, boot sequence.
// One shared requestAnimationFrame loop; canvases pause when off-screen, hidden, or motion is off.
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let enabled = !reduce;
const C = { a: '#ffffff', b: '#6cb4ff', dim: 'rgba(160,200,255,.4)' };
const HERO = { a: '#ffffff', b: '#6cb4ff', dim: 'rgba(150,195,255,.45)' }; // hero + splash are always navy
const anims = new Set();
let raf = 0;

export const motionOn = () => enabled;
export function setMotion(on) {
  enabled = !!on && !reduce;
  document.documentElement.dataset.motion = enabled ? 'on' : 'off';
  enabled ? start() : stop();
}
export function readColors() {
  const cs = getComputedStyle(document.documentElement);
  C.a = cs.getPropertyValue('--fx-a').trim() || C.a;
  C.b = cs.getPropertyValue('--fx-b').trim() || C.b;
  C.dim = cs.getPropertyValue('--fx-dim').trim() || C.dim;
}

function frame(t) {
  raf = requestAnimationFrame(frame);
  for (const a of anims) if (a.visible) a.tick(t);
}
function start() { if (!raf && enabled && anims.size && !document.hidden) raf = requestAnimationFrame(frame); }
function stop() { cancelAnimationFrame(raf); raf = 0; }
document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

function anim(canvas, draw, { once = false } = {}) {
  const ctx = canvas.getContext('2d');
  const a = { visible: true, w: 0, h: 0, dpr: 1, ctx };
  const size = () => {
    const r = canvas.getBoundingClientRect();
    a.dpr = Math.min(devicePixelRatio || 1, 2);
    a.w = Math.max(1, r.width); a.h = Math.max(1, r.height);
    canvas.width = a.w * a.dpr; canvas.height = a.h * a.dpr;
    ctx.setTransform(a.dpr, 0, 0, a.dpr, 0, 0);
    a.init?.(a);
    if (!enabled || once) draw(ctx, a, 0, true); // static frame when motion is off
  };
  a.tick = t => draw(ctx, a, t, false);
  const ro = new ResizeObserver(size); ro.observe(canvas);
  const io = new IntersectionObserver(([e]) => { a.visible = e.isIntersecting; }); io.observe(canvas);
  anims.add(a); size(); start();
  return { stop() { anims.delete(a); ro.disconnect(); io.disconnect(); }, redraw() { size(); } };
}

/* ---------- 3D DNA double helix ---------- */
export function helix(canvas, { nodes = 34, turns = 2.6, tilt = -0.5, speed = 0.00055, fixed = true } = {}) {
  const P = fixed ? HERO : C;
  return anim(canvas, (ctx, a, t) => {
    const { w, h } = a;
    ctx.clearRect(0, 0, w, h);
    ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(tilt);
    const L = Math.hypot(w, h) * 1.02, R = Math.min(w, h) * 0.24, ph = t * speed, items = [];
    const pts = [[], []];
    for (let i = 0; i < nodes; i++) {
      const u = i / (nodes - 1), y = (u - 0.5) * L, ang = u * turns * Math.PI * 2 + ph;
      for (let s = 0; s < 2; s++) {
        const aa = ang + s * Math.PI, z = Math.sin(aa), ps = 1 + z * 0.3;
        pts[s].push({ x: Math.cos(aa) * R * ps, y, z, ps });
      }
    }
    for (let i = 0; i < nodes; i++) {
      const p0 = pts[0][i], p1 = pts[1][i];
      items.push({ z: (p0.z + p1.z) / 2 - 0.01, d: () => {
        ctx.strokeStyle = P.dim; ctx.lineWidth = 1.4; ctx.globalAlpha = 0.5;
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
        if (i % 3 === 1 && w > 260) { ctx.globalAlpha = 0.55; ctx.fillStyle = P.a; ctx.font = '600 9px JetBrains Mono, monospace'; ctx.textAlign = 'center'; ctx.fillText('ATGC'[(i * 7) % 4], (p0.x + p1.x) / 2, p0.y + 3); }
      } });
      for (let s = 0; s < 2; s++) {
        const p = pts[s][i], n = pts[s][i + 1], col = s ? P.b : P.a;
        if (n) items.push({ z: (p.z + n.z) / 2, d: () => { ctx.globalAlpha = 0.35 + 0.55 * ((p.z + n.z) / 2 + 1) / 2; ctx.strokeStyle = col; ctx.lineWidth = 2.4 * p.ps; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(n.x, n.y); ctx.stroke(); } });
        items.push({ z: p.z, d: () => {
          const al = 0.4 + 0.6 * (p.z + 1) / 2;
          ctx.fillStyle = col; ctx.globalAlpha = al * 0.18; ctx.beginPath(); ctx.arc(p.x, p.y, 8 * p.ps, 0, 6.3); ctx.fill();
          ctx.globalAlpha = al; ctx.beginPath(); ctx.arc(p.x, p.y, 3.6 * p.ps, 0, 6.3); ctx.fill();
        } });
      }
    }
    items.sort((x, y) => x.z - y.z).forEach(i => i.d());
    ctx.restore(); ctx.globalAlpha = 1;
  });
}

/* ---------- Matrix rain ---------- */
const GLYPHS = '01ATGC<>{}[]$;=/+*#&%'.split('');
export function matrix(canvas, { size = 14, fps = 22, fade = 0.1, head = 0.95, fixed = true } = {}) {
  const P = fixed ? HERO : C;
  let cols = [], last = 0;
  const h = anim(canvas, (ctx, a, t, still) => {
    if (still) { ctx.clearRect(0, 0, a.w, a.h); return; }
    if (t - last < 1000 / fps) return; last = t;
    ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = `rgba(0,0,0,${fade})`; ctx.fillRect(0, 0, a.w, a.h);
    ctx.globalCompositeOperation = 'source-over'; ctx.font = `${size}px JetBrains Mono, monospace`; ctx.textAlign = 'left';
    for (let i = 0; i < cols.length; i++) {
      const y = cols[i] * size;
      ctx.fillStyle = P.b; ctx.globalAlpha = 0.9; ctx.fillText(GLYPHS[(Math.random() * GLYPHS.length) | 0], i * size, y);
      ctx.fillStyle = P.a; ctx.globalAlpha = head; ctx.fillText(GLYPHS[(Math.random() * GLYPHS.length) | 0], i * size, y + size);
      ctx.globalAlpha = 1;
      if (y > a.h && Math.random() > 0.965) cols[i] = -Math.random() * 20; else cols[i] += 1;
    }
  });
  // column state must be (re)built after resize
  const re = new ResizeObserver(() => { const w = canvas.getBoundingClientRect().width; cols = Array.from({ length: Math.ceil(w / size) }, () => -Math.random() * 40); });
  re.observe(canvas);
  return { stop() { h.stop(); re.disconnect(); } };
}

/* ---------- 3D tilt cards ---------- */
export function initTilt() {
  if (!matchMedia('(hover:hover) and (pointer:fine)').matches) return;
  let cur = null, pend = 0;
  const reset = el => { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); el.classList.remove('tilting'); };
  document.addEventListener('pointermove', e => {
    const t = e.target.closest?.('[data-tilt]');
    if (cur && cur !== t) reset(cur);
    cur = t;
    if (!t || !enabled || pend) return;
    pend = requestAnimationFrame(() => {
      pend = 0;
      const r = t.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      t.style.setProperty('--ry', ((px - 0.5) * 9).toFixed(2) + 'deg'); t.style.setProperty('--rx', ((0.5 - py) * 7).toFixed(2) + 'deg');
      t.style.setProperty('--gx', (px * 100).toFixed(0) + '%'); t.style.setProperty('--gy', (py * 100).toFixed(0) + '%');
      t.classList.add('tilting');
    });
  }, { passive: true });
  document.addEventListener('pointerleave', () => cur && reset(cur), true);
}

/* ---------- Count-up numbers ---------- */
export function countUp(root = document) {
  if (!enabled) return;
  root.querySelectorAll('[data-count]').forEach(el => {
    const to = +el.dataset.count; if (!isFinite(to) || el.dataset.counted) return;
    el.dataset.counted = 1; const suffix = el.dataset.suffix || '', t0 = performance.now(), dur = 750;
    const step = now => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(to * e) + suffix; if (k < 1) requestAnimationFrame(step); };
    el.textContent = '0' + suffix; requestAnimationFrame(step);
  });
}

/* ---------- Particle bursts (binary confetti) ---------- */
let burstCv = null, bursting = false; const parts = [];
export function burst(x, y, { big = false } = {}) {
  if (!enabled) return;
  if (!burstCv) { burstCv = document.createElement('canvas'); burstCv.className = 'burst'; document.body.append(burstCv); }
  const dpr = Math.min(devicePixelRatio || 1, 2);
  burstCv.width = innerWidth * dpr; burstCv.height = innerHeight * dpr;
  const n = big ? 90 : 22;
  for (let i = 0; i < n; i++) {
    const a = big ? Math.random() * 6.28 : -Math.PI / 2 + (Math.random() - 0.5) * 2.2, v = (big ? 4 + Math.random() * 7 : 2 + Math.random() * 4);
    parts.push({ x: big ? innerWidth / 2 : x, y: big ? innerHeight / 3 : y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, ch: GLYPHS[(Math.random() * 6) | 0], c: Math.random() > 0.5 ? C.a : C.b, s: 10 + Math.random() * 8 });
  }
  if (bursting) return; bursting = true;
  const ctx = burstCv.getContext('2d');
  const loop = () => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life -= 0.016;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.c; ctx.font = `700 ${p.s}px JetBrains Mono, monospace`; ctx.fillText(p.ch, p.x, p.y);
    }
    if (parts.length) requestAnimationFrame(loop); else { bursting = false; ctx.clearRect(0, 0, innerWidth, innerHeight); }
  };
  requestAnimationFrame(loop);
}

/* ---------- Boot splash ---------- */
export function boot(name, { quick = false } = {}) {
  const el = document.getElementById('splash'); if (!el) return { done: Promise.resolve() };
  const pre = document.getElementById('boot'), cv = document.getElementById('splash-fx');
  let mx;
  if (!quick && enabled) { readColors(); mx = matrix(cv, { size: 16, fps: 28, fade: 0.09 }); }
  const lines = ['> mode --init', '> loading modules ............ ok', '> syncing discipline engine ... ok', `> welcome${name ? ', ' + name : ''}_`];
  let i = 0, stopped = false;
  const type = () => {
    if (stopped || i >= lines.length) return;
    pre.textContent += (i ? '\n' : '') + lines[i++]; setTimeout(type, quick ? 0 : 230);
  };
  type();
  const hide = () => { stopped = true; el.classList.add('out'); setTimeout(() => { el.remove(); mx?.stop(); }, 500); };
  el.addEventListener('click', hide);
  return { hide };
}
