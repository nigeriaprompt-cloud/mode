<p align="center"><img src="assets/icons/icon-192.png" width="96" alt="Mode logo"></p>

# Mode · Personal Operating System

A private, offline-first web app for running a disciplined life: **prayer and Bible study, fitness, building ThePrompt, finding a job, learning, and daily self-control**, in navy blue and white with fast 3D motion (DNA helix, matrix rain, tilt cards).

- **No backend, no account.** Your browser is the database (`localStorage`). Nothing leaves your device.
- **Installable.** Works as a home-screen app on Android, iPhone and desktop, and runs offline.
- **No build step, no dependencies.** Plain HTML, CSS and ES modules. Fonts and icons are bundled.

## Run it

```bash
python3 -m http.server 8000      # or: npx serve .
# open http://localhost:8000
```

It must be served over `http(s)` (not opened as a `file://`) for install and offline support to work.

## Put it on your phone

Host the folder on any static host, open the URL on your phone, then:

- **Android / Chrome:** tap **Install** in the top bar (or menu → *Install app*).
- **iPhone / Safari:** Share → **Add to Home Screen**.

Free static hosts: **Netlify** (drag and drop the folder), **Cloudflare Pages**, **Vercel**, or **GitHub Pages**
(Pages on a *private* repo needs a paid GitHub plan; use Netlify or Cloudflare otherwise).
All paths are relative, so it also works under a sub-path such as `/mode/`.

> Data lives in the browser it was created in. Phone and laptop do **not** sync with each other.
> Use **Settings → Export backup / Import backup** to move data between devices.

## What's inside

| Page | What it does |
| --- | --- |
| **Dashboard** | Greeting, completion %, streak, discipline score, next up, today's focus, schedule, pending, completed, workout / spiritual / business / career panels, 7-day chart, quick-add button |
| **Routine** | Editable daily schedule (times, days, importance, category). Record actual completion time, notes, reschedule missed items, 7-day missed list |
| **Check-in** | Morning (wake time, sleep, prayer, Bible, workout, 3 goals, priority) and evening review. Saved history. Auto-ticks matching routine items |
| **Fitness** | Push-ups, sit-ups, squats (all editable, add your own). Sets, targets, streak, volume chart, personal bests, body weight, rest timer |
| **Habits** | 12 starter habits plus custom. Daily/weekday or weekly targets, reminders, streaks, monthly calendar and matrix, archive. A missed day never deletes history |
| **Career & Learning** | Applications pipeline, companies contacted, interview prep and question bank, learning and focus timer with weekly hours |
| **Goals** | Daily, weekly, monthly goals; 30-day discipline challenge; 90-day transformation (days qualify automatically from your completion) |
| **Analytics** | Completion rates, score trends, radar balance, 12-week heatmap, workouts, habit consistency, spiritual, business, career, learning and focus hours, plus **weekly and monthly reports** (copy, `.md`, print/PDF) |
| **Journal** | Thoughts, lessons, gratitude, reflection, challenges, achievements, mood. Autosave, search, streak |
| **Settings** | Name, navy/white/auto theme, motion toggle, score weights, reminders, install, backup, restore |

## How the discipline score works

Transparent and adjustable (Settings → weights, or tap *How is this calculated?*).

1. Every routine activity has an **importance**: Easy = 1, Normal = 2, Critical = 3 points.
2. Category % = points done ÷ points planned.
3. **Anti-padding rule:** easy items can never be more than 25% of a category, so adding many trivial habits does not inflate your score.
4. Daily score = weighted average of categories. Default weights: Spiritual 20, Physical 20, Business 25, Career & Learning 20, Personal discipline 15.
5. Categories with nothing planned that day are left out and the rest re-balanced, so a rest day is not punished.

Only **completed scheduled activities** earn points.

## Reminders

Morning check-in, workout, scheduled activities (lead time adjustable), evening review, sleep wind-down and per-habit reminders.
You get an **in-app alert and bell inbox always**, and **browser notifications** once you grant permission.
Browsers can only fire these while Mode is open or running in the background (there is no push server), which is more reliable for the installed app on Android.

## Project layout

```
index.html  manifest.webmanifest  sw.js        app shell, PWA manifest, offline cache
css/style.css                                   navy/white design system
js/app.js        router, shell, theme, onboarding, bell
js/store.js      localStorage "database", defaults, migrations
js/stats.js      plan, completion, discipline score, streaks, habit + workout stats
js/fx.js         DNA helix, matrix rain, tilt, count-up, particle bursts, boot splash
js/charts.js     dependency-free SVG charts (re-rendered at real width)
js/pages/*.js    one module per page, loaded on demand
assets/          logo, favicon, install icons, bundled fonts
tools/           icon generator (dev only)
```

When you change any file, bump `VERSION` in `sw.js` so installed copies refresh.

## Credits

Icons from [Lucide](https://lucide.dev) (ISC). Fonts: Inter and JetBrains Mono (SIL OFL). Bible verses are from the public-domain King James Version.
