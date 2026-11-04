// The browser IS the backend: one JSON document in localStorage, with change subscriptions.
import { uid, today, addDays, debounce } from './util.js';

const KEY = 'mode.v1';
let S = null;
const subs = new Set();

export const CATS = {
  spiritual: { label: 'Spiritual', short: 'Spirit', icon: 'sparkles' },
  fitness: { label: 'Physical', short: 'Fitness', icon: 'dumbbell' },
  business: { label: 'Business', short: 'Business', icon: 'rocket' },
  career: { label: 'Career & Learning', short: 'Career', icon: 'graduation-cap' },
  discipline: { label: 'Personal discipline', short: 'Discipline', icon: 'shield-check' },
};
export const CAT_KEYS = Object.keys(CATS);
export const DEFAULT_WEIGHTS = { spiritual: 20, fitness: 20, business: 25, career: 20, discipline: 15 };
export const DOMAINS = ['PHP & MySQL', 'JavaScript', 'ThePrompt', 'Biotechnology', 'Reading', 'Career prep', 'Other'];
export const APP_STATUS = ['Saved', 'Applied', 'Interview', 'Offer', 'Rejected', 'No response'];
export const CHANNELS = ['WhatsApp', 'Email', 'LinkedIn', 'Phone', 'In person', 'Other'];

export const VERSES = [
  ['Proverbs 3:5', 'Trust in the LORD with all thine heart; and lean not unto thine own understanding.'],
  ['Philippians 4:13', 'I can do all things through Christ which strengtheneth me.'],
  ['Joshua 1:9', 'Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest.'],
  ['Colossians 3:23', 'And whatsoever ye do, do it heartily, as to the Lord, and not unto men;'],
  ['Proverbs 16:3', 'Commit thy works unto the LORD, and thy thoughts shall be established.'],
  ['Galatians 6:9', 'And let us not be weary in well doing: for in due season we shall reap, if we faint not.'],
  ['Isaiah 40:31', 'But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.'],
  ['Proverbs 22:29', 'Seest thou a man diligent in his business? he shall stand before kings; he shall not stand before mean men.'],
  ['2 Timothy 1:7', 'For God hath not given us the spirit of fear; but of power, and of love, and of a sound mind.'],
  ['Psalm 90:12', 'So teach us to number our days, that we may apply our hearts unto wisdom.'],
  ['Proverbs 21:5', 'The thoughts of the diligent tend only to plenteousness; but of every one that is hasty only to want.'],
  ['Ecclesiastes 9:10', 'Whatsoever thy hand findeth to do, do it with thy might;'],
  ['Psalm 119:105', 'Thy word is a lamp unto my feet, and a light unto my path.'],
  ['Matthew 6:33', 'But seek ye first the kingdom of God, and his righteousness; and all these things shall be added unto you.'],
  ['Proverbs 13:4', 'The soul of the sluggard desireth, and hath nothing: but the soul of the diligent shall be made fat.'],
];

export function defaults() {
  const t = today();
  const habit = (name, cat, extra = {}) => ({ id: uid(), name, cat, freq: 'daily', target: 7, days: [0, 1, 2, 3, 4, 5, 6], reminder: '', start: t, archived: false, ...extra });
  const habits = [
    habit('Wake up early', 'discipline'), habit('Morning prayer', 'spiritual'), habit('Bible study', 'spiritual'),
    habit('Exercise', 'fitness'), habit('Reading', 'career'), habit('Coding practice', 'business'),
    habit('ThePrompt development', 'business'), habit('Job applications', 'career', { days: [1, 2, 3, 4, 5] }),
    habit('Learning something new', 'career'), habit('Water intake (8 glasses)', 'fitness'),
    habit('Avoid unnecessary social media', 'discipline'), habit('Sleep on time', 'discipline'),
  ];
  const h = n => habits.find(x => x.name.startsWith(n)).id;
  const act = (key, time, title, cat, imp, habitId, dur = 30, extra = {}) => ({ id: uid(), key, time, title, cat, imp, days: [0, 1, 2, 3, 4, 5, 6], start: t, end: null, remind: true, habit: habitId || null, dur, ...extra });
  const acts = [
    act('wake', '05:30', 'Wake up', 'discipline', 2, h('Wake up'), 10),
    act('prayer_am', '05:30', 'Morning prayer', 'spiritual', 3, h('Morning prayer'), 20),
    act('bible', '06:00', 'Bible study', 'spiritual', 3, h('Bible study'), 30),
    act('exercise', '06:30', 'Exercise', 'fitness', 3, h('Exercise'), 45),
    act('prompt', '09:00', 'ThePrompt development', 'business', 3, h('ThePrompt'), 180),
    act('review', '12:00', 'Break and progress review', 'discipline', 1, null, 30),
    act('code', '14:00', 'Coding and product development', 'business', 2, h('Coding'), 120),
    act('jobs', '16:00', 'Job search and career development', 'career', 3, h('Job applications'), 90, { days: [1, 2, 3, 4, 5, 6] }),
    act('learn', '19:00', 'Personal learning', 'career', 2, h('Learning'), 60),
    act('prayer_pm', '20:00', 'Evening prayer and daily review', 'spiritual', 2, null, 30),
    act('sleep', '22:00', 'Sleep', 'discipline', 2, h('Sleep on time'), 0),
  ];
  const ex = (name, unit, target, step) => ({ id: uid(), name, unit, target, step });
  return {
    v: 1, created: t, onboarded: false,
    settings: {
      name: '', theme: 'dark', motion: true, verse: true, streakMin: 60, weeklyApps: 5,
      weights: { ...DEFAULT_WEIGHTS }, notify: false,
      remind: {
        morning: { on: true, time: '05:45' }, workout: { on: true, time: '06:20' }, activities: { on: true, lead: 5 },
        evening: { on: true, time: '20:30' }, sleep: { on: true, time: '21:45' }, habits: { on: true },
      },
      lastBackup: null,
    },
    acts, logs: {}, checkins: {},
    fit: { exercises: [ex('Push-ups', 'reps', 50, 10), ex('Sit-ups', 'reps', 50, 10), ex('Squats', 'reps', 50, 10)], log: {} },
    habits, hlog: {},
    career: { apps: [], contacts: [], prep: starterPrep() },
    sessions: [], goals: [], journal: {}, inbox: [], fired: {}, timer: null,
    nutrition: starterNutrition(),
  };
}

function starterNutrition() {
  const d = (breakfast, lunch, dinner, snack) => ({ breakfast, lunch, dinner, snack });
  return {
    setup: false, budget: { min: 1000, max: 1500 }, height: '', snackPm: 'Groundnuts, fruit or boiled potatoes',
    menu: { // 0 = Sunday
      1: d('Pap and groundnuts', 'Beans porridge', 'Eba and vegetable soup', 'Banana'),
      2: d('Bread and boiled egg', 'Rice and beans', 'Beans with ripe plantain if affordable', 'Groundnuts'),
      3: d('Boiled yam and egg sauce', 'Beans porridge', 'Eba and okra soup', 'Banana'),
      4: d('Pap and groundnuts', 'Rice and vegetable stew with fish', 'Sweet potatoes and beans', 'Seasonal fruit'),
      5: d('Moi moi and pap', 'Rice and beans', 'Eba and vegetable soup', 'Groundnuts'),
      6: d('Bread and egg', 'Spaghetti with tomato and vegetable sauce', 'Beans porridge', 'Banana'),
      0: d('Boiled yam and groundnuts', 'Rice, beans and fish', 'Yam porridge with vegetables', 'Seasonal fruit'),
    },
    shop: ['Beans', 'Rice', 'Garri', 'Yam or sweet potatoes', 'Eggs', 'Groundnuts', 'Ugu or other vegetables', 'Tomatoes', 'Pepper', 'Bananas or seasonal fruit', 'Small fish or sardines', 'Pap or maize flour'].map(name => ({ id: uid(), name, bought: false, cost: '' })),
    log: {}, // date -> { access: 'enough'|'some'|'little', spend }
  };
}

function starterPrep() {
  const c = (text) => ({ id: uid(), type: 'check', text, done: false });
  const q = (text) => ({ id: uid(), type: 'qa', text, answer: '', conf: 1 });
  return [
    c('Research the company: product, customers, recent news'), c('Prepare "Tell me about yourself" (60 seconds)'),
    c('Write 3 STAR stories (problem, action, result)'), c('Prepare 5 smart questions to ask them'),
    c('Have ThePrompt demo and GitHub ready to show'), c('Revise PHP, MySQL and JavaScript fundamentals'),
    q('Tell me about yourself.'), q('Why do you want this role?'), q('Describe a hard bug you solved.'),
    q('How do you design a MySQL schema for orders and payments?'), q('Tell me about ThePrompt and what you learned building it.'),
    q('What is your biggest weakness?'), q('Where do you see yourself in 3 years?'),
  ];
}

function migrate(d) {
  const base = defaults();
  const m = { ...base, ...d, settings: { ...base.settings, ...(d.settings || {}) } };
  m.settings.weights = { ...DEFAULT_WEIGHTS, ...(d.settings?.weights || {}) };
  m.settings.remind = { ...base.settings.remind, ...(d.settings?.remind || {}) };
  m.fit = { ...base.fit, ...(d.fit || {}) };
  m.career = { ...base.career, ...(d.career || {}) };
  m.nutrition = { ...base.nutrition, ...(d.nutrition || {}) };
  return m;
}

export function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) S = migrate(JSON.parse(raw)); } catch (e) { console.warn('load failed', e); }
  if (!S) S = defaults();
  addEventListener('storage', e => { if (e.key === KEY && e.newValue) { try { S = migrate(JSON.parse(e.newValue)); emit(); } catch { /* ignore */ } } });
  addEventListener('pagehide', () => persist.flush());
  document.addEventListener('visibilitychange', () => { if (document.hidden) persist.flush(); });
  return S;
}
export const get = () => S;
const persist = debounce(() => {
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { document.dispatchEvent(new CustomEvent('mode:error', { detail: 'Storage is full or blocked. Export a backup from Settings.' })); }
}, 200);
export function update(fn, { silent = false } = {}) { fn(S); persist(); if (!silent) emit(); }
export const subscribe = fn => { subs.add(fn); return () => subs.delete(fn); };
export function emit() { subs.forEach(f => { try { f(S); } catch (e) { console.error(e); } }); }
export function replaceAll(data) { S = migrate(data); persist(); persist.flush(); emit(); }
export function reset() { S = defaults(); persist(); persist.flush(); emit(); }
export const exportJSON = () => JSON.stringify(S, null, 2);
export function usage() { try { return (localStorage.getItem(KEY) || '').length; } catch { return 0; } }
export function dayLog(date) { const l = (S.logs[date] ||= { acts: {}, extra: [] }); l.acts ||= {}; l.extra ||= []; return l; }
export const tomorrow = () => addDays(today(), 1);

export function newChallenge(type) {
  const n = type === 'challenge30' ? 30 : 90;
  return { id: uid(), type, title: n === 30 ? '30-Day Discipline Challenge' : '90-Day Personal Transformation', description: n === 30 ? 'Show up every day. A day qualifies when you complete most of your plan.' : 'Three phases: Foundation (1-30), Build (31-60), Transform (61-90).', target: n, unit: 'days', start: today(), deadline: addDays(today(), n - 1), progress: 0, status: 'active', threshold: 70, over: {} };
}

import { download } from './util.js';
export function backup() {
  download(`mode-backup-${today()}.json`, exportJSON(), 'application/json');
  update(s => { s.settings.lastBackup = today(); });
}
