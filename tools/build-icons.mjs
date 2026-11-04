// Generates js/icons.js from lucide-static (dev-time only). Usage: node tools/build-icons.mjs <path-to-lucide-static/icons>
import fs from 'node:fs';
const dir = process.argv[2];
const names = ['layout-dashboard','calendar-clock','sun-moon','dumbbell','repeat','briefcase','target','bar-chart-3','book-open','settings','plus','check','x','trash-2','pencil','bell','flame','clock','sunrise','moon','sparkles','rocket','trending-up','download','upload','chevron-left','chevron-right','calendar','timer','play','square','rotate-ccw','search','more-horizontal','arrow-right','star','heart','brain','zap','shield-check','copy','printer','link','mail','phone','user','building-2','graduation-cap','activity','sun','smartphone','check-circle-2','alert-triangle','info','wifi-off','menu','lock','award','list-checks','book-marked'];
const out = {};
for (const n of names) {
  const f = `${dir}/${n}.svg`;
  if (!fs.existsSync(f)) { console.error('missing', n); continue; }
  const svg = fs.readFileSync(f, 'utf8');
  out[n] = svg.replace(/<svg[^>]*>/, '').replace('</svg>', '').replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ').trim();
}
fs.writeFileSync('js/icons.js', `// Auto-generated from Lucide (ISC license) by tools/build-icons.mjs\nconst P = ${JSON.stringify(out)};\nexport function icon(n, s = 18, cls = '') {\n  return \`<svg class="ic \${cls}" width="\${s}" height="\${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">\${P[n] || ''}</svg>\`;\n}\n`);
console.log('icons:', Object.keys(out).length);
