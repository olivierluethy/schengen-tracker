# Schengen 90/180 Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an offline-first, dark-only, mobile-first web app that tracks Schengen stays against the 90/180-day rule, with a per-trip stacked compliance graph, client-side PDF export, and an optional PHP backend for sync and privacy-filtered partner sharing.

**Architecture:** A pure, dependency-free calculation engine (`src/engine/`) holds all Schengen math and is unit-tested in isolation. Dexie/IndexedDB is the client source of truth; React reads it reactively via `useLiveQuery`. The PHP backend is optional infrastructure reached only through `src/sync/`, which never blocks the UI.

**Tech Stack:** React 18, Vite 5, Tailwind CSS 3, Framer Motion, Dexie 4 + dexie-react-hooks, Recharts 2, @react-pdf/renderer 3, vite-plugin-singlefile, vite-plugin-pwa, Vitest + fake-indexeddb. Backend: PHP 8.3, PDO SQLite (MySQL-portable), no framework.

**Spec:** `docs/superpowers/specs/2026-07-21-schengen-tracker-design.md`

---

## Global Constraints

Every task's requirements implicitly include this section.

- **Node is 18.19.1.** Pin **Vite 5** and **Tailwind 3**. Do NOT install Vite 6/7 or Tailwind 4 — they require Node 20+.
- **Dark mode ONLY.** No light theme, no theme toggle, no `prefers-color-scheme` media query anywhere. `<html>` carries `class="dark"` permanently.
- **No network dependency of any kind at runtime.** No Google Fonts, no CDN scripts, no external images. Typography uses the system font stack. Anything not inlined into the bundle is forbidden.
- **The frontend must never hard-depend on the backend.** Every network call is wrapped so failure is a normal state, identical to being offline.
- **Dates are ISO `YYYY-MM-DD` strings everywhere in storage and logic.** `Date` objects appear only inside `src/engine/dates.js`. Dates are displayed to the user as **`DD MMM YYYY`** (e.g. `27 Nov 2026`) and never as a raw or empty native date field.
- **Schengen durations are inclusive of both entry and exit days.** 23 Jul → 30 Jul = 8 days. The rolling window for reference date `D` is the inclusive range `[D − 179, D]`. The limit is **90** days.
- **Status thresholds:** `compliant` ≤ 75 used · `warning` 76–90 · `over` > 90.
- **Joint-window scan horizon:** 12 months. Graph x-range: earliest stay → today + 180 days.
- **All IDs are client-generated UUIDs** (`crypto.randomUUID()`), including on the server for user and partnership rows.
- **Deletes are tombstones** (`deleted: true` + bumped `updatedAt`). Never `.delete()` a stay row locally.
- **`updatedAt` is set on every write**, as `new Date().toISOString()`.
- Commit after every task. Conventional commit prefixes: `feat:`, `test:`, `chore:`, `fix:`, `docs:`.

---

## File Structure

```
frontend/
├── index.html
├── package.json
├── vite.config.js                 singlefile + PWA plugins, Vitest config
├── tailwind.config.js             dark palette (single source of colour truth)
├── postcss.config.js
└── src/
    ├── main.jsx                   React root
    ├── index.css                  Tailwind layers + base tokens
    ├── App.jsx                    tab routing + layout shell
    ├── engine/                    PURE. No React, no Dexie, no browser APIs.
    │   ├── dates.js               ISO ↔ Date, formatting, inclusive ranges
    │   ├── schengen.js            rolling window, per-stay decomposition, status
    │   ├── joint.js               proposed-trip feasibility, joint-window scan
    │   ├── palette.js             stable per-stay colour assignment
    │   └── *.test.js              Vitest suites, colocated
    ├── db/
    │   ├── db.js                  Dexie schema v1
    │   ├── stays.js               stay repository (create/update/softDelete/all)
    │   ├── meta.js                kv helpers (apiUrl, token, userId, cursors)
    │   └── stays.test.js
    ├── sync/
    │   ├── api.js                 fetch wrapper — never throws past the caller
    │   ├── client.js              delta push+pull, claim-on-login
    │   ├── useOnline.js           online/offline hook
    │   └── useSync.js             sync state machine + auto-flush
    ├── pdf/
    │   ├── ReportDocument.jsx     @react-pdf document (preview AND export)
    │   └── chartToPng.js          off-screen SVG → PNG data URL
    └── ui/
        ├── screens/
        │   ├── TrackerScreen.jsx
        │   ├── PartnersScreen.jsx
        │   ├── SettingsScreen.jsx
        │   └── PdfScreen.jsx
        ├── graph/
        │   ├── ComplianceGraph.jsx    stacked per-stay areas + limit line
        │   ├── TripRibbon.jsx         Recharts <Customized>, shares the x-scale
        │   └── SummaryTiles.jsx
        ├── stays/
        │   ├── StayList.jsx           tap-expand, swipe-delete
        │   ├── StayRow.jsx
        │   └── StayForm.jsx           add/edit modal — pre-fills everything
        ├── date/
        │   ├── DateRangeSheet.jsx     custom calendar, range select
        │   └── MonthGrid.jsx
        └── common/
            ├── Modal.jsx              Framer Motion sheet/modal primitive
            ├── SyncPill.jsx
            ├── Toast.jsx              undo-capable
            ├── EmptyState.jsx
            └── TabBar.jsx

backend/
├── index.php                      front controller + router (also the CLI router script)
├── lib/
│   ├── db.php                     PDO factory, migration runner, driver abstraction
│   ├── json.php                   JSON in/out, CORS, error helper
│   ├── auth.php                   register/login/token verification
│   └── sharing.php                sharing-level payload filter
├── api/
│   ├── auth.php
│   ├── sync.php
│   └── partners.php
├── schema.sql                     SQLite
├── schema.mysql.sql               MySQL port of the same schema
└── data/                          .gitignored — holds app.sqlite

README.md
```

---

## Task 1: Scaffold the frontend (Vite 5 + React + Tailwind 3 + Vitest)

**Files:**
- Create: `frontend/package.json`, `frontend/vite.config.js`, `frontend/tailwind.config.js`, `frontend/postcss.config.js`, `frontend/index.html`, `frontend/src/main.jsx`, `frontend/src/App.jsx`, `frontend/src/index.css`
- Create: `frontend/src/engine/smoke.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: a running dev server, the Tailwind dark palette token names used by every later task, and a working `npm test`.

- [ ] **Step 1: Create the Vite project and install pinned dependencies**

```bash
cd /home/neuadmin/Documents/Schengen-Tracker
npm create vite@5 frontend -- --template react
cd frontend
npm install
npm install dexie@^4 dexie-react-hooks@^1 framer-motion@^11 recharts@^2 @react-pdf/renderer@^3
npm install -D tailwindcss@^3 postcss@^8 autoprefixer@^10 vite-plugin-singlefile@^2 vite-plugin-pwa@^0.20 vitest@^1 fake-indexeddb@^6 jsdom@^24
```

Expected: installs complete. Verify the pins:

```bash
node -p "const p=require('./package.json');[p.devDependencies.vite,p.devDependencies.tailwindcss].join(' ')"
```

Expected: a Vite `5.x` and a Tailwind `3.x` version string. If either is 6+/4+, run `npm install -D vite@^5 tailwindcss@^3` and re-check.

- [ ] **Step 2: Write `frontend/tailwind.config.js` — the single source of colour truth**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Surfaces, darkest to lightest
        ink: {
          950: '#0A0C10',
          900: '#0F1216',
          850: '#141821',
          800: '#1A1F29',
          700: '#232A36',
          600: '#2E3644',
        },
        // Text, brightest to dimmest
        fog: {
          100: '#EEF1F6',
          300: '#C3CAD6',
          500: '#8B94A5',
          700: '#5B6474',
        },
        accent: { DEFAULT: '#7C9CFF', soft: '#A9BEFF', dim: '#3C4A78' },
        ok: '#3DD68C',
        warn: '#F5B84B',
        over: '#FF6B6B',
      },
      fontFamily: {
        // No webfonts: the bundle must work with zero network.
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      borderRadius: { xl2: '1.125rem' },
      boxShadow: {
        lift: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 8px 24px -12px rgba(0,0,0,0.8)',
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 3: Write `frontend/postcss.config.js`**

```js
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
}
```

- [ ] **Step 4: Write `frontend/src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html {
    color-scheme: dark;
    -webkit-text-size-adjust: 100%;
  }
  body {
    @apply bg-ink-950 text-fog-100 font-sans antialiased;
    /* Tabular figures: day counts must not jitter as they change. */
    font-feature-settings: 'tnum' 1, 'cv05' 1;
    overscroll-behavior-y: none;
  }
  /* Respect the iOS home indicator and notch. */
  .safe-b { padding-bottom: env(safe-area-inset-bottom, 0px); }
  .safe-t { padding-top: env(safe-area-inset-top, 0px); }
}

@layer components {
  .card { @apply bg-ink-900 border border-ink-700 rounded-xl2 shadow-lift; }
  .num  { font-variant-numeric: tabular-nums; }
}
```

- [ ] **Step 5: Write `frontend/index.html`**

```html
<!doctype html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#0A0C10" />
    <title>Schengen Tracker</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Write `frontend/src/main.jsx` and a placeholder `frontend/src/App.jsx`**

`src/main.jsx`:

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

`src/App.jsx`:

```jsx
export default function App() {
  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="card p-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Schengen Tracker</h1>
        <p className="mt-2 text-fog-500">Scaffold online.</p>
      </div>
    </div>
  )
}
```

Delete the Vite template leftovers:

```bash
rm -f src/App.css src/assets/react.svg public/vite.svg
```

- [ ] **Step 7: Add the Vitest config and scripts**

Replace `frontend/vite.config.js` with:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{js,jsx}'],
  },
})
```

In `frontend/package.json`, set the `scripts` block to:

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 8: Write a smoke test that proves the test runner works**

`frontend/src/engine/smoke.test.js`:

```js
import { describe, it, expect } from 'vitest'

describe('test runner', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 9: Run the test suite and the dev server**

```bash
cd frontend && npm test
```

Expected: `1 passed`.

```bash
npm run dev
```

Expected: Vite prints a `http://localhost:5173/` URL and the page shows "Schengen Tracker / Scaffold online." on a near-black background with light text. Stop the server with Ctrl-C.

- [ ] **Step 10: Commit**

```bash
cd /home/neuadmin/Documents/Schengen-Tracker
git add frontend
git commit -m "chore: scaffold Vite 5 + React + Tailwind 3 frontend with dark palette"
```

---

## Task 2: Single-file build + PWA (offline shell)

**Files:**
- Modify: `frontend/vite.config.js`
- Create: `frontend/public/icon-192.png`, `frontend/public/icon-512.png`

**Interfaces:**
- Consumes: Task 1's Vite config.
- Produces: `npm run build` emitting a standalone `dist/index.html` that runs from `file://`.

- [ ] **Step 1: Generate the PWA icons offline**

The icons must exist before the PWA plugin runs. Generate them locally with Node — no
downloads, no image library. The CRC table is computed inline because Node 18's `zlib`
does not expose `crc32`:

```bash
cd frontend && mkdir -p public && node -e '
const fs=require("fs"),z=require("zlib");
const T=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;T[n]=c>>>0;}
const crc=b=>{let c=0xFFFFFFFF;for(const x of b)c=T[(c^x)&0xFF]^(c>>>8);return (c^0xFFFFFFFF)>>>0;};
function png(size){const w=size,h=size,raw=Buffer.alloc((w*3+1)*h);
for(let y=0;y<h;y++){raw[y*(w*3+1)]=0;for(let x=0;x<w;x++){const o=y*(w*3+1)+1+x*3;
const c=Math.hypot(x-w/2,y-h/2)<w*0.34;raw[o]=c?0x7C:0x0A;raw[o+1]=c?0x9C:0x0C;raw[o+2]=c?0xFF:0x10;}}
const ck=(t,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]);
const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c]);};
const ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=2;
return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),ck("IHDR",ih),ck("IDAT",z.deflateSync(raw)),ck("IEND",Buffer.alloc(0))]);}
fs.writeFileSync("public/icon-192.png",png(192));fs.writeFileSync("public/icon-512.png",png(512));
console.log("icons written");'
```

Expected: `icons written`. Verify both files are non-empty:

```bash
ls -l public/icon-192.png public/icon-512.png
file public/icon-512.png
```

Expected: `PNG image data, 512 x 512`.

- [ ] **Step 2: Add the singlefile and PWA plugins to `frontend/vite.config.js`**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Relative base so dist/index.html works when opened from file://
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'inline',
      // The whole app is one HTML file; precache it and the icons.
      workbox: { globPatterns: ['**/*.{html,png,svg,ico}'] },
      manifest: {
        name: 'Schengen Tracker',
        short_name: 'Schengen',
        description: 'Offline 90/180-day Schengen compliance tracker',
        theme_color: '#0A0C10',
        background_color: '#0A0C10',
        display: 'standalone',
        start_url: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
    // MUST be last: it inlines every emitted JS/CSS asset into index.html.
    viteSingleFile(),
  ],
  build: {
    // Required by vite-plugin-singlefile: one chunk, no code splitting.
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 100000000,
    cssCodeSplit: false,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{js,jsx}'],
  },
})
```

- [ ] **Step 3: Build and verify the output is genuinely self-contained**

```bash
cd frontend && npm run build
ls -1 dist/
grep -c '<script' dist/index.html
grep -o 'src="[^"]*\.js"' dist/index.html | head
```

Expected: `dist/index.html` exists. The last `grep` prints **nothing** — no external `.js` references remain, because every script is inlined. `dist/` may also contain `manifest.webmanifest`, `sw.js` and the two icons; those are only needed for the installable-PWA path, not for the standalone file.

- [ ] **Step 4: Confirm the standalone file runs from the filesystem**

```bash
xdg-open "file://$PWD/dist/index.html" 2>/dev/null || echo "Open file://$PWD/dist/index.html manually"
```

Expected: the "Schengen Tracker / Scaffold online." card renders with the dark palette, opened directly from disk with no server. If the page is blank, open DevTools — a `file://` CORS error on a `.js` request means `viteSingleFile()` is not last in the plugin list.

- [ ] **Step 5: Commit**

```bash
cd /home/neuadmin/Documents/Schengen-Tracker
git add frontend
git commit -m "feat: single-file production build and installable PWA shell"
```

---

## Task 3: Date engine (`src/engine/dates.js`)

**Files:**
- Create: `frontend/src/engine/dates.js`
- Test: `frontend/src/engine/dates.test.js`
- Delete: `frontend/src/engine/smoke.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `todayISO(): string`
  - `parseISO(iso: string): Date` — UTC noon, DST-proof
  - `toISO(date: Date): string`
  - `addDays(iso: string, n: number): string`
  - `diffDays(fromISO: string, toISO: string): number` — `to − from`, signed
  - `eachDay(startISO: string, endISO: string): string[]` — **inclusive both ends**
  - `formatDisplay(iso: string): string` → `"27 Nov 2026"`
  - `formatShort(iso: string): string` → `"27 Nov"`
  - `formatMonth(iso: string): string` → `"Nov 2026"`
  - `isValidISO(v: unknown): boolean`
  - `epochDay(iso: string): number` / `fromEpochDay(n: number): string` — the numeric x-axis for the graph

- [ ] **Step 1: Write the failing test**

`frontend/src/engine/dates.test.js`:

```js
import { describe, it, expect } from 'vitest'
import {
  parseISO, toISO, addDays, diffDays, eachDay,
  formatDisplay, formatShort, formatMonth, isValidISO,
  epochDay, fromEpochDay,
} from './dates.js'

describe('parseISO / toISO', () => {
  it('round-trips an ISO date', () => {
    expect(toISO(parseISO('2026-11-27'))).toBe('2026-11-27')
  })

  it('survives a DST boundary (Europe switches on 2026-03-29)', () => {
    // Parsing at UTC noon means a local-midnight shift can never roll the date.
    expect(toISO(parseISO('2026-03-29'))).toBe('2026-03-29')
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29')
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30')
  })
})

describe('addDays', () => {
  it('crosses a month boundary', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
  })
  it('crosses a leap day', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })
  it('goes backwards', () => {
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  })
  it('spans the 180-day window', () => {
    expect(addDays('2026-07-21', -179)).toBe('2026-01-23')
  })
})

describe('diffDays', () => {
  it('is signed and exclusive of the start', () => {
    expect(diffDays('2026-07-23', '2026-07-30')).toBe(7)
    expect(diffDays('2026-07-30', '2026-07-23')).toBe(-7)
    expect(diffDays('2026-07-23', '2026-07-23')).toBe(0)
  })
})

describe('eachDay', () => {
  it('is inclusive of both ends', () => {
    const days = eachDay('2026-07-23', '2026-07-30')
    expect(days).toHaveLength(8)
    expect(days[0]).toBe('2026-07-23')
    expect(days[7]).toBe('2026-07-30')
  })
  it('returns a single day when start equals end', () => {
    expect(eachDay('2026-07-23', '2026-07-23')).toEqual(['2026-07-23'])
  })
  it('returns empty when end precedes start', () => {
    expect(eachDay('2026-07-30', '2026-07-23')).toEqual([])
  })
})

describe('formatting', () => {
  it('renders DD MMM YYYY', () => {
    expect(formatDisplay('2026-11-27')).toBe('27 Nov 2026')
  })
  it('pads single-digit days', () => {
    expect(formatDisplay('2026-01-05')).toBe('05 Jan 2026')
  })
  it('renders short and month forms', () => {
    expect(formatShort('2026-11-27')).toBe('27 Nov')
    expect(formatMonth('2026-11-27')).toBe('Nov 2026')
  })
  it('never returns an empty string for a valid date', () => {
    expect(formatDisplay('2026-11-27')).not.toBe('')
  })
  it('returns an em dash for missing input rather than throwing', () => {
    expect(formatDisplay(null)).toBe('—')
    expect(formatDisplay('')).toBe('—')
  })
})

describe('isValidISO', () => {
  it('accepts real dates and rejects everything else', () => {
    expect(isValidISO('2026-11-27')).toBe(true)
    expect(isValidISO('2026-02-30')).toBe(false)
    expect(isValidISO('27-11-2026')).toBe(false)
    expect(isValidISO(null)).toBe(false)
    expect(isValidISO(20261127)).toBe(false)
  })
})

describe('epochDay', () => {
  it('round-trips', () => {
    expect(fromEpochDay(epochDay('2026-11-27'))).toBe('2026-11-27')
  })
  it('increments by one per day', () => {
    expect(epochDay('2026-11-28') - epochDay('2026-11-27')).toBe(1)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd frontend && npx vitest run src/engine/dates.test.js
```

Expected: FAIL — `Failed to resolve import "./dates.js"`.

- [ ] **Step 3: Write the implementation**

`frontend/src/engine/dates.js`:

```js
/**
 * Date utilities for the Schengen engine.
 *
 * Every date in this app is an ISO `YYYY-MM-DD` string. `Date` objects exist
 * only inside this module. All parsing happens at UTC noon so that a local
 * timezone offset or a DST transition can never shift the calendar day.
 */

const MS_PER_DAY = 86400000
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/

export function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0))
}

export function toISO(date) {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function todayISO() {
  const now = new Date()
  // Use the LOCAL calendar day — "today" is what the user's wall clock says.
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function isValidISO(v) {
  if (typeof v !== 'string' || !ISO_RE.test(v)) return false
  // Reject dates that "roll over", e.g. 2026-02-30 → 2026-03-02.
  return toISO(parseISO(v)) === v
}

export function addDays(iso, n) {
  return toISO(new Date(parseISO(iso).getTime() + n * MS_PER_DAY))
}

export function diffDays(fromISO, toISODate) {
  return Math.round((parseISO(toISODate).getTime() - parseISO(fromISO).getTime()) / MS_PER_DAY)
}

/** Inclusive of BOTH ends — this is what makes a Schengen stay count correctly. */
export function eachDay(startISO, endISO) {
  const span = diffDays(startISO, endISO)
  if (span < 0) return []
  const out = new Array(span + 1)
  for (let i = 0; i <= span; i++) out[i] = addDays(startISO, i)
  return out
}

export function formatDisplay(iso) {
  if (!isValidISO(iso)) return '—'
  const [y, m, d] = iso.split('-')
  return `${d} ${MONTHS[Number(m) - 1]} ${y}`
}

export function formatShort(iso) {
  if (!isValidISO(iso)) return '—'
  const [, m, d] = iso.split('-')
  return `${d} ${MONTHS[Number(m) - 1]}`
}

export function formatMonth(iso) {
  if (!isValidISO(iso)) return '—'
  const [y, m] = iso.split('-')
  return `${MONTHS[Number(m) - 1]} ${y}`
}

/** Numeric x-axis value for charts: whole days since the Unix epoch. */
export function epochDay(iso) {
  return Math.round(parseISO(iso).getTime() / MS_PER_DAY)
}

export function fromEpochDay(n) {
  return toISO(new Date(n * MS_PER_DAY))
}
```

- [ ] **Step 4: Run the test to verify it passes, then delete the smoke test**

```bash
cd frontend && npx vitest run src/engine/dates.test.js
```

Expected: all tests PASS.

```bash
rm src/engine/smoke.test.js && npm test
```

Expected: the full suite passes with only the date tests.

- [ ] **Step 5: Commit**

```bash
cd /home/neuadmin/Documents/Schengen-Tracker
git add frontend/src/engine
git commit -m "feat: DST-proof ISO date engine with DD MMM YYYY formatting"
```

---

## Task 4: Schengen engine (`src/engine/schengen.js`)

This is the heart of the app. Every number the user sees comes from here.

**Files:**
- Create: `frontend/src/engine/schengen.js`, `frontend/src/engine/palette.js`
- Test: `frontend/src/engine/schengen.test.js`

**Interfaces:**
- Consumes: `dates.js` — `eachDay`, `addDays`, `diffDays`, `epochDay`, `todayISO`.
- Produces:
  - Constants `WINDOW_DAYS = 180`, `LIMIT_DAYS = 90`, `WARNING_FROM = 76`
  - `stayDuration(stay): number` — inclusive day count
  - `buildPresence(stays): Map<string, string>` — ISO day → owning stay id (earlier `startDate` wins a shared day, so bands never double-count)
  - `usageOn(presence, refISO): number`
  - `contributionsOn(presence, refISO): Record<stayId, number>`
  - `remainingOn(used): number`
  - `statusOf(used): 'compliant' | 'warning' | 'over'`
  - `buildSeries(stays, fromISO, toISO, step = 1): { points, stayIds }` where each point is `{ t, date, total, remaining, [`s_${id}`]: number }`
  - `graphRange(stays, today = todayISO()): { from, to }`
  - `colorForStay(stay, allStays): string` (from `palette.js`)
- Note: `buildSeries` emits per-stay values under the key `` `s_${id}` `` because Recharts `dataKey`s must be flat strings. Later tasks depend on that exact prefix.

- [ ] **Step 1: Write the failing test**

`frontend/src/engine/schengen.test.js`:

```js
import { describe, it, expect } from 'vitest'
import {
  WINDOW_DAYS, LIMIT_DAYS,
  stayDuration, buildPresence, usageOn, contributionsOn,
  remainingOn, statusOf, buildSeries, graphRange,
} from './schengen.js'

const stay = (id, name, startDate, endDate) => ({
  id, name, country: null, startDate, endDate,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  deleted: false, ownerId: null,
})

describe('constants', () => {
  it('encodes the 90/180 rule', () => {
    expect(WINDOW_DAYS).toBe(180)
    expect(LIMIT_DAYS).toBe(90)
  })
})

describe('stayDuration', () => {
  it('counts both entry and exit days', () => {
    expect(stayDuration(stay('a', 'Barcelona', '2026-07-23', '2026-07-30'))).toBe(8)
  })
  it('counts a same-day trip as one day', () => {
    expect(stayDuration(stay('a', 'Transit', '2026-07-23', '2026-07-23'))).toBe(1)
  })
})

describe('usageOn', () => {
  it('counts every day of a stay that falls inside the window', () => {
    const p = buildPresence([stay('a', 'Barcelona', '2026-07-23', '2026-07-30')])
    expect(usageOn(p, '2026-07-30')).toBe(8)
  })

  it('includes a day exactly 179 days before the reference date', () => {
    // Window is [D-179, D] inclusive — 180 days wide.
    // 2026-01-23 is exactly 179 days before 2026-07-21, so it still counts.
    const p = buildPresence([stay('a', 'Edge', '2026-01-23', '2026-01-23')])
    expect(usageOn(p, '2026-07-21')).toBe(1)
  })

  it('excludes a day exactly 180 days before the reference date', () => {
    // One day later the same stay has dropped out of the window.
    const p = buildPresence([stay('a', 'Edge', '2026-01-23', '2026-01-23')])
    expect(usageOn(p, '2026-07-22')).toBe(0)
  })

  it('ignores future days relative to the reference date', () => {
    const p = buildPresence([stay('a', 'Later', '2026-08-01', '2026-08-10')])
    expect(usageOn(p, '2026-07-21')).toBe(0)
  })

  it('ignores deleted stays', () => {
    const gone = { ...stay('a', 'Gone', '2026-07-01', '2026-07-10'), deleted: true }
    expect(usageOn(buildPresence([gone]), '2026-07-10')).toBe(0)
  })

  it('does not double-count overlapping stays', () => {
    const p = buildPresence([
      stay('a', 'Paris', '2026-07-01', '2026-07-10'),
      stay('b', 'Lyon', '2026-07-05', '2026-07-15'),
    ])
    // Union is 1–15 July = 15 days, not 10 + 11 = 21.
    expect(usageOn(p, '2026-07-15')).toBe(15)
  })
})

describe('contributionsOn', () => {
  it('splits the total across stays', () => {
    const stays = [
      stay('a', 'Lisbon', '2026-07-01', '2026-07-05'),   // 5 days
      stay('b', 'Paris', '2026-07-10', '2026-07-14'),    // 5 days
    ]
    const c = contributionsOn(buildPresence(stays), '2026-07-20')
    expect(c.a).toBe(5)
    expect(c.b).toBe(5)
  })

  it('attributes a shared day to the earlier-starting stay', () => {
    const stays = [
      stay('a', 'Paris', '2026-07-01', '2026-07-10'),  // owns 1–10
      stay('b', 'Lyon', '2026-07-05', '2026-07-15'),   // owns 11–15 only
    ]
    const c = contributionsOn(buildPresence(stays), '2026-07-15')
    expect(c.a).toBe(10)
    expect(c.b).toBe(5)
    expect(c.a + c.b).toBe(usageOn(buildPresence(stays), '2026-07-15'))
  })
})

describe('statusOf / remainingOn', () => {
  it('applies the thresholds at their exact boundaries', () => {
    expect(statusOf(0)).toBe('compliant')
    expect(statusOf(75)).toBe('compliant')
    expect(statusOf(76)).toBe('warning')
    expect(statusOf(90)).toBe('warning')
    expect(statusOf(91)).toBe('over')
  })
  it('never reports negative remaining days', () => {
    expect(remainingOn(40)).toBe(50)
    expect(remainingOn(90)).toBe(0)
    expect(remainingOn(100)).toBe(0)
  })
})

describe('buildSeries', () => {
  const stays = [
    stay('a', 'Lisbon', '2026-03-01', '2026-03-10'),
    stay('b', 'Paris', '2026-05-01', '2026-05-20'),
  ]

  it('emits one point per day, inclusive', () => {
    const { points } = buildSeries(stays, '2026-05-01', '2026-05-10')
    expect(points).toHaveLength(10)
    expect(points[0].date).toBe('2026-05-01')
    expect(points[9].date).toBe('2026-05-10')
  })

  it('per-stay bands sum exactly to the total on every point', () => {
    const { points, stayIds } = buildSeries(stays, '2026-02-01', '2026-08-01')
    for (const p of points) {
      const sum = stayIds.reduce((acc, id) => acc + (p[`s_${id}`] || 0), 0)
      expect(sum).toBe(p.total)
    }
  })

  it('exposes remaining alongside total', () => {
    const { points } = buildSeries(stays, '2026-05-20', '2026-05-20')
    expect(points[0].remaining).toBe(90 - points[0].total)
  })

  it('honours the sampling step but always includes the last day', () => {
    const { points } = buildSeries(stays, '2026-05-01', '2026-05-10', 3)
    expect(points.map((p) => p.date)).toEqual([
      '2026-05-01', '2026-05-04', '2026-05-07', '2026-05-10',
    ])
  })

  it('returns an empty series when there are no stays', () => {
    const { points, stayIds } = buildSeries([], '2026-05-01', '2026-05-03')
    expect(stayIds).toEqual([])
    expect(points.every((p) => p.total === 0)).toBe(true)
  })
})

describe('graphRange', () => {
  it('runs from the earliest stay to today + 180 days', () => {
    const r = graphRange(
      [stay('a', 'Old', '2026-01-10', '2026-01-20')],
      '2026-07-21',
    )
    expect(r.from).toBe('2026-01-10')
    expect(r.to).toBe('2027-01-17') // 2026-07-21 + 180
  })

  it('falls back to today − 180 when there are no stays', () => {
    const r = graphRange([], '2026-07-21')
    expect(r.from).toBe('2026-01-22')
    expect(r.to).toBe('2027-01-17')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd frontend && npx vitest run src/engine/schengen.test.js
```

Expected: FAIL — `Failed to resolve import "./schengen.js"`.

- [ ] **Step 3: Write `frontend/src/engine/schengen.js`**

```js
/**
 * The Schengen 90/180 rule.
 *
 * For a reference date D, count days of presence inside the INCLUSIVE window
 * [D - 179, D] — 180 calendar days wide. Both the entry and the exit day of a
 * stay count as days of presence. The limit is 90 days.
 *
 * Everything here is pure: no React, no Dexie, no browser APIs. That is what
 * lets the graph, the PDF renderer and the partner joint-scan all share it.
 */
import { addDays, diffDays, eachDay, epochDay, todayISO } from './dates.js'

export const WINDOW_DAYS = 180
export const LIMIT_DAYS = 90
export const WARNING_FROM = 76

/** Inclusive of both entry and exit days: 23 Jul → 30 Jul is 8 days. */
export function stayDuration(stay) {
  return Math.max(0, diffDays(stay.startDate, stay.endDate) + 1)
}

const activeStays = (stays) => (stays || []).filter((s) => s && !s.deleted)

/**
 * Map every day of presence to exactly ONE owning stay.
 *
 * A day covered by two stays is one day of presence, not two. The earlier
 * `startDate` claims the shared day (ties broken by id, so the result is
 * deterministic). This is what makes the stacked graph bands sum exactly to
 * the rolling total instead of overshooting it.
 */
export function buildPresence(stays) {
  const ordered = activeStays(stays).slice().sort((a, b) =>
    a.startDate === b.startDate ? (a.id < b.id ? -1 : 1) : a.startDate < b.startDate ? -1 : 1,
  )
  const presence = new Map()
  for (const s of ordered) {
    for (const day of eachDay(s.startDate, s.endDate)) {
      if (!presence.has(day)) presence.set(day, s.id)
    }
  }
  return presence
}

export function usageOn(presence, refISO) {
  const start = addDays(refISO, -(WINDOW_DAYS - 1))
  let used = 0
  for (const day of presence.keys()) {
    if (day >= start && day <= refISO) used++
  }
  return used
}

export function contributionsOn(presence, refISO) {
  const start = addDays(refISO, -(WINDOW_DAYS - 1))
  const out = {}
  for (const [day, stayId] of presence) {
    if (day >= start && day <= refISO) out[stayId] = (out[stayId] || 0) + 1
  }
  return out
}

export function remainingOn(used) {
  return Math.max(0, LIMIT_DAYS - used)
}

export function statusOf(used) {
  if (used > LIMIT_DAYS) return 'over'
  if (used >= WARNING_FROM) return 'warning'
  return 'compliant'
}

/**
 * The rolling series, decomposed per stay.
 *
 * Uses a sliding window over a sorted day list so the cost is O(days) rather
 * than O(days x window). Each point carries `s_<stayId>` keys — Recharts
 * dataKeys must be flat strings, and the `s_` prefix keeps them from colliding
 * with `date`, `total`, `remaining` or `t`.
 *
 * @param {number} step Emit every Nth day (the last day is always emitted).
 */
export function buildSeries(stays, fromISO, toISO, step = 1) {
  const active = activeStays(stays)
  const stayIds = active.map((s) => s.id)
  const presence = buildPresence(active)

  const sortedDays = Array.from(presence.keys()).sort()
  const points = []
  const counts = new Map() // stayId -> days currently inside the window
  let head = 0             // next day to enter the window
  let tail = 0             // next day to leave the window
  let total = 0

  const span = diffDays(fromISO, toISO)
  for (let i = 0; i <= span; i++) {
    const date = addDays(fromISO, i)
    const windowStart = addDays(date, -(WINDOW_DAYS - 1))

    while (head < sortedDays.length && sortedDays[head] <= date) {
      const id = presence.get(sortedDays[head])
      counts.set(id, (counts.get(id) || 0) + 1)
      total++
      head++
    }
    while (tail < head && sortedDays[tail] < windowStart) {
      const id = presence.get(sortedDays[tail])
      counts.set(id, counts.get(id) - 1)
      total--
      tail++
    }

    const isLast = i === span
    if (i % step !== 0 && !isLast) continue

    const point = {
      t: epochDay(date),
      date,
      total,
      remaining: remainingOn(total),
    }
    for (const id of stayIds) point[`s_${id}`] = counts.get(id) || 0
    points.push(point)
  }

  return { points, stayIds }
}

/** Earliest stay (or today − 180) through today + 180, per the spec. */
export function graphRange(stays, today = todayISO()) {
  const active = activeStays(stays)
  const earliest = active.reduce(
    (min, s) => (min === null || s.startDate < min ? s.startDate : min),
    null,
  )
  return {
    from: earliest || addDays(today, -WINDOW_DAYS),
    to: addDays(today, WINDOW_DAYS),
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd frontend && npx vitest run src/engine/schengen.test.js
```

Expected: all tests PASS. If `graphRange` fails by one day, check that `addDays(today, 180)` is used — the spec says today **+180**, while the *window* uses 179 because it is inclusive of `D` itself.

- [ ] **Step 5: Write `frontend/src/engine/palette.js`**

Colours must be stable: adding a new trip must never recolour an existing one. Creation order is immutable, so index by `createdAt`.

```js
/**
 * Per-stay colours for the graph bands, ribbon segments and list rows.
 *
 * Indexed by creation order (which never changes) so adding a new trip cannot
 * recolour existing ones. Hues are chosen for legibility on the near-black
 * surface and to stay distinguishable from the status colours (ok/warn/over).
 */
export const TRIP_COLORS = [
  '#6EA8FE', // blue
  '#5EE9B5', // mint
  '#F0A868', // amber
  '#C9A0FF', // violet
  '#F79FC4', // pink
  '#7ED8E8', // cyan
  '#B8D96B', // lime
  '#FF9B85', // coral
]

export function colorForStay(stay, allStays) {
  const ordered = (allStays || [])
    .filter((s) => s && !s.deleted)
    .slice()
    .sort((a, b) =>
      a.createdAt === b.createdAt ? (a.id < b.id ? -1 : 1) : a.createdAt < b.createdAt ? -1 : 1,
    )
  const idx = ordered.findIndex((s) => s.id === stay.id)
  return TRIP_COLORS[(idx < 0 ? 0 : idx) % TRIP_COLORS.length]
}

/** Precompute a lookup so lists and charts do not re-sort per row. */
export function colorMap(allStays) {
  const map = {}
  for (const s of allStays || []) map[s.id] = colorForStay(s, allStays)
  return map
}
```

- [ ] **Step 6: Run the full suite and commit**

```bash
cd frontend && npm test
```

Expected: date + Schengen suites pass.

```bash
cd /home/neuadmin/Documents/Schengen-Tracker
git add frontend/src/engine
git commit -m "feat: 90/180 rolling-window engine with per-stay decomposition"
```

---

## Task 5: Local persistence (Dexie)

**Files:**
- Create: `frontend/src/db/db.js`, `frontend/src/db/stays.js`, `frontend/src/db/meta.js`
- Test: `frontend/src/db/stays.test.js`
- Modify: `frontend/vite.config.js` (add the fake-indexeddb setup file)
- Create: `frontend/src/test-setup.js`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `db` — Dexie instance with tables `stays`, `meta`, `partners`, `partnerCurves`
  - `createStay({ name, country, startDate, endDate }): Promise<Stay>`
  - `updateStay(id, patch): Promise<Stay>`
  - `softDeleteStay(id): Promise<void>`
  - `restoreStay(id): Promise<void>` (powers the undo toast)
  - `listStays(): Promise<Stay[]>` — active only, sorted by `startDate`
  - `allStaysRaw(): Promise<Stay[]>` — includes tombstones, for sync
  - `upsertFromServer(stay): Promise<'applied'|'skipped'>` — last-write-wins
  - `getMeta(key, fallback)`, `setMeta(key, value)`

- [ ] **Step 1: Add the test setup file and register it**

`frontend/src/test-setup.js`:

```js
// Dexie needs a real IndexedDB implementation under Node.
import 'fake-indexeddb/auto'
```

In `frontend/vite.config.js`, add `setupFiles` to the `test` block:

```js
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
  },
```

- [ ] **Step 2: Write the failing test**

`frontend/src/db/stays.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from './db.js'
import {
  createStay, updateStay, softDeleteStay, restoreStay,
  listStays, allStaysRaw, upsertFromServer,
} from './stays.js'
import { getMeta, setMeta } from './meta.js'

beforeEach(async () => {
  await db.stays.clear()
  await db.meta.clear()
})

describe('createStay', () => {
  it('assigns a UUID and timestamps', async () => {
    const s = await createStay({ name: 'Barcelona', startDate: '2026-07-23', endDate: '2026-07-30' })
    expect(s.id).toMatch(/^[0-9a-f-]{36}$/i)
    expect(s.createdAt).toBe(s.updatedAt)
    expect(s.deleted).toBe(false)
    expect(s.ownerId).toBe(null)
  })

  it('persists and reads back with both dates intact', async () => {
    await createStay({ name: 'Barcelona', startDate: '2026-07-23', endDate: '2026-07-30' })
    const [row] = await listStays()
    // The edit-modal bug lives here: dates must survive the round-trip.
    expect(row.startDate).toBe('2026-07-23')
    expect(row.endDate).toBe('2026-07-30')
    expect(row.name).toBe('Barcelona')
  })

  it('rejects an end date before the start date', async () => {
    await expect(
      createStay({ name: 'Bad', startDate: '2026-07-30', endDate: '2026-07-23' }),
    ).rejects.toThrow(/end date/i)
  })

  it('rejects an empty name', async () => {
    await expect(
      createStay({ name: '  ', startDate: '2026-07-23', endDate: '2026-07-30' }),
    ).rejects.toThrow(/name/i)
  })
})

describe('updateStay', () => {
  it('bumps updatedAt and keeps createdAt', async () => {
    const s = await createStay({ name: 'Paris', startDate: '2026-05-01', endDate: '2026-05-05' })
    const u = await updateStay(s.id, { name: 'Lyon', endDate: '2026-05-08' })
    expect(u.name).toBe('Lyon')
    expect(u.endDate).toBe('2026-05-08')
    expect(u.startDate).toBe('2026-05-01')
    expect(u.createdAt).toBe(s.createdAt)
    expect(u.updatedAt >= s.updatedAt).toBe(true)
  })

  it('validates the resulting date range, not just the patch', async () => {
    const s = await createStay({ name: 'Paris', startDate: '2026-05-01', endDate: '2026-05-05' })
    await expect(updateStay(s.id, { endDate: '2026-04-30' })).rejects.toThrow(/end date/i)
  })
})

describe('soft delete', () => {
  it('tombstones rather than removing the row', async () => {
    const s = await createStay({ name: 'Rome', startDate: '2026-06-01', endDate: '2026-06-04' })
    await softDeleteStay(s.id)
    expect(await listStays()).toHaveLength(0)
    const raw = await allStaysRaw()
    expect(raw).toHaveLength(1)
    expect(raw[0].deleted).toBe(true)
  })

  it('can be undone', async () => {
    const s = await createStay({ name: 'Rome', startDate: '2026-06-01', endDate: '2026-06-04' })
    await softDeleteStay(s.id)
    await restoreStay(s.id)
    expect(await listStays()).toHaveLength(1)
  })
})

describe('listStays', () => {
  it('sorts by start date ascending', async () => {
    await createStay({ name: 'B', startDate: '2026-08-01', endDate: '2026-08-02' })
    await createStay({ name: 'A', startDate: '2026-07-01', endDate: '2026-07-02' })
    expect((await listStays()).map((s) => s.name)).toEqual(['A', 'B'])
  })
})

describe('upsertFromServer (last-write-wins)', () => {
  const server = (over = {}) => ({
    id: 'fixed-id', name: 'Server', country: null,
    startDate: '2026-07-01', endDate: '2026-07-05',
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-02T00:00:00.000Z',
    deleted: false, ownerId: 'user-1', ...over,
  })

  it('inserts a record it has never seen', async () => {
    expect(await upsertFromServer(server())).toBe('applied')
    expect((await listStays())[0].name).toBe('Server')
  })

  it('applies a newer server record over a stale local one', async () => {
    await db.stays.put(server({ name: 'Local', updatedAt: '2026-06-01T00:00:00.000Z' }))
    expect(await upsertFromServer(server({ name: 'Server' }))).toBe('applied')
    expect((await listStays())[0].name).toBe('Server')
  })

  it('keeps a newer local record over a stale server one', async () => {
    await db.stays.put(server({ name: 'Local', updatedAt: '2026-06-09T00:00:00.000Z' }))
    expect(await upsertFromServer(server({ name: 'Server' }))).toBe('skipped')
    expect((await listStays())[0].name).toBe('Local')
  })

  it('propagates a server tombstone', async () => {
    await db.stays.put(server({ name: 'Local' }))
    await upsertFromServer(server({ deleted: true, updatedAt: '2026-06-03T00:00:00.000Z' }))
    expect(await listStays()).toHaveLength(0)
    expect(await allStaysRaw()).toHaveLength(1)
  })
})

describe('meta', () => {
  it('stores and retrieves values with a fallback', async () => {
    expect(await getMeta('apiUrl', null)).toBe(null)
    await setMeta('apiUrl', 'http://127.0.0.1:8080')
    expect(await getMeta('apiUrl', null)).toBe('http://127.0.0.1:8080')
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
cd frontend && npx vitest run src/db/stays.test.js
```

Expected: FAIL — `Failed to resolve import "./db.js"`.

- [ ] **Step 4: Write `frontend/src/db/db.js`**

```js
import Dexie from 'dexie'

/**
 * Local IndexedDB is the client SOURCE OF TRUTH. The server is a replica.
 *
 * There is deliberately no separate "pending changes" table: the set of stays
 * with `updatedAt > lastPushedAt` IS the outbox. One fewer structure to fall
 * out of sync.
 */
export const db = new Dexie('schengen-tracker')

db.version(1).stores({
  stays: 'id, startDate, updatedAt, deleted',
  meta: 'key',
  partners: 'id, status',
  partnerCurves: 'partnerId',
})
```

- [ ] **Step 5: Write `frontend/src/db/meta.js`**

```js
import { db } from './db.js'

export async function getMeta(key, fallback = null) {
  const row = await db.meta.get(key)
  return row === undefined ? fallback : row.value
}

export async function setMeta(key, value) {
  await db.meta.put({ key, value })
  return value
}

export async function clearMeta(...keys) {
  await db.meta.bulkDelete(keys)
}
```

- [ ] **Step 6: Write `frontend/src/db/stays.js`**

```js
import { db } from './db.js'
import { isValidISO } from '../engine/dates.js'

const now = () => new Date().toISOString()

/**
 * Validation lives here, not in the form, so that no write path — form, sync
 * claim, or import — can create an invalid record.
 * @returns {Record<string,string>} field -> message; empty when valid
 */
export function validateStay({ name, startDate, endDate }) {
  const errors = {}
  if (!name || !String(name).trim()) errors.name = 'Give this stay a name'
  if (!isValidISO(startDate)) errors.startDate = 'Pick a start date'
  if (!isValidISO(endDate)) errors.endDate = 'Pick an end date'
  if (!errors.startDate && !errors.endDate && endDate < startDate) {
    errors.endDate = 'End date must be on or after the start date'
  }
  return errors
}

function assertValid(fields) {
  const errors = validateStay(fields)
  const keys = Object.keys(errors)
  if (keys.length) {
    const err = new Error(errors[keys[0]])
    err.fieldErrors = errors
    throw err
  }
}

export async function createStay({ name, country = null, startDate, endDate }) {
  assertValid({ name, startDate, endDate })
  const ts = now()
  const stay = {
    id: crypto.randomUUID(),
    name: String(name).trim(),
    country: country ? String(country).trim() : null,
    startDate,
    endDate,
    createdAt: ts,
    updatedAt: ts,
    deleted: false,
    ownerId: await currentOwnerId(),
  }
  await db.stays.put(stay)
  return stay
}

export async function updateStay(id, patch) {
  const existing = await db.stays.get(id)
  if (!existing) throw new Error('That stay no longer exists')
  const merged = { ...existing, ...patch }
  assertValid(merged)
  const next = {
    ...merged,
    name: String(merged.name).trim(),
    country: merged.country ? String(merged.country).trim() : null,
    createdAt: existing.createdAt,
    updatedAt: now(),
  }
  await db.stays.put(next)
  return next
}

export async function softDeleteStay(id) {
  const existing = await db.stays.get(id)
  if (!existing) return
  await db.stays.put({ ...existing, deleted: true, updatedAt: now() })
}

export async function restoreStay(id) {
  const existing = await db.stays.get(id)
  if (!existing) return
  await db.stays.put({ ...existing, deleted: false, updatedAt: now() })
}

export async function listStays() {
  const rows = await db.stays.filter((s) => !s.deleted).toArray()
  return rows.sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0))
}

export async function allStaysRaw() {
  return db.stays.toArray()
}

/** Last-write-wins merge of one server record. */
export async function upsertFromServer(remote) {
  const local = await db.stays.get(remote.id)
  if (local && local.updatedAt >= remote.updatedAt) return 'skipped'
  await db.stays.put(remote)
  return 'applied'
}

async function currentOwnerId() {
  const row = await db.meta.get('userId')
  return row === undefined ? null : row.value
}
```

- [ ] **Step 7: Run the tests to verify they pass**

```bash
cd frontend && npx vitest run src/db/stays.test.js
```

Expected: all PASS. If `crypto.randomUUID` is undefined, confirm Node is 18.19+ (`node -v`) — it is available from Node 16.7.

- [ ] **Step 8: Commit**

```bash
cd /home/neuadmin/Documents/Schengen-Tracker
git add frontend
git commit -m "feat: Dexie persistence with tombstones and last-write-wins merge"
```

---

## Task 6: App shell — tabs, motion primitives, offline pill

**Files:**
- Create: `frontend/src/ui/common/TabBar.jsx`, `frontend/src/ui/common/Modal.jsx`, `frontend/src/ui/common/Toast.jsx`, `frontend/src/ui/common/EmptyState.jsx`, `frontend/src/ui/common/SyncPill.jsx`
- Create: `frontend/src/sync/useOnline.js`
- Modify: `frontend/src/App.jsx`
- Create: `frontend/src/ui/screens/TrackerScreen.jsx`, `frontend/src/ui/screens/PartnersScreen.jsx`, `frontend/src/ui/screens/SettingsScreen.jsx`

**Interfaces:**
- Consumes: Tailwind tokens from Task 1.
- Produces:
  - `<TabBar active onChange />` with tabs `tracker | partners | settings`
  - `<Modal open onClose title children />` — bottom sheet on mobile, centred dialog ≥640px
  - `<Toast message actionLabel onAction onDismiss />`
  - `<EmptyState onAdd />`
  - `<SyncPill state />` where state ∈ `offline | local | syncing | synced | pending`
  - `useOnline(): boolean`

- [ ] **Step 1: Write `frontend/src/sync/useOnline.js`**

```js
import { useEffect, useState } from 'react'

/** Tracks connectivity. The `online`/`offline` events also drive sync flushes. */
export function useOnline() {
  const [online, setOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )
  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])
  return online
}
```

- [ ] **Step 2: Write `frontend/src/ui/common/Modal.jsx`**

```jsx
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'

/**
 * A bottom sheet on phones, a centred dialog from 640px up. Motion is
 * purposeful: the sheet rises from where the thumb is, so the eye follows it.
 */
export default function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="relative w-full sm:max-w-md bg-ink-900 border-t sm:border border-ink-700
                       sm:rounded-xl2 rounded-t-3xl shadow-lift max-h-[92vh] overflow-y-auto safe-b"
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 30, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          >
            <div className="sm:hidden pt-3 grid place-items-center">
              <div className="h-1 w-10 rounded-full bg-ink-600" />
            </div>
            {title && (
              <div className="px-5 pt-4 pb-2">
                <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
              </div>
            )}
            <div className="px-5 pb-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 3: Write `frontend/src/ui/common/Toast.jsx`**

```jsx
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'

export default function Toast({ message, actionLabel, onAction, onDismiss, duration = 5000 }) {
  useEffect(() => {
    if (!message) return
    const t = setTimeout(onDismiss, duration)
    return () => clearTimeout(t)
  }, [message, duration, onDismiss])

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[60] flex items-center gap-4
                     bg-ink-800 border border-ink-600 rounded-full pl-5 pr-2 py-2 shadow-lift"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        >
          <span className="text-sm text-fog-300">{message}</span>
          {actionLabel && (
            <button
              onClick={onAction}
              className="text-sm font-semibold text-accent px-3 py-1 rounded-full hover:bg-ink-700"
            >
              {actionLabel}
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 4: Write `frontend/src/ui/common/SyncPill.jsx`**

```jsx
import { AnimatePresence, motion } from 'framer-motion'

const LABELS = {
  offline: { text: 'Offline', dot: 'bg-fog-500', hint: 'Everything still works' },
  local: { text: 'On this device', dot: 'bg-fog-500', hint: 'No account needed' },
  syncing: { text: 'Syncing', dot: 'bg-accent animate-pulse', hint: '' },
  synced: { text: 'Synced', dot: 'bg-ok', hint: '' },
  pending: { text: 'Pending', dot: 'bg-warn', hint: 'Will sync when back online' },
}

export default function SyncPill({ state = 'local', count = 0 }) {
  const s = LABELS[state] || LABELS.local
  const text = state === 'pending' && count ? `${count} pending` : s.text
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={text}
        className="inline-flex items-center gap-2 rounded-full border border-ink-700
                   bg-ink-900/80 px-3 py-1.5 text-xs text-fog-300"
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 4 }}
        transition={{ duration: 0.18 }}
        title={s.hint}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
        {text}
      </motion.div>
    </AnimatePresence>
  )
}
```

- [ ] **Step 5: Write `frontend/src/ui/common/EmptyState.jsx`**

```jsx
import { motion } from 'framer-motion'

export default function EmptyState({ onAdd }) {
  return (
    <motion.div
      className="card p-8 text-center"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="mx-auto h-12 w-12 rounded-2xl bg-accent-dim grid place-items-center text-xl">
        🛬
      </div>
      <h2 className="mt-4 text-lg font-semibold tracking-tight">No stays yet</h2>
      <p className="mt-2 text-sm text-fog-500 leading-relaxed">
        Add your first Schengen stay and this page will show exactly how many of your
        90 days you have used in any rolling 180-day window.
      </p>
      <p className="mt-3 text-xs text-fog-700 leading-relaxed">
        No account. No internet needed. Everything stays on this device — an account is
        optional and only adds sync between devices and sharing with a partner.
      </p>
      <button
        onClick={onAdd}
        className="mt-5 w-full sm:w-auto px-5 py-3 rounded-xl2 bg-accent text-ink-950
                   font-semibold active:scale-[0.98] transition"
      >
        Add your first stay
      </button>
    </motion.div>
  )
}
```

- [ ] **Step 6: Write `frontend/src/ui/common/TabBar.jsx`**

```jsx
import { motion } from 'framer-motion'

const TABS = [
  { id: 'tracker', label: 'Tracker', icon: '📈' },
  { id: 'partners', label: 'Partners', icon: '👥' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
]

export default function TabBar({ active, onChange }) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-ink-700 bg-ink-950/90 backdrop-blur safe-b">
      <div className="max-w-2xl mx-auto grid grid-cols-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            aria-current={active === t.id}
            className="relative py-3 flex flex-col items-center gap-1 text-[11px] tracking-wide"
          >
            {active === t.id && (
              <motion.span
                layoutId="tab-underline"
                className="absolute top-0 h-0.5 w-10 rounded-full bg-accent"
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              />
            )}
            <span className={active === t.id ? 'opacity-100' : 'opacity-50'}>{t.icon}</span>
            <span className={active === t.id ? 'text-fog-100' : 'text-fog-700'}>{t.label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}
```

- [ ] **Step 7: Write the three screen stubs and wire `App.jsx`**

`frontend/src/ui/screens/PartnersScreen.jsx`:

```jsx
export default function PartnersScreen() {
  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold tracking-tight">Partners</h2>
      <p className="mt-2 text-sm text-fog-500">Coming in a later task.</p>
    </div>
  )
}
```

`frontend/src/ui/screens/SettingsScreen.jsx`: same structure with the heading `Settings`.

`frontend/src/ui/screens/TrackerScreen.jsx`:

```jsx
import EmptyState from '../common/EmptyState.jsx'

export default function TrackerScreen() {
  return <EmptyState onAdd={() => {}} />
}
```

`frontend/src/App.jsx`:

```jsx
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import TabBar from './ui/common/TabBar.jsx'
import SyncPill from './ui/common/SyncPill.jsx'
import TrackerScreen from './ui/screens/TrackerScreen.jsx'
import PartnersScreen from './ui/screens/PartnersScreen.jsx'
import SettingsScreen from './ui/screens/SettingsScreen.jsx'
import { useOnline } from './sync/useOnline.js'

const SCREENS = {
  tracker: TrackerScreen,
  partners: PartnersScreen,
  settings: SettingsScreen,
}

export default function App() {
  const [tab, setTab] = useState('tracker')
  const online = useOnline()
  const Screen = SCREENS[tab]

  return (
    <div className="min-h-screen bg-ink-950">
      <header className="sticky top-0 z-30 bg-ink-950/85 backdrop-blur border-b border-ink-800 safe-t">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold tracking-tight leading-none">Schengen</h1>
            <p className="text-[11px] text-fog-700 leading-none mt-1">90 days in any 180</p>
          </div>
          <SyncPill state={online ? 'local' : 'offline'} />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-4 pb-28">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <Screen />
          </motion.div>
        </AnimatePresence>
      </main>

      <TabBar active={tab} onChange={setTab} />
    </div>
  )
}
```

- [ ] **Step 8: Verify in the browser**

```bash
cd frontend && npm run dev
```

Expected: three tabs switch with a fade/slide, the underline animates between them, the header shows an "On this device" pill. In DevTools, switch to Offline — the pill must change to "Offline". Check at 390px width (iPhone): nothing overflows horizontally.

- [ ] **Step 9: Commit**

```bash
cd /home/neuadmin/Documents/Schengen-Tracker
git add frontend/src
git commit -m "feat: app shell with tab navigation, modal primitive and offline pill"
```

---

## Task 7: Date range sheet + stay form (kill the empty-date bug)

**Files:**
- Create: `frontend/src/ui/date/MonthGrid.jsx`, `frontend/src/ui/date/DateRangeSheet.jsx`
- Create: `frontend/src/ui/stays/StayForm.jsx`
- Test: `frontend/src/ui/stays/StayForm.test.jsx`

**Interfaces:**
- Consumes: `engine/dates.js`, `db/stays.js` (`createStay`, `updateStay`, `validateStay`), `ui/common/Modal.jsx`.
- Produces:
  - `<DateRangeSheet open value={{ startDate, endDate }} onCancel onConfirm />`
  - `<StayForm open stay onClose />` — `stay = null` means create; otherwise **every field pre-fills from `stay`**

- [ ] **Step 1: Install React Testing Library**

```bash
cd frontend && npm install -D @testing-library/react@^16 @testing-library/user-event@^14 @testing-library/jest-dom@^6
```

Add to `frontend/src/test-setup.js`:

```js
import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 2: Write the failing test — this is the regression guard for the reported bug**

`frontend/src/ui/stays/StayForm.test.jsx`:

```jsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import StayForm from './StayForm.jsx'
import { db } from '../../db/db.js'
import { createStay, listStays } from '../../db/stays.js'

beforeEach(async () => {
  await db.stays.clear()
})

describe('StayForm in edit mode', () => {
  it('pre-fills the name and BOTH dates from the existing stay', async () => {
    const stay = await createStay({
      name: 'Barcelona', country: 'Spain',
      startDate: '2026-07-23', endDate: '2026-07-30',
    })

    render(<StayForm open stay={stay} onClose={() => {}} />)

    expect(screen.getByLabelText(/name/i)).toHaveValue('Barcelona')
    // The bug being killed: dates must be shown, formatted, never empty.
    expect(screen.getByTestId('start-date-value')).toHaveTextContent('23 Jul 2026')
    expect(screen.getByTestId('end-date-value')).toHaveTextContent('30 Jul 2026')
    expect(screen.getByTestId('start-date-value')).not.toHaveTextContent('—')
  })

  it('shows the inclusive duration', async () => {
    const stay = await createStay({
      name: 'Barcelona', startDate: '2026-07-23', endDate: '2026-07-30',
    })
    render(<StayForm open stay={stay} onClose={() => {}} />)
    expect(screen.getByTestId('duration')).toHaveTextContent('8 days')
  })

  it('saves an edited name without touching the dates', async () => {
    const stay = await createStay({
      name: 'Barcelona', startDate: '2026-07-23', endDate: '2026-07-30',
    })
    const onClose = vi.fn()
    render(<StayForm open stay={stay} onClose={onClose} />)

    const name = screen.getByLabelText(/name/i)
    await userEvent.clear(name)
    await userEvent.type(name, 'Girona')
    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    const rows = await listStays()
    expect(rows[0].name).toBe('Girona')
    expect(rows[0].startDate).toBe('2026-07-23')
    expect(rows[0].endDate).toBe('2026-07-30')
    expect(onClose).toHaveBeenCalled()
  })
})

describe('StayForm in create mode', () => {
  it('shows an inline error when the name is blank', async () => {
    render(<StayForm open stay={null} onClose={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(await screen.findByText(/give this stay a name/i)).toBeInTheDocument()
    expect(await listStays()).toHaveLength(0)
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
cd frontend && npx vitest run src/ui/stays/StayForm.test.jsx
```

Expected: FAIL — `Failed to resolve import "./StayForm.jsx"`.

- [ ] **Step 4: Write `frontend/src/ui/date/MonthGrid.jsx`**

```jsx
import { eachDay, formatMonth, parseISO, toISO } from '../../engine/dates.js'

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

/** Days of the month `anchorISO` falls in, padded to whole Monday-start weeks. */
function monthCells(anchorISO) {
  const d = parseISO(anchorISO)
  const first = toISO(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 12)))
  const last = toISO(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 12)))
  const leading = (parseISO(first).getUTCDay() + 6) % 7 // Monday = 0
  const cells = []
  for (let i = 0; i < leading; i++) cells.push(null)
  for (const day of eachDay(first, last)) cells.push(day)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export default function MonthGrid({ anchorISO, startDate, endDate, onPick, todayISODate }) {
  const cells = monthCells(anchorISO)
  return (
    <div>
      <div className="text-sm font-semibold text-fog-300 mb-2">{formatMonth(anchorISO)}</div>
      <div className="grid grid-cols-7 gap-y-1 text-center text-[10px] text-fog-700 mb-1">
        {WEEKDAYS.map((w, i) => <div key={i}>{w}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((iso, i) => {
          if (!iso) return <div key={i} />
          const inRange = startDate && endDate && iso >= startDate && iso <= endDate
          const isEnd = iso === startDate || iso === endDate
          const isToday = iso === todayISODate
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onPick(iso)}
              className={[
                'h-10 text-sm rounded-lg transition num',
                inRange && !isEnd ? 'bg-accent-dim/50 text-fog-100 rounded-none' : '',
                isEnd ? 'bg-accent text-ink-950 font-semibold' : '',
                !inRange && !isEnd ? 'text-fog-300 hover:bg-ink-800' : '',
                isToday && !isEnd ? 'ring-1 ring-inset ring-ink-600' : '',
              ].join(' ')}
            >
              {Number(iso.slice(8, 10))}
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Write `frontend/src/ui/date/DateRangeSheet.jsx`**

```jsx
import { useState } from 'react'
import Modal from '../common/Modal.jsx'
import MonthGrid from './MonthGrid.jsx'
import { addDays, diffDays, formatDisplay, parseISO, toISO, todayISO } from '../../engine/dates.js'

const shiftMonth = (iso, n) => {
  const d = parseISO(iso)
  return toISO(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1, 12)))
}

/**
 * Range picker: first tap sets the start, second tap sets the end. Tapping
 * before the current start restarts the range. There is no native date input
 * anywhere in this app — that is precisely where the reference app's
 * empty-field bug lives.
 */
export default function DateRangeSheet({ open, value, onCancel, onConfirm }) {
  const today = todayISO()
  const [start, setStart] = useState(value?.startDate || null)
  const [end, setEnd] = useState(value?.endDate || null)
  const [anchor, setAnchor] = useState(value?.startDate || today)

  const pick = (iso) => {
    if (!start || end || iso < start) {
      setStart(iso)
      setEnd(null)
    } else {
      setEnd(iso)
    }
  }

  const nights = start && end ? diffDays(start, end) + 1 : 0

  return (
    <Modal open={open} onClose={onCancel} title="Select dates">
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={() => setAnchor(shiftMonth(anchor, -1))}
          className="h-9 w-9 rounded-lg bg-ink-800 text-fog-300">‹</button>
        <div className="text-xs text-fog-500">
          {start ? formatDisplay(start) : 'Pick a start day'}
          {end ? ` → ${formatDisplay(end)}` : ''}
        </div>
        <button type="button" onClick={() => setAnchor(shiftMonth(anchor, 1))}
          className="h-9 w-9 rounded-lg bg-ink-800 text-fog-300">›</button>
      </div>

      <MonthGrid
        anchorISO={anchor}
        startDate={start}
        endDate={end}
        onPick={pick}
        todayISODate={today}
      />

      <div className="mt-4 flex items-center justify-between">
        <span className="text-sm text-fog-500 num">
          {nights ? `${nights} day${nights === 1 ? '' : 's'}` : ' '}
        </span>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel}
            className="px-4 py-2.5 rounded-xl2 bg-ink-800 text-fog-300">Cancel</button>
          <button
            type="button"
            disabled={!start}
            onClick={() => onConfirm({ startDate: start, endDate: end || start })}
            className="px-4 py-2.5 rounded-xl2 bg-accent text-ink-950 font-semibold disabled:opacity-40"
          >
            Use these dates
          </button>
        </div>
      </div>
    </Modal>
  )
}
```

- [ ] **Step 6: Write `frontend/src/ui/stays/StayForm.jsx`**

```jsx
import { useEffect, useState } from 'react'
import Modal from '../common/Modal.jsx'
import DateRangeSheet from '../date/DateRangeSheet.jsx'
import { formatDisplay } from '../../engine/dates.js'
import { stayDuration } from '../../engine/schengen.js'
import { createStay, updateStay, validateStay } from '../../db/stays.js'

/**
 * Add/edit a stay.
 *
 * In edit mode EVERY field initialises from the passed stay — name, country
 * and both dates. State is keyed off `stay.id` so reopening the modal for a
 * different stay always re-seeds. There is no code path that renders an empty
 * date field for an existing stay.
 */
export default function StayForm({ open, stay, onClose }) {
  const [name, setName] = useState('')
  const [country, setCountry] = useState('')
  const [startDate, setStartDate] = useState(null)
  const [endDate, setEndDate] = useState(null)
  const [errors, setErrors] = useState({})
  const [sheetOpen, setSheetOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(stay?.name ?? '')
    setCountry(stay?.country ?? '')
    setStartDate(stay?.startDate ?? null)
    setEndDate(stay?.endDate ?? null)
    setErrors({})
  }, [open, stay?.id])

  const duration =
    startDate && endDate ? stayDuration({ startDate, endDate }) : 0

  async function save() {
    const fields = { name, country: country || null, startDate, endDate }
    const found = validateStay(fields)
    if (Object.keys(found).length) {
      setErrors(found)
      return
    }
    setSaving(true)
    try {
      if (stay) await updateStay(stay.id, fields)
      else await createStay(fields)
      onClose()
    } catch (e) {
      setErrors(e.fieldErrors || { name: e.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title={stay ? 'Edit stay' : 'Add stay'}>
        <div className="space-y-4">
          <div>
            <label htmlFor="stay-name" className="block text-xs text-fog-500 mb-1.5">Name</label>
            <input
              id="stay-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Barcelona"
              className="w-full bg-ink-850 border border-ink-700 rounded-xl2 px-4 py-3
                         text-fog-100 placeholder:text-fog-700 focus:border-accent outline-none"
            />
            {errors.name && <p className="mt-1.5 text-xs text-over">{errors.name}</p>}
          </div>

          <div>
            <label htmlFor="stay-country" className="block text-xs text-fog-500 mb-1.5">
              Country <span className="text-fog-700">(optional)</span>
            </label>
            <input
              id="stay-country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="Spain"
              className="w-full bg-ink-850 border border-ink-700 rounded-xl2 px-4 py-3
                         text-fog-100 placeholder:text-fog-700 focus:border-accent outline-none"
            />
          </div>

          <div>
            <span className="block text-xs text-fog-500 mb-1.5">Dates</span>
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="w-full bg-ink-850 border border-ink-700 rounded-xl2 px-4 py-3 text-left
                         flex items-center justify-between focus:border-accent outline-none"
            >
              <span className="num text-fog-100" data-testid="start-date-value">
                {formatDisplay(startDate)}
              </span>
              <span className="text-fog-700 px-2">→</span>
              <span className="num text-fog-100" data-testid="end-date-value">
                {formatDisplay(endDate)}
              </span>
            </button>
            {(errors.startDate || errors.endDate) && (
              <p className="mt-1.5 text-xs text-over">{errors.startDate || errors.endDate}</p>
            )}
            <p className="mt-1.5 text-xs text-fog-700 num" data-testid="duration">
              {duration ? `${duration} days — entry and exit days both count` : ' '}
            </p>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-3 rounded-xl2 bg-ink-800 text-fog-300">Cancel</button>
            <button type="button" onClick={save} disabled={saving}
              className="flex-1 px-4 py-3 rounded-xl2 bg-accent text-ink-950 font-semibold
                         disabled:opacity-50 active:scale-[0.98] transition">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>

      {sheetOpen && (
        <DateRangeSheet
          open={sheetOpen}
          value={{ startDate, endDate }}
          onCancel={() => setSheetOpen(false)}
          onConfirm={({ startDate: s, endDate: e }) => {
            setStartDate(s)
            setEndDate(e)
            setErrors((prev) => ({ ...prev, startDate: undefined, endDate: undefined }))
            setSheetOpen(false)
          }}
        />
      )}
    </>
  )
}
```

- [ ] **Step 7: Run the tests to verify they pass**

```bash
cd frontend && npx vitest run src/ui/stays/StayForm.test.jsx
```

Expected: all 4 tests PASS. The first test is the permanent guard against the empty-date-on-edit bug.

- [ ] **Step 8: Commit**

```bash
cd /home/neuadmin/Documents/Schengen-Tracker
git add frontend
git commit -m "feat: custom date range sheet and stay form that always pre-fills dates"
```

---

## Task 8: Stay list — compact rows, tap to expand, swipe to delete

**Files:**
- Create: `frontend/src/ui/stays/StayRow.jsx`, `frontend/src/ui/stays/StayList.jsx`
- Modify: `frontend/src/ui/screens/TrackerScreen.jsx`

**Interfaces:**
- Consumes: `db/stays.js`, `engine/dates.js`, `engine/schengen.js`, `engine/palette.js`, `ui/common/Toast.jsx`, `ui/stays/StayForm.jsx`.
- Produces:
  - `<StayList stays colors highlightedId onHighlight onEdit />`
  - `<StayRow stay color expanded highlighted onToggle onEdit onDelete />`
  - `TrackerScreen` now renders live data from Dexie and owns `highlightedId` — the single piece of state that links the list and the graph in both directions.

- [ ] **Step 1: Write `frontend/src/ui/stays/StayRow.jsx`**

```jsx
import { AnimatePresence, motion } from 'framer-motion'
import { formatDisplay } from '../../engine/dates.js'
import { stayDuration } from '../../engine/schengen.js'

/**
 * Compact by default — the list must read as a list, not a giant table.
 * Tap expands; swipe left past the threshold deletes (with undo).
 */
export default function StayRow({
  stay, color, expanded, highlighted, onToggle, onEdit, onDelete,
}) {
  const days = stayDuration(stay)
  return (
    <div className="relative overflow-hidden rounded-xl2">
      <div className="absolute inset-0 bg-over/20 flex items-center justify-end pr-5">
        <span className="text-over text-sm font-semibold">Delete</span>
      </div>

      <motion.div
        drag="x"
        dragConstraints={{ left: -140, right: 0 }}
        dragElastic={0.08}
        onDragEnd={(_, info) => { if (info.offset.x < -100) onDelete(stay) }}
        onMouseEnter={() => onToggle(stay.id, 'hover')}
        className={[
          'relative bg-ink-900 border rounded-xl2 transition-colors',
          highlighted ? 'border-accent' : 'border-ink-700',
        ].join(' ')}
      >
        <button
          type="button"
          onClick={() => onToggle(stay.id, 'tap')}
          className="w-full flex items-center gap-3 px-4 py-3 text-left"
        >
          <span className="h-8 w-1.5 rounded-full shrink-0" style={{ background: color }} />
          <span className="min-w-0 flex-1">
            <span className="block font-medium truncate">{stay.name}</span>
            <span className="block text-xs text-fog-500 num truncate">
              {formatDisplay(stay.startDate)} → {formatDisplay(stay.endDate)}
            </span>
          </span>
          <span className="shrink-0 text-sm num text-fog-300 tabular-nums">{days}d</span>
        </button>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-3 pt-1 flex items-center justify-between border-t border-ink-800">
                <span className="text-xs text-fog-700">
                  {stay.country || 'No country set'}
                </span>
                <span className="flex gap-2">
                  <button onClick={() => onEdit(stay)}
                    className="px-3 py-1.5 rounded-lg bg-ink-800 text-fog-200 text-sm">Edit</button>
                  <button onClick={() => onDelete(stay)}
                    className="px-3 py-1.5 rounded-lg bg-over/15 text-over text-sm">Delete</button>
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
```

- [ ] **Step 2: Write `frontend/src/ui/stays/StayList.jsx`**

```jsx
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import StayRow from './StayRow.jsx'

export default function StayList({ stays, colors, highlightedId, onHighlight, onEdit, onDelete }) {
  const [expandedId, setExpandedId] = useState(null)

  const toggle = (id, source) => {
    if (source === 'hover') return onHighlight(id)
    setExpandedId((cur) => (cur === id ? null : id))
    onHighlight(id)
  }

  return (
    <div
      className="space-y-2"
      onMouseLeave={() => onHighlight(null)}
    >
      <AnimatePresence initial={false}>
        {stays.map((s) => (
          <motion.div
            key={s.id}
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.2 }}
          >
            <StayRow
              stay={s}
              color={colors[s.id]}
              expanded={expandedId === s.id}
              highlighted={highlightedId === s.id}
              onToggle={toggle}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
```

- [ ] **Step 3: Rewrite `frontend/src/ui/screens/TrackerScreen.jsx` to use live data**

```jsx
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { motion } from 'framer-motion'
import { listStays, softDeleteStay, restoreStay } from '../../db/stays.js'
import { colorMap } from '../../engine/palette.js'
import EmptyState from '../common/EmptyState.jsx'
import Toast from '../common/Toast.jsx'
import StayList from '../stays/StayList.jsx'
import StayForm from '../stays/StayForm.jsx'

export default function TrackerScreen() {
  const stays = useLiveQuery(() => listStays(), [], null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [highlightedId, setHighlightedId] = useState(null)
  const [undo, setUndo] = useState(null)

  if (stays === null) return <div className="h-40 rounded-xl2 bg-ink-900 animate-pulse" />

  const colors = colorMap(stays)

  const openAdd = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (stay) => { setEditing(stay); setFormOpen(true) }

  const remove = async (stay) => {
    await softDeleteStay(stay.id)
    setUndo(stay)
  }

  return (
    <div className="space-y-4">
      {stays.length === 0 ? (
        <EmptyState onAdd={openAdd} />
      ) : (
        <>
          {/* Graph slots in here in Task 9 — above the values, per the spec. */}
          <section>
            <h2 className="text-xs uppercase tracking-widest text-fog-700 mb-2 px-1">
              Your stays
            </h2>
            <StayList
              stays={stays}
              colors={colors}
              highlightedId={highlightedId}
              onHighlight={setHighlightedId}
              onEdit={openEdit}
              onDelete={remove}
            />
          </section>
        </>
      )}

      {stays.length > 0 && (
        <motion.button
          onClick={openAdd}
          className="fixed right-5 bottom-24 z-40 h-14 w-14 rounded-full bg-accent text-ink-950
                     text-2xl font-light shadow-lift grid place-items-center"
          whileTap={{ scale: 0.92 }}
          aria-label="Add stay"
        >
          +
        </motion.button>
      )}

      <StayForm open={formOpen} stay={editing} onClose={() => setFormOpen(false)} />

      <Toast
        message={undo ? `Deleted “${undo.name}”` : null}
        actionLabel="Undo"
        onAction={async () => { await restoreStay(undo.id); setUndo(null) }}
        onDismiss={() => setUndo(null)}
      />
    </div>
  )
}
```

- [ ] **Step 4: Verify in the browser**

```bash
cd frontend && npm run dev
```

Check, at 390px width with DevTools set to Offline:
1. Empty state appears with the "no account, no internet" copy.
2. Add a stay `Barcelona`, `23 Jul 2026 → 30 Jul 2026`. The row shows `23 Jul 2026 → 30 Jul 2026` and `8d`.
3. Tap the row → it expands. Tap **Edit** → **both dates are pre-filled**. This is the bug the whole task exists to kill.
4. Swipe the row left past ~100px → it deletes and an Undo toast appears. Tap Undo → the row returns.
5. Reload the page → the stay is still there (IndexedDB persisted).

- [ ] **Step 5: Run the full test suite and commit**

```bash
cd frontend && npm test
```

Expected: all suites pass.

```bash
cd /home/neuadmin/Documents/Schengen-Tracker
git add frontend/src
git commit -m "feat: reactive stay list with tap-to-expand, swipe-to-delete and undo"
```

---

## Task 9: The compliance graph

**Files:**
- Create: `frontend/src/ui/graph/SummaryTiles.jsx`, `frontend/src/ui/graph/TripRibbon.jsx`, `frontend/src/ui/graph/ComplianceGraph.jsx`
- Modify: `frontend/src/ui/screens/TrackerScreen.jsx`

**Interfaces:**
- Consumes: `engine/schengen.js` (`buildSeries`, `graphRange`, `usageOn`, `buildPresence`, `statusOf`, `remainingOn`, `LIMIT_DAYS`), `engine/dates.js` (`epochDay`, `fromEpochDay`, `formatShort`, `todayISO`), `engine/palette.js`.
- Produces:
  - `<SummaryTiles used remaining status />`
  - `<ComplianceGraph stays colors highlightedId onHighlight />`
  - `TripRibbon` — a Recharts `<Customized>` renderer, so it shares the chart's exact x-scale rather than approximating it.

- [ ] **Step 1: Write `frontend/src/ui/graph/SummaryTiles.jsx`**

```jsx
import { motion } from 'framer-motion'
import { LIMIT_DAYS } from '../../engine/schengen.js'

const STATUS = {
  compliant: { label: 'Compliant', cls: 'text-ok', dot: 'bg-ok' },
  warning: { label: 'Getting close', cls: 'text-warn', dot: 'bg-warn' },
  over: { label: 'Over the limit', cls: 'text-over', dot: 'bg-over' },
}

export default function SummaryTiles({ used, remaining, status }) {
  const s = STATUS[status]
  return (
    <div className="grid grid-cols-3 gap-2">
      <Tile label="Days used" value={used} suffix={`/ ${LIMIT_DAYS}`} />
      <Tile label="Days left" value={remaining} />
      <motion.div
        key={status}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="card px-3 py-3 flex flex-col justify-between"
      >
        <span className="text-[10px] uppercase tracking-widest text-fog-700">Status</span>
        <span className={`mt-1 inline-flex items-center gap-1.5 text-sm font-semibold ${s.cls}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
          {s.label}
        </span>
      </motion.div>
    </div>
  )
}

function Tile({ label, value, suffix }) {
  return (
    <div className="card px-3 py-3">
      <span className="block text-[10px] uppercase tracking-widest text-fog-700">{label}</span>
      <span className="mt-1 block num text-2xl font-semibold tracking-tight leading-none">
        {value}
        {suffix && <span className="text-sm text-fog-700 font-normal ml-1">{suffix}</span>}
      </span>
    </div>
  )
}
```

- [ ] **Step 2: Write `frontend/src/ui/graph/TripRibbon.jsx`**

```jsx
import { epochDay } from '../../engine/dates.js'

/**
 * The labelled trip ribbon.
 *
 * Rendered as a Recharts <Customized> child so it receives the chart's real
 * xAxisMap and can use the SAME scale function the areas use. Approximating
 * the scale by hand would drift by a few pixels and quietly break the
 * "this band is that trip" promise the whole design rests on.
 */
export default function TripRibbon(props) {
  const { xAxisMap, offset, stays, colors, highlightedId, onHighlight, rowHeight = 14 } = props
  const axis = xAxisMap && Object.values(xAxisMap)[0]
  if (!axis || !offset) return null
  const scale = axis.scale

  // Lay trips out in lanes so overlapping trips never sit on top of each other.
  const lanes = []
  const placed = stays.map((s) => {
    const x1 = scale(epochDay(s.startDate))
    const x2 = scale(epochDay(s.endDate))
    let lane = lanes.findIndex((end) => x1 > end + 6)
    if (lane === -1) { lane = lanes.length; lanes.push(0) }
    lanes[lane] = x2
    return { stay: s, x1, x2, lane }
  })

  const top = offset.top + offset.height + 10

  return (
    <g>
      {placed.map(({ stay, x1, x2, lane }) => {
        const w = Math.max(3, x2 - x1)
        const dim = highlightedId && highlightedId !== stay.id
        const y = top + lane * (rowHeight + 4)
        return (
          <g
            key={stay.id}
            opacity={dim ? 0.28 : 1}
            style={{ cursor: 'pointer', transition: 'opacity 160ms' }}
            onMouseEnter={() => onHighlight(stay.id)}
            onMouseLeave={() => onHighlight(null)}
            onClick={() => onHighlight(stay.id)}
          >
            <rect x={x1} y={y} width={w} height={rowHeight} rx={rowHeight / 2}
              fill={colors[stay.id]} />
            {w > 46 && (
              <text x={x1 + 8} y={y + rowHeight - 3.5} fontSize={10} fill="#0A0C10"
                fontWeight="600" style={{ pointerEvents: 'none' }}>
                {stay.name.length > 14 ? `${stay.name.slice(0, 13)}…` : stay.name}
              </text>
            )}
            {w <= 46 && (
              <text x={x2 + 5} y={y + rowHeight - 3.5} fontSize={10} fill="#8B94A5"
                style={{ pointerEvents: 'none' }}>
                {stay.name.length > 12 ? `${stay.name.slice(0, 11)}…` : stay.name}
              </text>
            )}
          </g>
        )
      })}
    </g>
  )
}

/** Height the chart must reserve below the plot for the ribbon lanes. */
export function ribbonHeight(stays) {
  if (!stays.length) return 0
  // Worst case is one lane per overlapping group; 3 lanes covers realistic use
  // and the chart simply clips beyond that.
  const lanes = Math.min(3, stays.length)
  return 10 + lanes * 18
}
```

- [ ] **Step 3: Write `frontend/src/ui/graph/ComplianceGraph.jsx`**

```jsx
import { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Area, ComposedChart, Customized, ReferenceLine, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts'
import { buildSeries, graphRange, LIMIT_DAYS } from '../../engine/schengen.js'
import { epochDay, fromEpochDay, formatDisplay, formatShort, todayISO } from '../../engine/dates.js'
import TripRibbon, { ribbonHeight } from './TripRibbon.jsx'

/**
 * The rolling 90/180 curve, drawn as STACKED PER-TRIP BANDS.
 *
 * The rolling total is mathematically the sum of each trip's contribution to
 * the window, so stacking the per-trip series reproduces the true curve
 * exactly — Barcelona's band IS the portion of the curve Barcelona drives.
 */
export default function ComplianceGraph({ stays, colors, highlightedId, onHighlight }) {
  const today = todayISO()

  const { points, range, step } = useMemo(() => {
    const r = graphRange(stays, today)
    // Keep the point count sane on long histories; tiles always use exact math.
    const span = Math.abs(epochDay(r.to) - epochDay(r.from))
    const s = span > 900 ? 3 : span > 450 ? 2 : 1
    return { points: buildSeries(stays, r.from, r.to, s).points, range: r, step: s }
  }, [stays, today])

  const ribbon = ribbonHeight(stays)
  const todayT = epochDay(today)

  return (
    <motion.div
      className="card p-3 pb-2"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <ResponsiveContainer width="100%" height={230 + ribbon}>
        <ComposedChart
          data={points}
          margin={{ top: 8, right: 8, left: -18, bottom: ribbon + 4 }}
          onMouseLeave={() => onHighlight(null)}
        >
          <defs>
            <linearGradient id="overShade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF6B6B" stopOpacity={0.14} />
              <stop offset="100%" stopColor="#FF6B6B" stopOpacity={0} />
            </linearGradient>
          </defs>

          <XAxis
            dataKey="t"
            type="number"
            scale="linear"
            domain={[epochDay(range.from), epochDay(range.to)]}
            tickFormatter={(t) => formatShort(fromEpochDay(t))}
            tick={{ fill: '#5B6474', fontSize: 10 }}
            axisLine={{ stroke: '#232A36' }}
            tickLine={false}
            minTickGap={44}
          />
          <YAxis
            domain={[0, (max) => Math.max(100, Math.ceil(max / 10) * 10)]}
            tick={{ fill: '#5B6474', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={38}
          />

          <ReferenceLine
            y={LIMIT_DAYS}
            stroke="#FF6B6B"
            strokeDasharray="5 4"
            label={{ value: '90-day limit', position: 'insideTopRight', fill: '#FF6B6B', fontSize: 10 }}
          />
          <ReferenceLine
            x={todayT}
            stroke="#8B94A5"
            strokeDasharray="3 3"
            label={{ value: 'today', position: 'insideTopLeft', fill: '#8B94A5', fontSize: 10 }}
          />

          {stays.map((s) => (
            <Area
              key={s.id}
              type="stepAfter"
              dataKey={`s_${s.id}`}
              stackId="usage"
              stroke={colors[s.id]}
              strokeWidth={highlightedId === s.id ? 1.6 : 0.6}
              fill={colors[s.id]}
              fillOpacity={highlightedId && highlightedId !== s.id ? 0.14 : 0.62}
              isAnimationActive={false}
              onMouseEnter={() => onHighlight(s.id)}
              activeDot={false}
            />
          ))}

          <Tooltip
            cursor={{ stroke: '#2E3644' }}
            content={<GraphTooltip stays={stays} colors={colors} />}
          />

          <Customized
            component={(props) => (
              <TripRibbon
                {...props}
                stays={stays}
                colors={colors}
                highlightedId={highlightedId}
                onHighlight={onHighlight}
              />
            )}
          />
        </ComposedChart>
      </ResponsiveContainer>

      <p className="px-1 pt-1 text-[10px] text-fog-700 leading-relaxed">
        Each colour is one trip. A band's thickness is how many of that trip's days still
        count in the 180-day window on that date.
        {step > 1 && ' Sampled for display; the figures above are exact.'}
      </p>
    </motion.div>
  )
}

function GraphTooltip({ active, payload, label, stays, colors }) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  const contributing = stays
    .map((s) => ({ s, v: point[`s_${s.id}`] || 0 }))
    .filter((x) => x.v > 0)
    .sort((a, b) => b.v - a.v)

  return (
    <div className="bg-ink-850 border border-ink-600 rounded-xl px-3 py-2 shadow-lift">
      <div className="text-xs text-fog-500 num">{formatDisplay(point.date)}</div>
      <div className="mt-1 text-sm font-semibold num">
        {point.total} <span className="text-fog-500 font-normal">of 90 days used</span>
      </div>
      <div className="text-xs text-fog-500 num">{point.remaining} days left</div>
      {contributing.length > 0 && (
        <div className="mt-2 space-y-0.5 border-t border-ink-700 pt-1.5">
          {contributing.slice(0, 5).map(({ s, v }) => (
            <div key={s.id} className="flex items-center gap-2 text-xs">
              <span className="h-2 w-2 rounded-sm" style={{ background: colors[s.id] }} />
              <span className="flex-1 truncate text-fog-300">{s.name}</span>
              <span className="num text-fog-500">{v}d</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Wire the graph and tiles into `TrackerScreen.jsx`**

Add these imports at the top of `frontend/src/ui/screens/TrackerScreen.jsx`:

```jsx
import { buildPresence, usageOn, remainingOn, statusOf } from '../../engine/schengen.js'
import { todayISO } from '../../engine/dates.js'
import SummaryTiles from '../graph/SummaryTiles.jsx'
import ComplianceGraph from '../graph/ComplianceGraph.jsx'
```

Immediately after `const colors = colorMap(stays)`, add the exact (unsampled) figures:

```jsx
  const today = todayISO()
  const used = usageOn(buildPresence(stays), today)
  const remaining = remainingOn(used)
  const status = statusOf(used)
```

Replace the `<>...</>` branch (the non-empty case) with:

```jsx
        <>
          <SummaryTiles used={used} remaining={remaining} status={status} />

          <ComplianceGraph
            stays={stays}
            colors={colors}
            highlightedId={highlightedId}
            onHighlight={setHighlightedId}
          />

          <section>
            <h2 className="text-xs uppercase tracking-widest text-fog-700 mb-2 px-1">
              Your stays
            </h2>
            <StayList
              stays={stays}
              colors={colors}
              highlightedId={highlightedId}
              onHighlight={setHighlightedId}
              onEdit={openEdit}
              onDelete={remove}
            />
          </section>
        </>
```

Order is fixed by the spec: **tiles → graph → compact list**.

- [ ] **Step 5: Verify the graph in the browser**

```bash
cd frontend && npm run dev
```

Enter three stays and check each of these:

| Stay | Dates |
|---|---|
| Lisbon | 05 Feb 2026 → 20 Feb 2026 |
| Paris | 10 Apr 2026 → 05 May 2026 |
| Barcelona | 23 Jul 2026 → 30 Jul 2026 |

1. The curve rises in three stacked colours matching the three list rows.
2. The dashed red 90-day line and the grey "today" line are both visible.
3. The trip ribbon sits under the plot, each band aligned with the x-position of its trip.
4. Hovering a list row dims all other bands **and** the other ribbon segments. Hovering a ribbon segment highlights it too.
5. The tooltip shows the date, total used, days left, and the per-trip breakdown.
6. At 390px width there is **no horizontal scrolling**.
7. Sanity-check the arithmetic: with only Barcelona (23–30 Jul), the tiles read `8` used and `82` left on 30 Jul 2026.

- [ ] **Step 6: Commit**

```bash
cd /home/neuadmin/Documents/Schengen-Tracker
git add frontend/src
git commit -m "feat: stacked per-trip compliance graph with linked trip ribbon"
```

---

## Task 10: PDF — in-app preview, then export

**Files:**
- Create: `frontend/src/pdf/chartToPng.js`, `frontend/src/pdf/ReportDocument.jsx`, `frontend/src/ui/screens/PdfScreen.jsx`
- Modify: `frontend/src/App.jsx` (PDF button in the header), `frontend/src/ui/screens/TrackerScreen.jsx` (expose the chart node)
- Test: `frontend/src/pdf/chartToPng.test.js`

**Interfaces:**
- Consumes: `engine/schengen.js`, `engine/dates.js`, the rendered chart SVG.
- Produces:
  - `svgToPngDataUrl(svgEl, { width, height, background }): Promise<string>`
  - `<ReportDocument stays chartPng used remaining status generatedOn />` — one component used for BOTH preview and download
  - `<PdfScreen stays chartRef onClose />`

- [ ] **Step 1: Write `frontend/src/pdf/chartToPng.js`**

```js
/**
 * Serialise a live SVG node to a PNG data URL, entirely offline.
 *
 * @react-pdf/renderer cannot consume a raw SVG string, and the spec forbids any
 * network round-trip, so the chart is rasterised locally: SVG → data URL →
 * <img> → <canvas> → PNG. Colours must be present as SVG attributes (they are:
 * the chart passes every fill and stroke as a prop) because external CSS does
 * not apply inside a serialised SVG.
 */
export function svgToPngDataUrl(svgEl, { scale = 2, background = '#0F1216' } = {}) {
  return new Promise((resolve, reject) => {
    if (!svgEl) return reject(new Error('No chart to export'))

    const rect = svgEl.getBoundingClientRect()
    const width = Math.max(1, Math.round(rect.width || Number(svgEl.getAttribute('width')) || 600))
    const height = Math.max(1, Math.round(rect.height || Number(svgEl.getAttribute('height')) || 300))

    const clone = svgEl.cloneNode(true)
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    clone.setAttribute('width', String(width))
    clone.setAttribute('height', String(height))

    const svgText = new XMLSerializer().serializeToString(clone)
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`

    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = width * scale
        canvas.height = height * scale
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = background
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/png'))
      } catch (e) {
        reject(e)
      }
    }
    img.onerror = () => reject(new Error('Could not rasterise the chart'))
    img.src = url
  })
}
```

- [ ] **Step 2: Write the failing test**

`frontend/src/pdf/chartToPng.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { svgToPngDataUrl } from './chartToPng.js'

describe('svgToPngDataUrl', () => {
  it('rejects clearly when there is no chart', async () => {
    await expect(svgToPngDataUrl(null)).rejects.toThrow(/no chart/i)
  })
})
```

jsdom has no canvas rasteriser, so the happy path is verified in the browser in Step 6 rather than in Vitest. The guard above keeps the error contract honest.

- [ ] **Step 3: Run the test**

```bash
cd frontend && npx vitest run src/pdf/chartToPng.test.js
```

Expected: PASS.

- [ ] **Step 4: Write `frontend/src/pdf/ReportDocument.jsx`**

```jsx
import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { formatDisplay } from '../engine/dates.js'
import { stayDuration, LIMIT_DAYS } from '../engine/schengen.js'

const s = StyleSheet.create({
  page: { backgroundColor: '#0F1216', color: '#EEF1F6', padding: 32, fontSize: 10 },
  h1: { fontSize: 18, marginBottom: 2 },
  sub: { fontSize: 9, color: '#8B94A5', marginBottom: 16 },
  tiles: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tile: { flex: 1, borderWidth: 1, borderColor: '#232A36', borderRadius: 8, padding: 10 },
  tileLabel: { fontSize: 7, color: '#5B6474', letterSpacing: 1, marginBottom: 4 },
  tileValue: { fontSize: 16 },
  chart: { width: '100%', height: 200, marginBottom: 18 },
  sectionTitle: { fontSize: 8, color: '#5B6474', letterSpacing: 1, marginBottom: 6 },
  row: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#1A1F29',
    paddingVertical: 6, alignItems: 'center',
  },
  head: { borderBottomColor: '#2E3644', color: '#8B94A5', fontSize: 8 },
  cName: { flex: 3 }, cCountry: { flex: 2, color: '#8B94A5' },
  cDate: { flex: 3 }, cDays: { flex: 1, textAlign: 'right' },
  foot: { position: 'absolute', bottom: 24, left: 32, right: 32, fontSize: 7, color: '#5B6474' },
})

const STATUS_TEXT = {
  compliant: 'Compliant',
  warning: 'Getting close to the limit',
  over: 'Over the limit',
}
const STATUS_COLOR = { compliant: '#3DD68C', warning: '#F5B84B', over: '#FF6B6B' }

/** One component drives BOTH the in-app preview and the downloaded file. */
export default function ReportDocument({
  stays, chartPng, used, remaining, status, generatedOn, referenceDate,
}) {
  return (
    <Document title="Schengen 90/180 report">
      <Page size="A4" style={s.page}>
        <Text style={s.h1}>Schengen 90/180 report</Text>
        <Text style={s.sub}>
          Rolling window ending {formatDisplay(referenceDate)} · both entry and exit days count
        </Text>

        <View style={s.tiles}>
          <View style={s.tile}>
            <Text style={s.tileLabel}>DAYS USED</Text>
            <Text style={s.tileValue}>{used} / {LIMIT_DAYS}</Text>
          </View>
          <View style={s.tile}>
            <Text style={s.tileLabel}>DAYS LEFT</Text>
            <Text style={s.tileValue}>{remaining}</Text>
          </View>
          <View style={s.tile}>
            <Text style={s.tileLabel}>STATUS</Text>
            <Text style={[s.tileValue, { color: STATUS_COLOR[status], fontSize: 11 }]}>
              {STATUS_TEXT[status]}
            </Text>
          </View>
        </View>

        {chartPng ? <Image src={chartPng} style={s.chart} /> : null}

        <Text style={s.sectionTitle}>STAYS</Text>
        <View style={[s.row, s.head]}>
          <Text style={s.cName}>Name</Text>
          <Text style={s.cCountry}>Country</Text>
          <Text style={s.cDate}>Dates</Text>
          <Text style={s.cDays}>Days</Text>
        </View>
        {stays.map((stay) => (
          <View key={stay.id} style={s.row}>
            <Text style={s.cName}>{stay.name}</Text>
            <Text style={s.cCountry}>{stay.country || '—'}</Text>
            <Text style={s.cDate}>
              {formatDisplay(stay.startDate)} → {formatDisplay(stay.endDate)}
            </Text>
            <Text style={s.cDays}>{stayDuration(stay)}</Text>
          </View>
        ))}

        <Text style={s.foot} fixed>
          Generated {generatedOn} · Schengen Tracker · This report is an aid, not legal advice.
        </Text>
      </Page>
    </Document>
  )
}
```

- [ ] **Step 5: Write `frontend/src/ui/screens/PdfScreen.jsx`**

```jsx
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { BlobProvider, PDFDownloadLink } from '@react-pdf/renderer'
import ReportDocument from '../../pdf/ReportDocument.jsx'
import { svgToPngDataUrl } from '../../pdf/chartToPng.js'
import { formatDisplay, todayISO } from '../../engine/dates.js'
import { buildPresence, usageOn, remainingOn, statusOf } from '../../engine/schengen.js'

/**
 * Preview first, download second — never a forced download to see the report.
 * The preview is an iframe over a locally generated blob URL, so it needs no
 * network. iOS Safari renders only the first page inside an iframe; the
 * "Open" link is the escape hatch there.
 */
export default function PdfScreen({ stays, chartSvg, onClose }) {
  const [chartPng, setChartPng] = useState(null)
  const [error, setError] = useState(null)

  const today = todayISO()
  const used = usageOn(buildPresence(stays), today)
  const doc = (
    <ReportDocument
      stays={stays}
      chartPng={chartPng}
      used={used}
      remaining={remainingOn(used)}
      status={statusOf(used)}
      referenceDate={today}
      generatedOn={formatDisplay(today)}
    />
  )

  useEffect(() => {
    let cancelled = false
    svgToPngDataUrl(chartSvg)
      .then((png) => { if (!cancelled) setChartPng(png) })
      .catch(() => { if (!cancelled) setError('The chart could not be added — the rest of the report is fine.') })
    return () => { cancelled = true }
  }, [chartSvg])

  return (
    <motion.div
      className="fixed inset-0 z-50 bg-ink-950 flex flex-col"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.22 }}
    >
      <header className="safe-t px-4 h-14 flex items-center justify-between border-b border-ink-800">
        <button onClick={onClose} className="text-fog-300 px-2 py-1">Close</button>
        <span className="text-sm font-semibold">PDF report</span>
        <span className="w-14" />
      </header>

      {error && <p className="px-4 py-2 text-xs text-warn">{error}</p>}

      <div className="flex-1 min-h-0 p-3">
        <BlobProvider document={doc}>
          {({ url, loading, error: blobError }) => {
            if (loading) return <div className="h-full rounded-xl2 bg-ink-900 animate-pulse" />
            if (blobError || !url) {
              return (
                <div className="card p-6 text-center text-sm text-over">
                  The report could not be generated. Close and try again.
                </div>
              )
            }
            return (
              <iframe
                title="PDF preview"
                src={url}
                className="w-full h-full rounded-xl2 bg-ink-900 border border-ink-700"
              />
            )
          }}
        </BlobProvider>
      </div>

      <div className="p-4 safe-b border-t border-ink-800 flex gap-2">
        <BlobProvider document={doc}>
          {({ url }) =>
            url ? (
              <a href={url} target="_blank" rel="noreferrer"
                className="flex-1 text-center px-4 py-3 rounded-xl2 bg-ink-800 text-fog-200">
                Open
              </a>
            ) : <span className="flex-1" />
          }
        </BlobProvider>
        <PDFDownloadLink
          document={doc}
          fileName={`schengen-${today}.pdf`}
          className="flex-1 text-center px-4 py-3 rounded-xl2 bg-accent text-ink-950 font-semibold"
        >
          {({ loading }) => (loading ? 'Preparing…' : 'Download')}
        </PDFDownloadLink>
      </div>
    </motion.div>
  )
}
```

- [ ] **Step 6: Wire the PDF button into the Tracker**

In `frontend/src/ui/screens/TrackerScreen.jsx`, add imports and a ref:

```jsx
import { useRef } from 'react'
import PdfScreen from './PdfScreen.jsx'
```

Inside the component, add:

```jsx
  const chartWrapRef = useRef(null)
  const [pdfOpen, setPdfOpen] = useState(false)
```

Wrap the `<ComplianceGraph .../>` element in a div carrying the ref:

```jsx
          <div ref={chartWrapRef}>
            <ComplianceGraph
              stays={stays}
              colors={colors}
              highlightedId={highlightedId}
              onHighlight={setHighlightedId}
            />
          </div>
```

Add a report button just after the `</section>` that closes the stay list:

```jsx
          <button
            onClick={() => setPdfOpen(true)}
            className="w-full px-4 py-3 rounded-xl2 border border-ink-700 text-fog-300 text-sm"
          >
            Preview PDF report
          </button>
```

And render the screen at the end of the returned tree, before the closing `</div>`:

```jsx
      {pdfOpen && (
        <PdfScreen
          stays={stays}
          chartSvg={chartWrapRef.current?.querySelector('svg') || null}
          onClose={() => setPdfOpen(false)}
        />
      )}
```

- [ ] **Step 7: Verify offline in the browser**

```bash
cd frontend && npm run dev
```

With DevTools set to **Offline**:
1. Tap "Preview PDF report" — the PDF renders inside the app, no download triggered.
2. The report shows the chart image, the three tiles, every stay with `DD MMM YYYY` dates and inclusive day counts, and a generated-on date.
3. Tap **Download** — the file saves. Open it: it matches the preview.

- [ ] **Step 8: Commit**

```bash
cd /home/neuadmin/Documents/Schengen-Tracker
git add frontend/src
git commit -m "feat: offline client-side PDF with in-app preview before download"
```

---

## Task 11: PHP backend — router, database, auth

**Files:**
- Create: `backend/index.php`, `backend/lib/json.php`, `backend/lib/db.php`, `backend/lib/auth.php`, `backend/api/auth.php`
- Create: `backend/schema.sql`, `backend/schema.mysql.sql`
- Create: `backend/.gitignore`

**Interfaces:**
- Consumes: nothing from the frontend.
- Produces:
  - `GET /api/health` → `{ ok: true }`
  - `POST /api/auth/register` `{ email, password, displayName? }` → `{ token, user }`
  - `POST /api/auth/login` `{ email, password }` → `{ token, user }`
  - `POST /api/auth/logout` → `{ ok: true }`
  - `GET /api/auth/me` → `{ user }`
  - PHP helpers `db()`, `send($data, $code)`, `fail($msg, $code)`, `body()`, `requireUser()`

- [ ] **Step 1: Write `backend/schema.sql` (SQLite)**

```sql
-- Schengen Tracker — SQLite schema.
-- Column types are deliberately conservative so the MySQL port is a 1:1 mapping.

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name  TEXT,
  settings      TEXT NOT NULL DEFAULT '{}',
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tokens (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_tokens_user ON tokens(user_id);

CREATE TABLE IF NOT EXISTS stays (
  id         TEXT PRIMARY KEY,          -- client-generated UUID
  owner_id   TEXT NOT NULL,
  name       TEXT NOT NULL,
  country    TEXT,
  start_date TEXT NOT NULL,             -- YYYY-MM-DD
  end_date   TEXT NOT NULL,             -- YYYY-MM-DD
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,             -- drives last-write-wins
  deleted    INTEGER NOT NULL DEFAULT 0,
  seq        INTEGER NOT NULL,          -- monotonic server cursor, clock-skew proof
  FOREIGN KEY (owner_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_stays_owner_seq ON stays(owner_id, seq);

CREATE TABLE IF NOT EXISTS partnerships (
  id            TEXT PRIMARY KEY,
  from_user_id  TEXT NOT NULL,
  to_email      TEXT NOT NULL,
  to_user_id    TEXT,                   -- NULL until accepted
  status        TEXT NOT NULL,          -- pending | accepted | declined | revoked
  sharing_level TEXT NOT NULL,          -- graph_only | full
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  FOREIGN KEY (from_user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_partnerships_from ON partnerships(from_user_id);
CREATE INDEX IF NOT EXISTS idx_partnerships_to ON partnerships(to_user_id);
CREATE INDEX IF NOT EXISTS idx_partnerships_email ON partnerships(to_email);
```

- [ ] **Step 2: Write `backend/schema.mysql.sql`**

```sql
-- Schengen Tracker — MySQL port. Same shape, MySQL-native types.

CREATE TABLE IF NOT EXISTS users (
  id            CHAR(36) PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name  VARCHAR(255),
  settings      TEXT NOT NULL,
  created_at    CHAR(24) NOT NULL,
  updated_at    CHAR(24) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tokens (
  id         CHAR(36) PRIMARY KEY,
  user_id    CHAR(36) NOT NULL,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  created_at CHAR(24) NOT NULL,
  expires_at CHAR(24) NOT NULL,
  INDEX idx_tokens_user (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS stays (
  id         CHAR(36) PRIMARY KEY,
  owner_id   CHAR(36) NOT NULL,
  name       VARCHAR(255) NOT NULL,
  country    VARCHAR(255),
  start_date CHAR(10) NOT NULL,
  end_date   CHAR(10) NOT NULL,
  created_at CHAR(24) NOT NULL,
  updated_at CHAR(24) NOT NULL,
  deleted    TINYINT NOT NULL DEFAULT 0,
  seq        BIGINT NOT NULL,
  INDEX idx_stays_owner_seq (owner_id, seq),
  FOREIGN KEY (owner_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS partnerships (
  id            CHAR(36) PRIMARY KEY,
  from_user_id  CHAR(36) NOT NULL,
  to_email      VARCHAR(255) NOT NULL,
  to_user_id    CHAR(36),
  status        VARCHAR(16) NOT NULL,
  sharing_level VARCHAR(16) NOT NULL,
  created_at    CHAR(24) NOT NULL,
  updated_at    CHAR(24) NOT NULL,
  INDEX idx_partnerships_from (from_user_id),
  INDEX idx_partnerships_to (to_user_id),
  INDEX idx_partnerships_email (to_email),
  FOREIGN KEY (from_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

- [ ] **Step 3: Write `backend/lib/json.php`**

```php
<?php
declare(strict_types=1);

/** JSON request/response plumbing and CORS. */

function cors(): void
{
    // The frontend is a static single-file app that may be served from
    // anywhere — including file:// — so the origin is echoed rather than fixed.
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Max-Age: 86400');
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

function send(array $data, int $code = 200): never
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function fail(string $message, int $code = 400, array $extra = []): never
{
    send(['error' => $message] + $extra, $code);
}

/** Decoded JSON request body, always an array. */
function body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        fail('Request body must be a JSON object', 400);
    }
    return $decoded;
}

function uuid(): string
{
    $b = random_bytes(16);
    $b[6] = chr((ord($b[6]) & 0x0f) | 0x40);
    $b[8] = chr((ord($b[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($b), 4));
}

/** ISO-8601 UTC with milliseconds, matching the JavaScript client exactly. */
function isoNow(): string
{
    return (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d\TH:i:s.v\Z');
}
```

- [ ] **Step 4: Write `backend/lib/db.php`**

```php
<?php
declare(strict_types=1);

/**
 * PDO factory and migration runner.
 *
 * SQLite is the default. Point SCHENGEN_DB_DSN at MySQL to switch drivers —
 * every query in this codebase is portable ANSI SQL, and the two schema files
 * are 1:1 ports of each other.
 */
function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $dsn = getenv('SCHENGEN_DB_DSN') ?: 'sqlite:' . __DIR__ . '/../data/app.sqlite';
    $user = getenv('SCHENGEN_DB_USER') ?: null;
    $pass = getenv('SCHENGEN_DB_PASS') ?: null;

    if (str_starts_with($dsn, 'sqlite:')) {
        $path = substr($dsn, 7);
        $dir = dirname($path);
        if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
            fail('Cannot create the database directory', 500);
        }
    }

    try {
        $pdo = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    } catch (PDOException $e) {
        fail('Database unavailable', 500);
    }

    if ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite') {
        $pdo->exec('PRAGMA foreign_keys = ON');
        $pdo->exec('PRAGMA journal_mode = WAL');
    }

    migrate($pdo);
    return $pdo;
}

function migrate(PDO $pdo): void
{
    $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
    $file = __DIR__ . '/../' . ($driver === 'mysql' ? 'schema.mysql.sql' : 'schema.sql');
    $sql = file_get_contents($file);
    if ($sql === false) {
        fail('Schema file missing', 500);
    }
    foreach (array_filter(array_map('trim', explode(';', $sql))) as $statement) {
        if ($statement !== '') {
            $pdo->exec($statement);
        }
    }
}

/**
 * Next monotonic cursor for a stays write.
 *
 * A server-side counter rather than a timestamp: clients set their own
 * `updated_at`, so a skewed client clock must never be able to hide a row from
 * another device's pull.
 */
function nextSeq(PDO $pdo): int
{
    $row = $pdo->query('SELECT COALESCE(MAX(seq), 0) + 1 AS n FROM stays')->fetch();
    return (int) $row['n'];
}
```

- [ ] **Step 5: Write `backend/lib/auth.php`**

```php
<?php
declare(strict_types=1);

const TOKEN_TTL_DAYS = 90;

function issueToken(PDO $pdo, string $userId): string
{
    $token = bin2hex(random_bytes(32));
    $expires = (new DateTimeImmutable('now', new DateTimeZone('UTC')))
        ->modify('+' . TOKEN_TTL_DAYS . ' days')
        ->format('Y-m-d\TH:i:s.v\Z');

    $stmt = $pdo->prepare(
        'INSERT INTO tokens (id, user_id, token_hash, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?)'
    );
    // Tokens are high-entropy random values, so a fast hash is correct here —
    // password_hash is for low-entropy secrets and would only slow every request.
    $stmt->execute([uuid(), $userId, hash('sha256', $token), isoNow(), $expires]);

    return $token;
}

function currentUser(PDO $pdo): ?array
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (!preg_match('/^Bearer\s+([a-f0-9]{64})$/i', $header, $m)) {
        return null;
    }
    $stmt = $pdo->prepare(
        'SELECT u.* FROM tokens t
         JOIN users u ON u.id = t.user_id
         WHERE t.token_hash = ? AND t.expires_at > ?'
    );
    $stmt->execute([hash('sha256', $m[1]), isoNow()]);
    $user = $stmt->fetch();
    return $user === false ? null : $user;
}

function requireUser(PDO $pdo): array
{
    $user = currentUser($pdo);
    if ($user === null) {
        fail('Not signed in', 401);
    }
    return $user;
}

function publicUser(array $row): array
{
    return [
        'id' => $row['id'],
        'email' => $row['email'],
        'displayName' => $row['display_name'],
        'settings' => json_decode($row['settings'] ?: '{}', true),
    ];
}
```

- [ ] **Step 6: Write `backend/api/auth.php`**

```php
<?php
declare(strict_types=1);

function handleRegister(PDO $pdo): never
{
    $in = body();
    $email = strtolower(trim((string) ($in['email'] ?? '')));
    $password = (string) ($in['password'] ?? '');
    $displayName = trim((string) ($in['displayName'] ?? ''));

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        fail('Enter a valid email address', 422, ['field' => 'email']);
    }
    if (strlen($password) < 8) {
        fail('Password must be at least 8 characters', 422, ['field' => 'password']);
    }

    $exists = $pdo->prepare('SELECT id FROM users WHERE email = ?');
    $exists->execute([$email]);
    if ($exists->fetch() !== false) {
        fail('An account with that email already exists', 409, ['field' => 'email']);
    }

    $id = uuid();
    $ts = isoNow();
    $stmt = $pdo->prepare(
        'INSERT INTO users (id, email, password_hash, display_name, settings, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $id, $email, password_hash($password, PASSWORD_DEFAULT),
        $displayName ?: null, json_encode(['defaultSharingLevel' => 'graph_only']), $ts, $ts,
    ]);

    // A pending invite addressed to this email is bound to the new account.
    $claim = $pdo->prepare(
        'UPDATE partnerships SET to_user_id = ?, updated_at = ? WHERE to_email = ? AND to_user_id IS NULL'
    );
    $claim->execute([$id, $ts, $email]);

    $user = $pdo->prepare('SELECT * FROM users WHERE id = ?');
    $user->execute([$id]);

    send(['token' => issueToken($pdo, $id), 'user' => publicUser($user->fetch())], 201);
}

function handleLogin(PDO $pdo): never
{
    $in = body();
    $email = strtolower(trim((string) ($in['email'] ?? '')));
    $password = (string) ($in['password'] ?? '');

    $stmt = $pdo->prepare('SELECT * FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    // One message for both cases: never reveal whether an email is registered.
    if ($user === false || !password_verify($password, $user['password_hash'])) {
        fail('Email or password is incorrect', 401);
    }

    send(['token' => issueToken($pdo, $user['id']), 'user' => publicUser($user)]);
}

function handleLogout(PDO $pdo): never
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/^Bearer\s+([a-f0-9]{64})$/i', $header, $m)) {
        $stmt = $pdo->prepare('DELETE FROM tokens WHERE token_hash = ?');
        $stmt->execute([hash('sha256', $m[1])]);
    }
    send(['ok' => true]);
}

function handleMe(PDO $pdo): never
{
    send(['user' => publicUser(requireUser($pdo))]);
}
```

- [ ] **Step 7: Write `backend/index.php` and `backend/.gitignore`**

`backend/.gitignore`:

```
data/
```

`backend/index.php`:

```php
<?php
declare(strict_types=1);

/**
 * Front controller. Also serves as the router script for PHP's built-in server:
 *   php -S 127.0.0.1:8080 backend/index.php
 */

require __DIR__ . '/lib/json.php';
require __DIR__ . '/lib/db.php';
require __DIR__ . '/lib/auth.php';
require __DIR__ . '/lib/sharing.php';
require __DIR__ . '/api/auth.php';
require __DIR__ . '/api/sync.php';
require __DIR__ . '/api/partners.php';

cors();

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$path = '/' . trim($path, '/');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

set_exception_handler(static function (Throwable $e): void {
    error_log((string) $e);
    send(['error' => 'Server error'], 500);
});

$pdo = db();

if ($path === '/api/health' && $method === 'GET') {
    send(['ok' => true, 'driver' => $pdo->getAttribute(PDO::ATTR_DRIVER_NAME)]);
}

$routes = [
    'POST /api/auth/register' => fn() => handleRegister($pdo),
    'POST /api/auth/login'    => fn() => handleLogin($pdo),
    'POST /api/auth/logout'   => fn() => handleLogout($pdo),
    'GET /api/auth/me'        => fn() => handleMe($pdo),
    'POST /api/sync'          => fn() => handleSync($pdo),
    'POST /api/partners/invite'  => fn() => handleInvite($pdo),
    'POST /api/partners/respond' => fn() => handleRespond($pdo),
    'POST /api/partners/revoke'  => fn() => handleRevoke($pdo),
    'POST /api/partners/sharing' => fn() => handleSetSharing($pdo),
    'GET /api/partners'          => fn() => handleListPartners($pdo),
];

$key = "$method $path";
if (isset($routes[$key])) {
    $routes[$key]();
}

if (preg_match('#^/api/partners/([0-9a-f-]{36})/tracking$#i', $path, $m) && $method === 'GET') {
    handlePartnerTracking($pdo, $m[1]);
}

fail('Not found', 404);
```

`index.php` requires `sync.php`, `partners.php` and `sharing.php`, which arrive in
Tasks 12 and 14. Create them as stubs now so the router loads:

```bash
mkdir -p backend/api backend/lib
printf '<?php\ndeclare(strict_types=1);\n// Implemented in Task 12.\n' > backend/api/sync.php
printf '<?php\ndeclare(strict_types=1);\n// Implemented in Task 14.\n' > backend/api/partners.php
printf '<?php\ndeclare(strict_types=1);\n// Implemented in Task 14.\n' > backend/lib/sharing.php
```

The route closures reference functions that do not exist yet. PHP only resolves a
closure's body when it is called, so the file parses fine — but hitting one of those
routes would fatal. Comment them out for now, leaving exactly this in `$routes`:

```php
$routes = [
    'POST /api/auth/register' => fn() => handleRegister($pdo),
    'POST /api/auth/login'    => fn() => handleLogin($pdo),
    'POST /api/auth/logout'   => fn() => handleLogout($pdo),
    'GET /api/auth/me'        => fn() => handleMe($pdo),
    // Task 12: 'POST /api/sync' => fn() => handleSync($pdo),
    // Task 14: partner routes
];
```

Also comment out the `handlePartnerTracking` `preg_match` block. Task 12 restores the
sync line; Task 14 restores the rest.

- [ ] **Step 8: Verify auth end-to-end with curl**

```bash
cd /home/neuadmin/Documents/Schengen-Tracker
php -S 127.0.0.1:8080 backend/index.php &
sleep 1
curl -s http://127.0.0.1:8080/api/health
```

Expected: `{"ok":true,"driver":"sqlite"}`.

```bash
curl -s -X POST http://127.0.0.1:8080/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"a@example.com","password":"correct-horse","displayName":"A"}'
```

Expected: `{"token":"<64 hex chars>","user":{"id":"…","email":"a@example.com",…}}`.

```bash
TOKEN=$(curl -s -X POST http://127.0.0.1:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"a@example.com","password":"correct-horse"}' | grep -o '"token":"[a-f0-9]*"' | cut -d'"' -f4)
echo "token length: ${#TOKEN}"
curl -s http://127.0.0.1:8080/api/auth/me -H "Authorization: Bearer $TOKEN"
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8080/api/auth/me
curl -s -X POST http://127.0.0.1:8080/api/auth/login \
  -H 'Content-Type: application/json' -d '{"email":"a@example.com","password":"wrong"}'
```

Expected: token length `64`; `me` returns the user; the unauthenticated call returns `401`; the wrong password returns `{"error":"Email or password is incorrect"}`.

Confirm the password is not stored in the clear:

```bash
php -r '$p=new PDO("sqlite:backend/data/app.sqlite"); var_dump($p->query("SELECT password_hash FROM users")->fetchColumn());'
```

Expected: a `$2y$`- or `$argon`-prefixed hash, never `correct-horse`.

Stop the server: `kill %1`.

- [ ] **Step 9: Commit**

```bash
git add backend
git commit -m "feat: PHP backend with SQLite schema, router and token auth"
```

---

## Task 12: Delta sync endpoint

**Files:**
- Create (replace the stub): `backend/api/sync.php`
- Modify: `backend/index.php` (uncomment the `/api/sync` route)

**Interfaces:**
- Consumes: `db()`, `requireUser()`, `nextSeq()`.
- Produces: `POST /api/sync`
  - Request: `{ lastSeq: number|null, changes: Stay[] }`
  - Response: `{ serverSeq: number, changes: Stay[], applied: number, skipped: number }`
  - Semantics: each incoming stay is written only when its `updatedAt` is strictly newer than the stored row's (or the row is new). The response carries every row for this owner with `seq > lastSeq`.

- [ ] **Step 1: Write `backend/api/sync.php`**

```php
<?php
declare(strict_types=1);

/**
 * Delta sync: push client changes, pull server changes.
 *
 * Conflict resolution is last-write-wins on the client-authored `updated_at`.
 * The PULL cursor is the server-side `seq` counter, NOT a timestamp: a client
 * with a skewed clock must not be able to write a row that other devices never
 * see. Deletes travel as tombstones (deleted = 1), never as row removal.
 */

function stayToJson(array $r): array
{
    return [
        'id' => $r['id'],
        'name' => $r['name'],
        'country' => $r['country'],
        'startDate' => $r['start_date'],
        'endDate' => $r['end_date'],
        'createdAt' => $r['created_at'],
        'updatedAt' => $r['updated_at'],
        'deleted' => (bool) (int) $r['deleted'],
        'ownerId' => $r['owner_id'],
    ];
}

function validStayPayload(array $s): bool
{
    $iso = '/^\d{4}-\d{2}-\d{2}$/';
    return is_string($s['id'] ?? null)
        && preg_match('/^[0-9a-f-]{36}$/i', $s['id']) === 1
        && is_string($s['name'] ?? null) && trim($s['name']) !== ''
        && preg_match($iso, (string) ($s['startDate'] ?? '')) === 1
        && preg_match($iso, (string) ($s['endDate'] ?? '')) === 1
        && (string) $s['endDate'] >= (string) $s['startDate']
        && is_string($s['updatedAt'] ?? null)
        && is_string($s['createdAt'] ?? null);
}

function handleSync(PDO $pdo): never
{
    $user = requireUser($pdo);
    $in = body();
    $lastSeq = isset($in['lastSeq']) ? (int) $in['lastSeq'] : 0;
    $changes = is_array($in['changes'] ?? null) ? $in['changes'] : [];

    if (count($changes) > 2000) {
        fail('Too many changes in one batch', 413);
    }

    $applied = 0;
    $skipped = 0;
    $rejected = [];

    $pdo->beginTransaction();
    try {
        $find = $pdo->prepare('SELECT updated_at FROM stays WHERE id = ? AND owner_id = ?');
        $insert = $pdo->prepare(
            'INSERT INTO stays (id, owner_id, name, country, start_date, end_date,
                                created_at, updated_at, deleted, seq)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $update = $pdo->prepare(
            'UPDATE stays SET name = ?, country = ?, start_date = ?, end_date = ?,
                              updated_at = ?, deleted = ?, seq = ?
             WHERE id = ? AND owner_id = ?'
        );

        foreach ($changes as $s) {
            if (!is_array($s) || !validStayPayload($s)) {
                $rejected[] = is_array($s) ? ($s['id'] ?? null) : null;
                continue;
            }

            $find->execute([$s['id'], $user['id']]);
            $existing = $find->fetchColumn();

            // Last-write-wins. Equal timestamps are a no-op, keeping sync idempotent.
            if ($existing !== false && (string) $existing >= (string) $s['updatedAt']) {
                $skipped++;
                continue;
            }

            $seq = nextSeq($pdo);
            $deleted = !empty($s['deleted']) ? 1 : 0;

            if ($existing === false) {
                $insert->execute([
                    $s['id'], $user['id'], trim($s['name']), $s['country'] ?? null,
                    $s['startDate'], $s['endDate'], $s['createdAt'], $s['updatedAt'],
                    $deleted, $seq,
                ]);
            } else {
                $update->execute([
                    trim($s['name']), $s['country'] ?? null, $s['startDate'], $s['endDate'],
                    $s['updatedAt'], $deleted, $seq, $s['id'], $user['id'],
                ]);
            }
            $applied++;
        }

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }

    $pull = $pdo->prepare('SELECT * FROM stays WHERE owner_id = ? AND seq > ? ORDER BY seq ASC');
    $pull->execute([$user['id'], $lastSeq]);
    $rows = $pull->fetchAll();

    $cursor = $pdo->prepare('SELECT COALESCE(MAX(seq), 0) AS n FROM stays WHERE owner_id = ?');
    $cursor->execute([$user['id']]);

    send([
        'serverSeq' => (int) $cursor->fetch()['n'],
        'changes' => array_map('stayToJson', $rows),
        'applied' => $applied,
        'skipped' => $skipped,
        'rejected' => array_values(array_filter($rejected)),
    ]);
}
```

- [ ] **Step 2: Uncomment the sync route in `backend/index.php`**

Ensure this line is active in the `$routes` array:

```php
    'POST /api/sync'          => fn() => handleSync($pdo),
```

- [ ] **Step 3: Verify push, pull, LWW and tombstones with curl**

```bash
cd /home/neuadmin/Documents/Schengen-Tracker
rm -f backend/data/app.sqlite*
php -S 127.0.0.1:8080 backend/index.php > /tmp/php-server.log 2>&1 &
sleep 1
TOKEN=$(curl -s -X POST http://127.0.0.1:8080/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"a@example.com","password":"correct-horse"}' \
  | grep -o '"token":"[a-f0-9]*"' | cut -d'"' -f4)

# Push one stay.
curl -s -X POST http://127.0.0.1:8080/api/sync \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"lastSeq":0,"changes":[{"id":"11111111-1111-4111-8111-111111111111","name":"Barcelona","country":"Spain","startDate":"2026-07-23","endDate":"2026-07-30","createdAt":"2026-07-01T10:00:00.000Z","updatedAt":"2026-07-01T10:00:00.000Z","deleted":false}]}'
```

Expected: `"applied":1`, `"serverSeq":1`, and the pushed stay echoed in `changes`.

```bash
# A STALE update must be rejected (older updatedAt).
curl -s -X POST http://127.0.0.1:8080/api/sync \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"lastSeq":1,"changes":[{"id":"11111111-1111-4111-8111-111111111111","name":"STALE","country":null,"startDate":"2026-07-23","endDate":"2026-07-30","createdAt":"2026-07-01T10:00:00.000Z","updatedAt":"2026-06-01T10:00:00.000Z","deleted":false}]}'
```

Expected: `"applied":0,"skipped":1` and an empty `changes` array.

```bash
# A NEWER update wins.
curl -s -X POST http://127.0.0.1:8080/api/sync \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"lastSeq":1,"changes":[{"id":"11111111-1111-4111-8111-111111111111","name":"Girona","country":"Spain","startDate":"2026-07-23","endDate":"2026-07-30","createdAt":"2026-07-01T10:00:00.000Z","updatedAt":"2026-07-05T10:00:00.000Z","deleted":false}]}'

# A tombstone propagates.
curl -s -X POST http://127.0.0.1:8080/api/sync \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"lastSeq":2,"changes":[{"id":"11111111-1111-4111-8111-111111111111","name":"Girona","country":"Spain","startDate":"2026-07-23","endDate":"2026-07-30","createdAt":"2026-07-01T10:00:00.000Z","updatedAt":"2026-07-06T10:00:00.000Z","deleted":true}]}'

# A second device pulls everything from scratch.
curl -s -X POST http://127.0.0.1:8080/api/sync \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"lastSeq":0,"changes":[]}'

# Rubbish is rejected, not stored.
curl -s -X POST http://127.0.0.1:8080/api/sync \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"lastSeq":0,"changes":[{"id":"nope","name":"","startDate":"2026-13-99","endDate":"2020-01-01"}]}'
```

Expected: `Girona` applied; the tombstone applied with `"deleted":true`; the from-scratch pull returns the single row with `"name":"Girona","deleted":true`; the rubbish batch returns `"applied":0` with the id listed under `rejected`.

Verify no other user can read those rows:

```bash
TOKEN2=$(curl -s -X POST http://127.0.0.1:8080/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"b@example.com","password":"correct-horse"}' \
  | grep -o '"token":"[a-f0-9]*"' | cut -d'"' -f4)
curl -s -X POST http://127.0.0.1:8080/api/sync \
  -H "Authorization: Bearer $TOKEN2" -H 'Content-Type: application/json' \
  -d '{"lastSeq":0,"changes":[]}'
```

Expected: `"changes":[]` — owner scoping holds.

Stop the server: `kill %1`.

- [ ] **Step 4: Commit**

```bash
git add backend
git commit -m "feat: delta sync endpoint with last-write-wins and tombstones"
```

---

## Task 13: Frontend sync client, auth UI and claim-on-login

**Files:**
- Create: `frontend/src/sync/api.js`, `frontend/src/sync/client.js`, `frontend/src/sync/useSync.js`
- Rewrite: `frontend/src/ui/screens/SettingsScreen.jsx`
- Modify: `frontend/src/App.jsx` (real sync state in the pill)
- Test: `frontend/src/sync/client.test.js`

**Interfaces:**
- Consumes: `db/meta.js`, `db/stays.js` (`allStaysRaw`, `upsertFromServer`), `db/db.js`.
- Produces:
  - `apiFetch(path, { method, body, token, apiUrl }): Promise<{ ok, status, data, error }>` — **never throws**
  - `syncNow(): Promise<{ status: 'synced'|'offline'|'unauthenticated'|'error', pushed, pulled }>`
  - `claimLocalStays(userId): Promise<number>` — assigns `ownerId` to anonymous stays and resets the cursor
  - `login/register/logout` wrappers that persist `token`, `userId` in `meta`
  - `useSync(): { state, count, sync, signedIn, user }`
  - Meta keys: `apiUrl`, `token`, `userId`, `lastSeq`, `lastPushedAt`

- [ ] **Step 1: Write `frontend/src/sync/api.js`**

```js
import { getMeta } from '../db/meta.js'

/**
 * The single network boundary.
 *
 * It NEVER throws and never rejects: an unreachable backend is a normal state
 * for this app, indistinguishable from being offline. Callers branch on
 * `ok`/`error`, so no UI path can be blocked by a failed request.
 */
export async function apiFetch(path, { method = 'GET', body, token, apiUrl, timeoutMs = 8000 } = {}) {
  const base = apiUrl ?? (await getMeta('apiUrl', null))
  if (!base) return { ok: false, status: 0, data: null, error: 'no-api-url' }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`${base.replace(/\/$/, '')}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    const text = await res.text()
    let data = null
    try { data = text ? JSON.parse(text) : null } catch { data = null }
    return {
      ok: res.ok,
      status: res.status,
      data,
      error: res.ok ? null : (data?.error || `HTTP ${res.status}`),
    }
  } catch (e) {
    return { ok: false, status: 0, data: null, error: e.name === 'AbortError' ? 'timeout' : 'unreachable' }
  } finally {
    clearTimeout(timer)
  }
}
```

- [ ] **Step 2: Write the failing test**

`frontend/src/sync/client.test.js`:

```js
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { db } from '../db/db.js'
import { createStay, listStays, allStaysRaw } from '../db/stays.js'
import { getMeta, setMeta } from '../db/meta.js'
import { syncNow, claimLocalStays } from './client.js'

beforeEach(async () => {
  await db.stays.clear()
  await db.meta.clear()
  await setMeta('apiUrl', 'http://127.0.0.1:8080')
})

afterEach(() => { vi.unstubAllGlobals() })

const mockFetch = (payload, ok = true, status = 200) =>
  vi.fn().mockResolvedValue({
    ok, status, text: async () => JSON.stringify(payload),
  })

describe('syncNow', () => {
  it('does nothing without an account', async () => {
    const r = await syncNow()
    expect(r.status).toBe('unauthenticated')
  })

  it('reports offline instead of throwing when the server is unreachable', async () => {
    await setMeta('token', 'x'.repeat(64))
    await setMeta('userId', 'u1')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    const r = await syncNow()
    expect(r.status).toBe('offline')
  })

  it('pushes local changes and applies pulled ones', async () => {
    await setMeta('token', 'x'.repeat(64))
    await setMeta('userId', 'u1')
    await createStay({ name: 'Local', startDate: '2026-07-01', endDate: '2026-07-05' })

    const remote = {
      id: '22222222-2222-4222-8222-222222222222',
      name: 'FromServer', country: null,
      startDate: '2026-08-01', endDate: '2026-08-04',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-02T00:00:00.000Z',
      deleted: false, ownerId: 'u1',
    }
    const fetchMock = mockFetch({ serverSeq: 7, changes: [remote], applied: 1, skipped: 0 })
    vi.stubGlobal('fetch', fetchMock)

    const r = await syncNow()
    expect(r.status).toBe('synced')
    expect(r.pushed).toBe(1)

    const sent = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(sent.changes).toHaveLength(1)
    expect(sent.changes[0].name).toBe('Local')

    expect((await listStays()).map((s) => s.name).sort()).toEqual(['FromServer', 'Local'])
    expect(await getMeta('lastSeq', 0)).toBe(7)
  })

  it('sends only records changed since the last push', async () => {
    await setMeta('token', 'x'.repeat(64))
    await setMeta('userId', 'u1')
    await createStay({ name: 'Old', startDate: '2026-07-01', endDate: '2026-07-05' })
    await setMeta('lastPushedAt', new Date(Date.now() + 60000).toISOString())

    const fetchMock = mockFetch({ serverSeq: 1, changes: [], applied: 0, skipped: 0 })
    vi.stubGlobal('fetch', fetchMock)
    await syncNow()

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).changes).toHaveLength(0)
  })
})

describe('claimLocalStays', () => {
  it('assigns ownerId to anonymous stays and forces a full push', async () => {
    await createStay({ name: 'Anon', startDate: '2026-07-01', endDate: '2026-07-05' })
    await setMeta('lastSeq', 42)
    await setMeta('lastPushedAt', '2030-01-01T00:00:00.000Z')

    const claimed = await claimLocalStays('user-9')
    expect(claimed).toBe(1)

    const rows = await allStaysRaw()
    expect(rows[0].ownerId).toBe('user-9')
    // Cursors reset so nothing entered offline can be missed on the first sync.
    expect(await getMeta('lastSeq', 0)).toBe(0)
    expect(await getMeta('lastPushedAt', null)).toBe(null)
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
cd frontend && npx vitest run src/sync/client.test.js
```

Expected: FAIL — `Failed to resolve import "./client.js"`.

- [ ] **Step 4: Write `frontend/src/sync/client.js`**

```js
import { db } from '../db/db.js'
import { getMeta, setMeta, clearMeta } from '../db/meta.js'
import { allStaysRaw, upsertFromServer } from '../db/stays.js'
import { apiFetch } from './api.js'

/**
 * Delta sync client.
 *
 * PUSH set: every stay with `updatedAt > lastPushedAt` — the stays table is its
 * own outbox. PULL cursor: the server's `seq`, immune to client clock skew.
 * Conflicts resolve last-write-wins inside `upsertFromServer`.
 */
export async function syncNow() {
  const token = await getMeta('token', null)
  const userId = await getMeta('userId', null)
  if (!token || !userId) return { status: 'unauthenticated', pushed: 0, pulled: 0 }

  const lastSeq = await getMeta('lastSeq', 0)
  const lastPushedAt = await getMeta('lastPushedAt', null)

  const all = await allStaysRaw()
  const changes = all.filter((s) => !lastPushedAt || s.updatedAt > lastPushedAt)
  const startedAt = new Date().toISOString()

  const res = await apiFetch('/api/sync', {
    method: 'POST',
    token,
    body: { lastSeq, changes },
  })

  if (!res.ok) {
    if (res.status === 401) return { status: 'unauthenticated', pushed: 0, pulled: 0 }
    return { status: 'offline', pushed: 0, pulled: 0, error: res.error }
  }

  let pulled = 0
  for (const remote of res.data?.changes || []) {
    if ((await upsertFromServer(remote)) === 'applied') pulled++
  }

  await setMeta('lastSeq', res.data?.serverSeq ?? lastSeq)
  await setMeta('lastPushedAt', startedAt)

  return { status: 'synced', pushed: changes.length, pulled }
}

/** How many local records are waiting to go up. Drives the "N pending" pill. */
export async function pendingCount() {
  const lastPushedAt = await getMeta('lastPushedAt', null)
  if (!lastPushedAt) return (await allStaysRaw()).length
  return (await allStaysRaw()).filter((s) => s.updatedAt > lastPushedAt).length
}

/**
 * Claim everything entered anonymously.
 *
 * Cursors reset so the first sync after signing in pushes the entire local
 * history — nothing entered on a plane can be missed.
 */
export async function claimLocalStays(userId) {
  const rows = await allStaysRaw()
  const orphans = rows.filter((s) => s.ownerId !== userId)
  await db.stays.bulkPut(orphans.map((s) => ({ ...s, ownerId: userId })))
  await setMeta('lastSeq', 0)
  await clearMeta('lastPushedAt')
  return orphans.length
}

export async function register({ email, password, displayName }) {
  const res = await apiFetch('/api/auth/register', {
    method: 'POST',
    body: { email, password, displayName },
  })
  if (!res.ok) return res
  await adoptSession(res.data)
  return res
}

export async function login({ email, password }) {
  const res = await apiFetch('/api/auth/login', { method: 'POST', body: { email, password } })
  if (!res.ok) return res
  await adoptSession(res.data)
  return res
}

async function adoptSession({ token, user }) {
  await setMeta('token', token)
  await setMeta('userId', user.id)
  await setMeta('user', user)
  await claimLocalStays(user.id)
  await syncNow()
}

/** Local data deliberately SURVIVES logout — the user keeps seeing their stays. */
export async function logout() {
  const token = await getMeta('token', null)
  if (token) await apiFetch('/api/auth/logout', { method: 'POST', token })
  await clearMeta('token', 'userId', 'user', 'lastSeq', 'lastPushedAt')
}
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd frontend && npx vitest run src/sync/client.test.js
```

Expected: all 5 tests PASS.

- [ ] **Step 6: Write `frontend/src/sync/useSync.js`**

```js
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getMeta } from '../db/meta.js'
import { db } from '../db/db.js'
import { pendingCount, syncNow } from './client.js'
import { useOnline } from './useOnline.js'

/**
 * Background sync. Nothing here ever blocks rendering: the UI reads IndexedDB,
 * and this only pushes bytes around in the background.
 */
export function useSync() {
  const online = useOnline()
  const [state, setState] = useState('local')
  const [count, setCount] = useState(0)
  const running = useRef(false)

  const session = useLiveQuery(async () => ({
    token: await getMeta('token', null),
    user: await getMeta('user', null),
  }), [], undefined)

  const signedIn = Boolean(session?.token)

  const sync = useCallback(async () => {
    if (running.current) return
    running.current = true
    setState('syncing')
    const result = await syncNow()
    running.current = false
    setState(
      result.status === 'synced' ? 'synced'
        : result.status === 'unauthenticated' ? 'local'
          : 'pending',
    )
    setCount(await pendingCount())
  }, [])

  // Flush the queue the moment connectivity returns — the hotel-wifi moment.
  useEffect(() => {
    if (!signedIn) { setState(online ? 'local' : 'offline'); return }
    if (!online) { setState('offline'); return }
    sync()
  }, [online, signedIn, sync])

  // Any local write while signed in becomes pending until the next flush.
  const stayCount = useLiveQuery(() => db.stays.count(), [], 0)
  useEffect(() => {
    if (!signedIn) return
    let cancelled = false
    pendingCount().then((n) => {
      if (cancelled) return
      setCount(n)
      if (n > 0 && online) sync()
      else if (n > 0) setState('pending')
    })
    return () => { cancelled = true }
  }, [stayCount, signedIn, online, sync])

  return { state, count, sync, signedIn, user: session?.user ?? null }
}
```

- [ ] **Step 7: Rewrite `frontend/src/ui/screens/SettingsScreen.jsx`**

```jsx
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getMeta, setMeta } from '../../db/meta.js'
import { login, register, logout, syncNow } from '../../sync/client.js'
import { apiFetch } from '../../sync/api.js'

export default function SettingsScreen() {
  const stored = useLiveQuery(async () => ({
    apiUrl: await getMeta('apiUrl', ''),
    user: await getMeta('user', null),
  }), [], undefined)

  const [apiUrl, setApiUrl] = useState('')
  const [probe, setProbe] = useState(null)
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => { if (stored) setApiUrl(stored.apiUrl || '') }, [stored?.apiUrl])

  if (stored === undefined) return <div className="h-40 rounded-xl2 bg-ink-900 animate-pulse" />

  async function saveUrl() {
    await setMeta('apiUrl', apiUrl.trim())
    setProbe('checking')
    const res = await apiFetch('/api/health', { apiUrl: apiUrl.trim() })
    setProbe(res.ok ? 'reachable' : 'unreachable')
  }

  async function submit() {
    setBusy(true)
    setMessage(null)
    const fn = mode === 'login' ? login : register
    const res = await fn({ email, password })
    setBusy(false)
    if (!res.ok) {
      setMessage(
        res.error === 'no-api-url' ? 'Set your server address first.'
          : res.error === 'unreachable' || res.error === 'timeout'
            ? 'Cannot reach that server. Your data is safe on this device.'
            : res.error,
      )
      return
    }
    setPassword('')
    setMessage('Signed in. Your existing stays have been added to this account.')
  }

  return (
    <div className="space-y-4">
      <section className="card p-5">
        <h2 className="text-sm font-semibold tracking-tight">Account</h2>
        <p className="mt-1 text-xs text-fog-500 leading-relaxed">
          Optional. Everything already works on this device without one — an account
          only adds sync between devices and sharing with a partner.
        </p>

        {stored.user ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm">
              Signed in as <span className="text-accent">{stored.user.email}</span>
            </p>
            <div className="flex gap-2">
              <button onClick={() => syncNow()}
                className="flex-1 px-4 py-3 rounded-xl2 bg-ink-800 text-fog-200 text-sm">
                Sync now
              </button>
              <button onClick={() => logout()}
                className="flex-1 px-4 py-3 rounded-xl2 bg-ink-800 text-fog-200 text-sm">
                Sign out
              </button>
            </div>
            <p className="text-xs text-fog-700">
              Signing out keeps every stay on this device.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="flex gap-1 p-1 bg-ink-850 rounded-xl2">
              {['login', 'register'].map((m) => (
                <button key={m} onClick={() => setMode(m)}
                  className={`flex-1 py-2 rounded-lg text-sm ${
                    mode === m ? 'bg-ink-700 text-fog-100' : 'text-fog-500'}`}>
                  {m === 'login' ? 'Sign in' : 'Create account'}
                </button>
              ))}
            </div>
            <input value={email} onChange={(e) => setEmail(e.target.value)}
              type="email" inputMode="email" autoComplete="email" placeholder="you@example.com"
              className="w-full bg-ink-850 border border-ink-700 rounded-xl2 px-4 py-3 outline-none focus:border-accent" />
            <input value={password} onChange={(e) => setPassword(e.target.value)}
              type="password" autoComplete="current-password" placeholder="Password (min 8 characters)"
              className="w-full bg-ink-850 border border-ink-700 rounded-xl2 px-4 py-3 outline-none focus:border-accent" />
            <button onClick={submit} disabled={busy}
              className="w-full px-4 py-3 rounded-xl2 bg-accent text-ink-950 font-semibold disabled:opacity-50">
              {busy ? 'Working…' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </div>
        )}
        {message && <p className="mt-3 text-xs text-fog-300">{message}</p>}
      </section>

      <section className="card p-5">
        <h2 className="text-sm font-semibold tracking-tight">Server address</h2>
        <p className="mt-1 text-xs text-fog-500 leading-relaxed">
          Only needed for sync and partner sharing. Leave it empty to stay fully local.
        </p>
        <input value={apiUrl} onChange={(e) => setApiUrl(e.target.value)}
          placeholder="http://127.0.0.1:8080" inputMode="url" autoCapitalize="off"
          className="mt-3 w-full bg-ink-850 border border-ink-700 rounded-xl2 px-4 py-3 outline-none focus:border-accent" />
        <button onClick={saveUrl}
          className="mt-2 w-full px-4 py-3 rounded-xl2 bg-ink-800 text-fog-200 text-sm">
          Save and test
        </button>
        {probe && (
          <p className={`mt-2 text-xs ${probe === 'reachable' ? 'text-ok' : probe === 'checking' ? 'text-fog-500' : 'text-warn'}`}>
            {probe === 'reachable' ? 'Server reachable.'
              : probe === 'checking' ? 'Checking…'
                : 'Not reachable right now — the app keeps working offline.'}
          </p>
        )}
      </section>
    </div>
  )
}
```

- [ ] **Step 8: Wire the real sync state into `App.jsx`**

Replace the `useOnline` import and usage in `frontend/src/App.jsx`:

```jsx
import { useSync } from './sync/useSync.js'
```

```jsx
  const { state, count } = useSync()
```

```jsx
          <SyncPill state={state} count={count} />
```

- [ ] **Step 9: Verify the airplane→hotel-wifi flow by hand**

```bash
cd /home/neuadmin/Documents/Schengen-Tracker
php -S 127.0.0.1:8080 backend/index.php > /tmp/php-server.log 2>&1 &
cd frontend && npm run dev
```

1. **On the plane:** DevTools → Offline. Add two stays. The pill reads "Offline". Everything works.
2. Settings → server address `http://127.0.0.1:8080` → "Save and test" → still offline, so it reports "Not reachable right now" without breaking anything.
3. **Hotel wifi:** DevTools → Online. Settings → Create account. The message confirms the existing stays were added to the account.
4. Confirm on the server that both stays arrived:
   ```bash
   php -r '$p=new PDO("sqlite:backend/data/app.sqlite"); foreach($p->query("SELECT name,start_date,end_date FROM stays") as $r) echo implode(" ", $r), PHP_EOL;'
   ```
   Expected: both stays listed with their correct dates.
5. Sign out → the stays are **still visible** locally. Sign back in → no duplicates appear (client-generated UUIDs merged them).
6. Go offline again, edit a stay → the pill shows "1 pending". Go online → it flips to "Synced" on its own.

- [ ] **Step 10: Run the full test suite and commit**

```bash
cd frontend && npm test
```

Expected: all suites pass.

```bash
cd /home/neuadmin/Documents/Schengen-Tracker
git add frontend/src
git commit -m "feat: background delta sync with claim-on-login and account UI"
```

---

## Task 14: Partnerships backend with server-enforced privacy

**Files:**
- Create (replace the stubs): `backend/lib/sharing.php`, `backend/api/partners.php`
- Modify: `backend/index.php` (uncomment the partner routes)

**Interfaces:**
- Consumes: `db()`, `requireUser()`, `stayToJson()`.
- Produces:
  - `POST /api/partners/invite` `{ email, sharingLevel? }` → `{ partnership }`
  - `POST /api/partners/respond` `{ id, accept: bool }` → `{ partnership }`
  - `POST /api/partners/revoke` `{ id }` → `{ ok: true }`
  - `POST /api/partners/sharing` `{ id, sharingLevel }` → `{ partnership }`
  - `GET /api/partners` → `{ outgoing: [], incoming: [] }`
  - `GET /api/partners/{id}/tracking` → `graph_only`: `{ sharingLevel: 'graph_only', from, to, curve: [{date, used, remaining}] }`; `full` additionally includes `stays`.
- **The filtering happens before serialisation.** A `graph_only` response never contains a stay name in any field.

- [ ] **Step 1: Write `backend/lib/sharing.php`**

```php
<?php
declare(strict_types=1);

/**
 * The 90/180 rule, server side.
 *
 * A deliberate re-implementation of src/engine/schengen.js: the server must be
 * able to compute a partner's curve WITHOUT ever handing the requester the
 * underlying stays. Keep the two in step — the constants and the inclusive
 * window semantics are the contract.
 */

const WINDOW_DAYS = 180;
const LIMIT_DAYS = 90;

/** @return array<string,bool> every ISO day of presence, deduplicated */
function presenceSet(array $stays): array
{
    $present = [];
    foreach ($stays as $s) {
        if ((int) $s['deleted'] === 1) {
            continue;
        }
        $cursor = new DateTimeImmutable($s['start_date'] . ' 12:00:00', new DateTimeZone('UTC'));
        $end = new DateTimeImmutable($s['end_date'] . ' 12:00:00', new DateTimeZone('UTC'));
        // Inclusive of both the entry and the exit day.
        while ($cursor <= $end) {
            $present[$cursor->format('Y-m-d')] = true;
            $cursor = $cursor->modify('+1 day');
        }
    }
    return $present;
}

/**
 * Daily rolling usage across [$from, $to].
 * @return list<array{date:string,used:int,remaining:int}>
 */
function usageCurve(array $stays, string $from, string $to): array
{
    $present = presenceSet($stays);
    $tz = new DateTimeZone('UTC');
    $cursor = new DateTimeImmutable($from . ' 12:00:00', $tz);
    $end = new DateTimeImmutable($to . ' 12:00:00', $tz);

    $curve = [];
    while ($cursor <= $end) {
        $windowStart = $cursor->modify('-' . (WINDOW_DAYS - 1) . ' days')->format('Y-m-d');
        $day = $cursor->format('Y-m-d');
        $used = 0;
        foreach (array_keys($present) as $d) {
            if ($d >= $windowStart && $d <= $day) {
                $used++;
            }
        }
        $curve[] = [
            'date' => $day,
            'used' => $used,
            'remaining' => max(0, LIMIT_DAYS - $used),
        ];
        $cursor = $cursor->modify('+1 day');
    }
    return $curve;
}

/**
 * Build the response payload for a partnership.
 *
 * `graph_only` returns numbers and dates only. Names, countries and individual
 * stay records are never placed in the array, so there is nothing for a client
 * to leak, hide or reconstruct from labels.
 */
function trackingPayload(PDO $pdo, string $ownerId, string $sharingLevel): array
{
    $today = (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d');
    $from = (new DateTimeImmutable($today, new DateTimeZone('UTC')))->modify('-180 days')->format('Y-m-d');
    $to = (new DateTimeImmutable($today, new DateTimeZone('UTC')))->modify('+365 days')->format('Y-m-d');

    $stmt = $pdo->prepare('SELECT * FROM stays WHERE owner_id = ? AND deleted = 0');
    $stmt->execute([$ownerId]);
    $stays = $stmt->fetchAll();

    $payload = [
        'sharingLevel' => $sharingLevel,
        'from' => $from,
        'to' => $to,
        'today' => $today,
        'curve' => usageCurve($stays, $from, $to),
    ];

    if ($sharingLevel === 'full') {
        $payload['stays'] = array_map('stayToJson', $stays);
    }

    return $payload;
}
```

- [ ] **Step 2: Write `backend/api/partners.php`**

```php
<?php
declare(strict_types=1);

const SHARING_LEVELS = ['graph_only', 'full'];

function partnershipToJson(array $r, string $viewerId): array
{
    return [
        'id' => $r['id'],
        'direction' => $r['from_user_id'] === $viewerId ? 'outgoing' : 'incoming',
        'fromUserId' => $r['from_user_id'],
        // The invitee needs a label for the sharer. Populated by the JOIN in
        // handleListPartners; absent (null) elsewhere, which the UI tolerates.
        'fromEmail' => $r['from_email'] ?? null,
        'toEmail' => $r['to_email'],
        'toUserId' => $r['to_user_id'],
        'status' => $r['status'],
        'sharingLevel' => $r['sharing_level'],
        'createdAt' => $r['created_at'],
        'updatedAt' => $r['updated_at'],
    ];
}

function handleInvite(PDO $pdo): never
{
    $user = requireUser($pdo);
    $in = body();
    $email = strtolower(trim((string) ($in['email'] ?? '')));
    $level = (string) ($in['sharingLevel'] ?? 'graph_only');

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        fail('Enter a valid email address', 422, ['field' => 'email']);
    }
    if ($email === strtolower($user['email'])) {
        fail('You cannot invite yourself', 422, ['field' => 'email']);
    }
    if (!in_array($level, SHARING_LEVELS, true)) {
        fail('Unknown sharing level', 422, ['field' => 'sharingLevel']);
    }

    $dupe = $pdo->prepare(
        "SELECT id FROM partnerships
         WHERE from_user_id = ? AND to_email = ? AND status IN ('pending','accepted')"
    );
    $dupe->execute([$user['id'], $email]);
    if ($dupe->fetch() !== false) {
        fail('You have already invited that person', 409);
    }

    // Bind immediately if they already have an account, so acceptance can find it.
    $target = $pdo->prepare('SELECT id FROM users WHERE email = ?');
    $target->execute([$email]);
    $toUserId = $target->fetchColumn() ?: null;

    $id = uuid();
    $ts = isoNow();
    $stmt = $pdo->prepare(
        'INSERT INTO partnerships
         (id, from_user_id, to_email, to_user_id, status, sharing_level, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([$id, $user['id'], $email, $toUserId ?: null, 'pending', $level, $ts, $ts]);

    $row = $pdo->prepare('SELECT * FROM partnerships WHERE id = ?');
    $row->execute([$id]);
    send(['partnership' => partnershipToJson($row->fetch(), $user['id'])], 201);
}

function handleRespond(PDO $pdo): never
{
    $user = requireUser($pdo);
    $in = body();
    $id = (string) ($in['id'] ?? '');
    $accept = (bool) ($in['accept'] ?? false);

    // Only the invitee may respond, matched by bound id OR by email address.
    $stmt = $pdo->prepare(
        'SELECT * FROM partnerships WHERE id = ? AND (to_user_id = ? OR to_email = ?)'
    );
    $stmt->execute([$id, $user['id'], strtolower($user['email'])]);
    $p = $stmt->fetch();
    if ($p === false) {
        fail('Invite not found', 404);
    }
    if ($p['status'] !== 'pending') {
        fail('That invite has already been answered', 409);
    }

    $upd = $pdo->prepare(
        'UPDATE partnerships SET status = ?, to_user_id = ?, updated_at = ? WHERE id = ?'
    );
    $upd->execute([$accept ? 'accepted' : 'declined', $user['id'], isoNow(), $id]);

    $row = $pdo->prepare('SELECT * FROM partnerships WHERE id = ?');
    $row->execute([$id]);
    send(['partnership' => partnershipToJson($row->fetch(), $user['id'])]);
}

function handleRevoke(PDO $pdo): never
{
    $user = requireUser($pdo);
    $id = (string) (body()['id'] ?? '');

    // Either side can end the arrangement at any time.
    $stmt = $pdo->prepare(
        'UPDATE partnerships SET status = ?, updated_at = ?
         WHERE id = ? AND (from_user_id = ? OR to_user_id = ?)'
    );
    $stmt->execute(['revoked', isoNow(), $id, $user['id'], $user['id']]);
    if ($stmt->rowCount() === 0) {
        fail('Partnership not found', 404);
    }
    send(['ok' => true]);
}

/** The SHARER controls visibility — only from_user_id may change the level. */
function handleSetSharing(PDO $pdo): never
{
    $user = requireUser($pdo);
    $in = body();
    $id = (string) ($in['id'] ?? '');
    $level = (string) ($in['sharingLevel'] ?? '');

    if (!in_array($level, SHARING_LEVELS, true)) {
        fail('Unknown sharing level', 422, ['field' => 'sharingLevel']);
    }

    $stmt = $pdo->prepare(
        'UPDATE partnerships SET sharing_level = ?, updated_at = ? WHERE id = ? AND from_user_id = ?'
    );
    $stmt->execute([$level, isoNow(), $id, $user['id']]);
    if ($stmt->rowCount() === 0) {
        fail('Partnership not found', 404);
    }

    $row = $pdo->prepare('SELECT * FROM partnerships WHERE id = ?');
    $row->execute([$id]);
    send(['partnership' => partnershipToJson($row->fetch(), $user['id'])]);
}

function handleListPartners(PDO $pdo): never
{
    $user = requireUser($pdo);

    $out = $pdo->prepare("SELECT * FROM partnerships WHERE from_user_id = ? AND status != 'revoked'");
    $out->execute([$user['id']]);

    // Join the sharer's email so the invitee has something to display. This is
    // the sharer's own identity, not their trip data — no privacy level applies.
    $inc = $pdo->prepare(
        "SELECT p.*, u.email AS from_email
         FROM partnerships p
         JOIN users u ON u.id = p.from_user_id
         WHERE (p.to_user_id = ? OR p.to_email = ?) AND p.status != 'revoked'"
    );
    $inc->execute([$user['id'], strtolower($user['email'])]);

    send([
        'outgoing' => array_map(fn($r) => partnershipToJson($r, $user['id']), $out->fetchAll()),
        'incoming' => array_map(fn($r) => partnershipToJson($r, $user['id']), $inc->fetchAll()),
    ]);
}

/**
 * A partner's tracking data, filtered to the level THEY chose.
 *
 * The requester is the invitee; the data belongs to `from_user_id`. The level
 * is read from the stored partnership, never from the request — a client
 * cannot ask for more than it was granted.
 */
function handlePartnerTracking(PDO $pdo, string $id): never
{
    $user = requireUser($pdo);

    $stmt = $pdo->prepare(
        "SELECT * FROM partnerships
         WHERE id = ? AND status = 'accepted' AND (to_user_id = ? OR to_email = ?)"
    );
    $stmt->execute([$id, $user['id'], strtolower($user['email'])]);
    $p = $stmt->fetch();
    if ($p === false) {
        fail('Not shared with you', 403);
    }

    send(['tracking' => trackingPayload($pdo, $p['from_user_id'], $p['sharing_level'])]);
}
```

- [ ] **Step 3: Uncomment the partner routes in `backend/index.php`**

All five `'…/partners…'` entries in `$routes` and the `handlePartnerTracking` `preg_match` block must now be active.

- [ ] **Step 4: Verify invites, acceptance and — critically — privacy enforcement**

```bash
cd /home/neuadmin/Documents/Schengen-Tracker
rm -f backend/data/app.sqlite*
php -S 127.0.0.1:8080 backend/index.php > /tmp/php-server.log 2>&1 &
sleep 1
API=http://127.0.0.1:8080
tok() { grep -o '"token":"[a-f0-9]*"' | cut -d'"' -f4; }

A=$(curl -s -X POST $API/api/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"ana@example.com","password":"correct-horse"}' | tok)
B=$(curl -s -X POST $API/api/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"ben@example.com","password":"correct-horse"}' | tok)

# Ana records a trip with an identifying name.
curl -s -X POST $API/api/sync -H "Authorization: Bearer $A" -H 'Content-Type: application/json' \
  -d '{"lastSeq":0,"changes":[{"id":"33333333-3333-4333-8333-333333333333","name":"SECRETPLACE","country":"Spain","startDate":"2026-07-01","endDate":"2026-07-20","createdAt":"2026-07-01T00:00:00.000Z","updatedAt":"2026-07-01T00:00:00.000Z","deleted":false}]}' > /dev/null

# Ana invites Ben at the default graph_only level.
PID=$(curl -s -X POST $API/api/partners/invite -H "Authorization: Bearer $A" \
  -H 'Content-Type: application/json' -d '{"email":"ben@example.com"}' \
  | grep -o '"id":"[0-9a-f-]*"' | head -1 | cut -d'"' -f4)

# Ben cannot read anything until he accepts.
curl -s -o /dev/null -w 'before accept: %{http_code}\n' \
  "$API/api/partners/$PID/tracking" -H "Authorization: Bearer $B"

curl -s -X POST $API/api/partners/respond -H "Authorization: Bearer $B" \
  -H 'Content-Type: application/json' -d "{\"id\":\"$PID\",\"accept\":true}" > /dev/null

# THE PRIVACY TEST: the graph_only payload must not contain the trip name.
curl -s "$API/api/partners/$PID/tracking" -H "Authorization: Bearer $B" > /tmp/graph_only.json
grep -c 'SECRETPLACE' /tmp/graph_only.json
grep -o '"sharingLevel":"[a-z_]*"' /tmp/graph_only.json
python3 -c "import json;d=json.load(open('/tmp/graph_only.json'))['tracking'];print('curve points:',len(d['curve']));print('has stays key:', 'stays' in d);print('peak used:', max(p['used'] for p in d['curve']))"
```

Expected: `before accept: 403`; `grep -c 'SECRETPLACE'` prints **0**; `"sharingLevel":"graph_only"`; roughly 546 curve points; `has stays key: False`; `peak used: 20`.

```bash
# Ana upgrades Ben to full; only now do names appear.
curl -s -X POST $API/api/partners/sharing -H "Authorization: Bearer $A" \
  -H 'Content-Type: application/json' -d "{\"id\":\"$PID\",\"sharingLevel\":\"full\"}" > /dev/null
curl -s "$API/api/partners/$PID/tracking" -H "Authorization: Bearer $B" | grep -c 'SECRETPLACE'

# Ben must not be able to raise his own access level.
curl -s -X POST $API/api/partners/sharing -H "Authorization: Bearer $B" \
  -H 'Content-Type: application/json' -d "{\"id\":\"$PID\",\"sharingLevel\":\"full\"}"

# Revocation takes effect immediately.
curl -s -X POST $API/api/partners/revoke -H "Authorization: Bearer $A" \
  -H 'Content-Type: application/json' -d "{\"id\":\"$PID\"}" > /dev/null
curl -s -o /dev/null -w 'after revoke: %{http_code}\n' \
  "$API/api/partners/$PID/tracking" -H "Authorization: Bearer $B"
```

Expected: the `full` fetch prints `1` (name now present); Ben's sharing-level change returns `{"error":"Partnership not found"}` with 404; `after revoke: 403`.

Stop the server: `kill %1`.

- [ ] **Step 5: Commit**

```bash
git add backend
git commit -m "feat: partner invites with server-enforced graph_only privacy filtering"
```

---

## Task 15: Joint availability engine

**Files:**
- Create: `frontend/src/engine/joint.js`
- Test: `frontend/src/engine/joint.test.js`

**Interfaces:**
- Consumes: `engine/schengen.js`, `engine/dates.js`.
- Produces:
  - `feasibility(stays, { startDate, endDate }): { ok, breachDate, peakUsed }` — checks a proposed trip against one person's own stays
  - `curveFeasibleStarts(curve, minLength): Set<string>` — start days from which an L-day trip stays within 90
  - `jointWindows({ curveA, curveB, minLength, horizonDays }): [{ from, to, length }]`
- **Conservative by design:** the scan assumes every proposed day is a *new* day of presence. If a partner is already in Schengen on one of those days, the real usage is lower, so the scan can under-report availability but never over-report it.

- [ ] **Step 1: Write the failing test**

`frontend/src/engine/joint.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { feasibility, curveFeasibleStarts, jointWindows } from './joint.js'
import { addDays } from './dates.js'

const stay = (id, startDate, endDate) => ({
  id, name: id, country: null, startDate, endDate,
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  deleted: false, ownerId: null,
})

/** A flat curve of `n` days, all with the same usage. */
const flatCurve = (from, days, used) =>
  Array.from({ length: days }, (_, i) => ({
    date: addDays(from, i), used, remaining: Math.max(0, 90 - used),
  }))

describe('feasibility', () => {
  it('accepts a short trip when there is plenty of room', () => {
    const r = feasibility([stay('a', '2026-01-01', '2026-01-10')], {
      startDate: '2026-06-01', endDate: '2026-06-10',
    })
    expect(r.ok).toBe(true)
    expect(r.breachDate).toBe(null)
  })

  it('flags the exact day the 90-day limit is crossed', () => {
    // 85 days used immediately before the proposed trip.
    const r = feasibility([stay('a', '2026-01-01', '2026-03-26')], {
      startDate: '2026-03-27', endDate: '2026-04-10',
    })
    expect(r.ok).toBe(false)
    expect(r.breachDate).toBe('2026-04-01') // the 91st day of presence
  })

  it('counts the proposed trip inclusively', () => {
    // Exactly 90 days total: 82 existing + an 8-day trip.
    const r = feasibility([stay('a', '2026-01-01', '2026-03-23')], {
      startDate: '2026-03-24', endDate: '2026-03-31',
    })
    expect(r.peakUsed).toBe(90)
    expect(r.ok).toBe(true)
  })
})

describe('curveFeasibleStarts', () => {
  it('accepts every start when the curve is empty', () => {
    const starts = curveFeasibleStarts(flatCurve('2026-08-01', 30, 0), 7)
    expect(starts.has('2026-08-01')).toBe(true)
  })

  it('rejects starts that would breach mid-trip', () => {
    // 86 used: adding 5 days reaches 91 on the 5th day.
    const starts = curveFeasibleStarts(flatCurve('2026-08-01', 30, 86), 5)
    expect(starts.size).toBe(0)
  })

  it('accepts a trip that lands exactly on 90', () => {
    const starts = curveFeasibleStarts(flatCurve('2026-08-01', 30, 86), 4)
    expect(starts.has('2026-08-01')).toBe(true)
  })

  it('rejects starts too close to the end of the known curve', () => {
    const starts = curveFeasibleStarts(flatCurve('2026-08-01', 10, 0), 7)
    expect(starts.has('2026-08-05')).toBe(false) // would need data to 2026-08-11
  })
})

describe('jointWindows', () => {
  it('returns a merged window where both have room', () => {
    const w = jointWindows({
      curveA: flatCurve('2026-08-01', 60, 0),
      curveB: flatCurve('2026-08-01', 60, 0),
      minLength: 7,
    })
    expect(w).toHaveLength(1)
    expect(w[0].from).toBe('2026-08-01')
    expect(w[0].length).toBeGreaterThanOrEqual(7)
  })

  it('returns nothing when one partner is out of allowance', () => {
    const w = jointWindows({
      curveA: flatCurve('2026-08-01', 60, 0),
      curveB: flatCurve('2026-08-01', 60, 90),
      minLength: 7,
    })
    expect(w).toEqual([])
  })

  it('intersects the two partners rather than unioning them', () => {
    // A is free the whole time; B is only free in the second half.
    const curveB = [
      ...flatCurve('2026-08-01', 30, 90),
      ...flatCurve('2026-08-31', 30, 0),
    ]
    const w = jointWindows({
      curveA: flatCurve('2026-08-01', 60, 0),
      curveB,
      minLength: 7,
    })
    expect(w).toHaveLength(1)
    expect(w[0].from >= '2026-08-31').toBe(true)
  })

  it('honours the minimum trip length', () => {
    // Only a 3-day gap of headroom exists, so a 7-day request finds nothing.
    const curve = [
      ...flatCurve('2026-08-01', 10, 90),
      ...flatCurve('2026-08-11', 3, 80),
      ...flatCurve('2026-08-14', 10, 90),
    ]
    expect(jointWindows({ curveA: curve, curveB: curve, minLength: 7 })).toEqual([])
    expect(jointWindows({ curveA: curve, curveB: curve, minLength: 3 }).length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd frontend && npx vitest run src/engine/joint.test.js
```

Expected: FAIL — `Failed to resolve import "./joint.js"`.

- [ ] **Step 3: Write `frontend/src/engine/joint.js`**

```js
/**
 * Two-person planning: does a proposed trip fit, and when are we BOTH free?
 *
 * The joint scan works from usage CURVES, not from stay records — that is what
 * makes it privacy-safe. A `graph_only` partner payload carries only
 * {date, used, remaining}, and this module needs nothing more.
 */
import { addDays, diffDays, eachDay } from './dates.js'
import { buildPresence, LIMIT_DAYS, WINDOW_DAYS } from './schengen.js'

/**
 * Check a proposed trip against one person's OWN stays (full detail available).
 * Scans through `endDate + 179` because the added days keep counting — and
 * other trips keep arriving — for the rest of the window.
 */
export function feasibility(stays, { startDate, endDate }) {
  const presence = buildPresence(stays)
  for (const day of eachDay(startDate, endDate)) presence.set(day, '__proposed__')

  let peakUsed = 0
  let breachDate = null
  const scanTo = addDays(endDate, WINDOW_DAYS - 1)

  for (const day of eachDay(startDate, scanTo)) {
    const windowStart = addDays(day, -(WINDOW_DAYS - 1))
    let used = 0
    for (const d of presence.keys()) {
      if (d >= windowStart && d <= day) used++
    }
    if (used > peakUsed) peakUsed = used
    if (used > LIMIT_DAYS && breachDate === null) breachDate = day
  }

  return { ok: breachDate === null, breachDate, peakUsed }
}

/**
 * Start days from which an L-day trip keeps this person within 90.
 *
 * Conservative: every proposed day is treated as a NEW day of presence. If the
 * person is already in Schengen on one of them, real usage is lower — so this
 * can under-report availability, never over-report it.
 */
export function curveFeasibleStarts(curve, minLength) {
  const byDate = new Map(curve.map((p) => [p.date, p.used]))
  const starts = new Set()

  for (let i = 0; i < curve.length; i++) {
    const start = curve[i].date
    let ok = true
    for (let k = 0; k < minLength; k++) {
      const day = addDays(start, k)
      const used = byDate.get(day)
      // Unknown day = beyond the shared horizon; refuse rather than guess.
      if (used === undefined || used + (k + 1) > LIMIT_DAYS) { ok = false; break }
    }
    if (ok) starts.add(start)
  }
  return starts
}

/**
 * Date ranges where BOTH partners can take a trip of at least `minLength` days.
 * Consecutive feasible starts are merged into one window.
 */
export function jointWindows({ curveA, curveB, minLength = 7, horizonDays = 365 }) {
  const length = Math.max(1, Number(minLength) || 1)
  const limitDate = curveA.length ? addDays(curveA[0].date, horizonDays) : null

  const a = curveFeasibleStarts(curveA, length)
  const b = curveFeasibleStarts(curveB, length)

  const shared = curveA
    .map((p) => p.date)
    .filter((d) => a.has(d) && b.has(d) && (!limitDate || d <= limitDate))
    .sort()

  const windows = []
  let runStart = null
  let prev = null

  for (const d of shared) {
    if (runStart === null) { runStart = d; prev = d; continue }
    if (diffDays(prev, d) === 1) { prev = d; continue }
    windows.push(closeWindow(runStart, prev, length))
    runStart = d
    prev = d
  }
  if (runStart !== null) windows.push(closeWindow(runStart, prev, length))

  return windows
}

function closeWindow(firstStart, lastStart, length) {
  // The last usable day is the final feasible start plus the trip length.
  const to = addDays(lastStart, length - 1)
  return { from: firstStart, to, length: diffDays(firstStart, to) + 1 }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd frontend && npx vitest run src/engine/joint.test.js
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /home/neuadmin/Documents/Schengen-Tracker
git add frontend/src/engine
git commit -m "feat: joint availability engine driven by privacy-safe usage curves"
```

---

## Task 16: Partners UI

**Files:**
- Create: `frontend/src/sync/partners.js`, `frontend/src/ui/screens/PartnerDetail.jsx`
- Rewrite: `frontend/src/ui/screens/PartnersScreen.jsx`

**Interfaces:**
- Consumes: `sync/api.js`, `db/db.js` (`partners`, `partnerCurves`), `engine/joint.js`, `engine/schengen.js`, `db/stays.js`.
- Produces:
  - `fetchPartners()`, `invitePartner(email, level)`, `respondToInvite(id, accept)`, `revokePartnership(id)`, `setSharingLevel(id, level)`, `fetchPartnerTracking(id)` — all cache to IndexedDB and return cached data when offline
  - `<PartnerDetail partnership tracking myStays onBack />`

- [ ] **Step 1: Write `frontend/src/sync/partners.js`**

```js
import { db } from '../db/db.js'
import { getMeta } from '../db/meta.js'
import { apiFetch } from './api.js'

const withToken = async (path, opts = {}) => {
  const token = await getMeta('token', null)
  if (!token) return { ok: false, status: 401, data: null, error: 'unauthenticated' }
  return apiFetch(path, { ...opts, token })
}

/** Refresh the partner list, falling back to the local cache when offline. */
export async function fetchPartners() {
  const res = await withToken('/api/partners')
  if (!res.ok) {
    return { ok: false, error: res.error, partners: await db.partners.toArray() }
  }
  const rows = [...(res.data.outgoing || []), ...(res.data.incoming || [])]
  await db.partners.clear()
  await db.partners.bulkPut(rows)
  return { ok: true, partners: rows }
}

export const invitePartner = (email, sharingLevel = 'graph_only') =>
  withToken('/api/partners/invite', { method: 'POST', body: { email, sharingLevel } })

export const respondToInvite = (id, accept) =>
  withToken('/api/partners/respond', { method: 'POST', body: { id, accept } })

export const revokePartnership = (id) =>
  withToken('/api/partners/revoke', { method: 'POST', body: { id } })

export const setSharingLevel = (id, sharingLevel) =>
  withToken('/api/partners/sharing', { method: 'POST', body: { id, sharingLevel } })

/**
 * A partner's tracking data, cached so joint planning still works on a plane.
 * The cached copy carries `fetchedAt` and the UI must show how old it is —
 * stale numbers presented as current would be worse than no numbers.
 */
export async function fetchPartnerTracking(partnerId) {
  const res = await withToken(`/api/partners/${partnerId}/tracking`)
  if (!res.ok) {
    const cached = await db.partnerCurves.get(partnerId)
    return cached
      ? { ok: true, stale: true, tracking: cached.tracking, fetchedAt: cached.fetchedAt }
      : { ok: false, error: res.error }
  }
  const fetchedAt = new Date().toISOString()
  await db.partnerCurves.put({ partnerId, tracking: res.data.tracking, fetchedAt })
  return { ok: true, stale: false, tracking: res.data.tracking, fetchedAt }
}
```

- [ ] **Step 2: Write `frontend/src/ui/screens/PartnerDetail.jsx`**

```jsx
import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { formatDisplay, todayISO } from '../../engine/dates.js'
import { buildPresence, usageOn, remainingOn, LIMIT_DAYS } from '../../engine/schengen.js'
import { feasibility, jointWindows } from '../../engine/joint.js'
import DateRangeSheet from '../date/DateRangeSheet.jsx'

/**
 * One partner: their headroom, our joint windows, and a proposed-trip check.
 * Everything here runs on the CURVE, so it behaves identically whether the
 * partner shared graph_only or full.
 */
export default function PartnerDetail({ partnership, tracking, stale, fetchedAt, myStays, onBack }) {
  const [minLength, setMinLength] = useState(7)
  const [proposal, setProposal] = useState(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const today = todayISO()

  const myCurve = useMemo(() => {
    const presence = buildPresence(myStays)
    return (tracking?.curve || []).map((p) => {
      const used = usageOn(presence, p.date)
      return { date: p.date, used, remaining: remainingOn(used) }
    })
  }, [myStays, tracking])

  const windows = useMemo(
    () => (tracking ? jointWindows({ curveA: myCurve, curveB: tracking.curve, minLength }) : []),
    [myCurve, tracking, minLength],
  )

  const theirToday = tracking?.curve.find((p) => p.date === today)

  const check = useMemo(() => {
    if (!proposal || !tracking) return null
    const mine = feasibility(myStays, proposal)
    // The partner is checked against their curve — we may not have their stays.
    const theirs = partnerFeasibility(tracking.curve, proposal)
    return { mine, theirs }
  }, [proposal, tracking, myStays])

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-fog-500">← All partners</button>

      <section className="card p-5">
        <h2 className="text-sm font-semibold tracking-tight">{partnership.fromEmail || partnership.toEmail}</h2>
        <p className="mt-1 text-xs text-fog-700">
          Sharing level: {partnership.sharingLevel === 'full' ? 'Full trip details' : 'Graph only'}
          {partnership.sharingLevel === 'graph_only' &&
            ' — you can see their allowance, not where they went.'}
        </p>
        {stale && (
          <p className="mt-2 text-xs text-warn">
            Offline — showing figures cached on {formatDisplay((fetchedAt || '').slice(0, 10))}.
          </p>
        )}
        {theirToday && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="bg-ink-850 rounded-xl2 p-3">
              <span className="block text-[10px] uppercase tracking-widest text-fog-700">
                Their days left
              </span>
              <span className="num text-2xl font-semibold">{theirToday.remaining}</span>
            </div>
            <div className="bg-ink-850 rounded-xl2 p-3">
              <span className="block text-[10px] uppercase tracking-widest text-fog-700">
                Your days left
              </span>
              <span className="num text-2xl font-semibold">
                {remainingOn(usageOn(buildPresence(myStays), today))}
              </span>
            </div>
          </div>
        )}
      </section>

      <section className="card p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold tracking-tight">Where you both have space</h3>
          <select
            value={minLength}
            onChange={(e) => setMinLength(Number(e.target.value))}
            className="bg-ink-850 border border-ink-700 rounded-lg px-2 py-1 text-xs text-fog-300"
          >
            {[3, 5, 7, 10, 14, 21, 30].map((n) => (
              <option key={n} value={n}>≥ {n} days</option>
            ))}
          </select>
        </div>

        {windows.length === 0 ? (
          <p className="mt-3 text-sm text-fog-500">
            No stretch in the next 12 months where you both have {minLength} days free.
            Try a shorter trip.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {windows.slice(0, 8).map((w) => (
              <motion.li
                key={w.from}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center justify-between bg-ok/10 border border-ok/25 rounded-xl2 px-3 py-2.5"
              >
                <span className="num text-sm">
                  {formatDisplay(w.from)} → {formatDisplay(w.to)}
                </span>
                <span className="num text-xs text-ok">{w.length} days</span>
              </motion.li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[11px] text-fog-700 leading-relaxed">
          Calculated from both allowances. Deliberately cautious: if either of you is
          already travelling on one of these days, you have more room, not less.
        </p>
      </section>

      <section className="card p-5">
        <h3 className="text-sm font-semibold tracking-tight">Check a specific trip</h3>
        <button
          onClick={() => setSheetOpen(true)}
          className="mt-3 w-full bg-ink-850 border border-ink-700 rounded-xl2 px-4 py-3 text-left num"
        >
          {proposal
            ? `${formatDisplay(proposal.startDate)} → ${formatDisplay(proposal.endDate)}`
            : 'Pick the dates you are considering'}
        </button>

        {check && (
          <div className="mt-3 space-y-2">
            <Verdict who="You" result={check.mine} />
            <Verdict who="They" result={check.theirs} />
          </div>
        )}
      </section>

      {sheetOpen && (
        <DateRangeSheet
          open={sheetOpen}
          value={proposal}
          onCancel={() => setSheetOpen(false)}
          onConfirm={(v) => { setProposal(v); setSheetOpen(false) }}
        />
      )}
    </div>
  )
}

function Verdict({ who, result }) {
  const ok = result.ok
  return (
    <div className={`rounded-xl2 px-3 py-2.5 border ${
      ok ? 'bg-ok/10 border-ok/25' : 'bg-over/10 border-over/25'}`}>
      <span className={`text-sm font-medium ${ok ? 'text-ok' : 'text-over'}`}>
        {who} {ok ? 'can make this trip' : 'would go over the limit'}
      </span>
      <span className="block text-xs text-fog-500 num mt-0.5">
        Peak {result.peakUsed} of {LIMIT_DAYS} days
        {result.breachDate ? ` · over from ${formatDisplay(result.breachDate)}` : ''}
      </span>
    </div>
  )
}

/** Feasibility from a curve alone — all we have for a graph_only partner. */
function partnerFeasibility(curve, { startDate, endDate }) {
  const byDate = new Map(curve.map((p) => [p.date, p.used]))
  let peakUsed = 0
  let breachDate = null
  let k = 0
  for (let d = startDate; d <= endDate; d = nextDay(d)) {
    k++
    const used = (byDate.get(d) ?? 0) + k
    if (used > peakUsed) peakUsed = used
    if (used > LIMIT_DAYS && breachDate === null) breachDate = d
  }
  return { ok: breachDate === null, breachDate, peakUsed }
}

function nextDay(iso) {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}
```

- [ ] **Step 3: Rewrite `frontend/src/ui/screens/PartnersScreen.jsx`**

```jsx
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { motion } from 'framer-motion'
import { getMeta } from '../../db/meta.js'
import { listStays } from '../../db/stays.js'
import {
  fetchPartners, invitePartner, respondToInvite,
  revokePartnership, setSharingLevel, fetchPartnerTracking,
} from '../../sync/partners.js'
import PartnerDetail from './PartnerDetail.jsx'

export default function PartnersScreen() {
  const session = useLiveQuery(() => getMeta('user', null), [], undefined)
  const myStays = useLiveQuery(() => listStays(), [], null)
  const [partners, setPartners] = useState([])
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState(null)
  const [open, setOpen] = useState(null)

  const reload = async () => {
    const r = await fetchPartners()
    setPartners(r.partners || [])
    if (!r.ok && r.error !== 'unauthenticated') {
      setMessage('Showing the last list saved on this device.')
    }
  }

  useEffect(() => { if (session) reload() }, [Boolean(session)])

  if (session === undefined || myStays === null) {
    return <div className="h-40 rounded-xl2 bg-ink-900 animate-pulse" />
  }

  if (!session) {
    return (
      <div className="card p-6 text-center">
        <h2 className="text-lg font-semibold tracking-tight">Plan trips together</h2>
        <p className="mt-2 text-sm text-fog-500 leading-relaxed">
          Invite a partner and the app finds the stretches where you both still have
          Schengen days available — no messaging back and forth.
        </p>
        <p className="mt-3 text-xs text-fog-700">
          This is the one feature that needs an account. Everything else works offline
          without one. Add your account under Settings.
        </p>
      </div>
    )
  }

  if (open) {
    return (
      <PartnerDetail
        partnership={open.partnership}
        tracking={open.tracking}
        stale={open.stale}
        fetchedAt={open.fetchedAt}
        myStays={myStays}
        onBack={() => setOpen(null)}
      />
    )
  }

  const openPartner = async (p) => {
    const r = await fetchPartnerTracking(p.id)
    if (!r.ok) { setMessage('That partner’s data is not available offline yet.'); return }
    setOpen({ partnership: p, tracking: r.tracking, stale: r.stale, fetchedAt: r.fetchedAt })
  }

  const send = async () => {
    const res = await invitePartner(email.trim())
    setMessage(res.ok ? `Invite sent to ${email.trim()}.` : res.error)
    if (res.ok) { setEmail(''); reload() }
  }

  const outgoing = partners.filter((p) => p.direction === 'outgoing')
  const incoming = partners.filter((p) => p.direction === 'incoming')

  return (
    <div className="space-y-4">
      <section className="card p-5">
        <h2 className="text-sm font-semibold tracking-tight">Invite a partner</h2>
        <input value={email} onChange={(e) => setEmail(e.target.value)}
          type="email" inputMode="email" placeholder="partner@example.com"
          className="mt-3 w-full bg-ink-850 border border-ink-700 rounded-xl2 px-4 py-3 outline-none focus:border-accent" />
        <button onClick={send}
          className="mt-2 w-full px-4 py-3 rounded-xl2 bg-accent text-ink-950 font-semibold">
          Send invite
        </button>
        <p className="mt-2 text-xs text-fog-700 leading-relaxed">
          They see only your rolling graph and how many days you have left — not where
          you went — unless you switch that partnership to full details.
        </p>
        {message && <p className="mt-2 text-xs text-fog-300">{message}</p>}
      </section>

      {incoming.length > 0 && (
        <section>
          <h3 className="text-xs uppercase tracking-widest text-fog-700 mb-2 px-1">
            Shared with you
          </h3>
          <div className="space-y-2">
            {incoming.map((p) => (
              <motion.div key={p.id} layout className="card p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm truncate">Invite from a partner</span>
                  <span className="text-xs text-fog-700">{p.status}</span>
                </div>
                <div className="mt-3 flex gap-2">
                  {p.status === 'pending' && (
                    <>
                      <button onClick={async () => { await respondToInvite(p.id, true); reload() }}
                        className="flex-1 px-3 py-2 rounded-lg bg-accent text-ink-950 text-sm font-semibold">
                        Accept
                      </button>
                      <button onClick={async () => { await respondToInvite(p.id, false); reload() }}
                        className="flex-1 px-3 py-2 rounded-lg bg-ink-800 text-fog-300 text-sm">
                        Decline
                      </button>
                    </>
                  )}
                  {p.status === 'accepted' && (
                    <button onClick={() => openPartner(p)}
                      className="flex-1 px-3 py-2 rounded-lg bg-ink-800 text-fog-200 text-sm">
                      Open their tracking
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {outgoing.length > 0 && (
        <section>
          <h3 className="text-xs uppercase tracking-widest text-fog-700 mb-2 px-1">
            You are sharing with
          </h3>
          <div className="space-y-2">
            {outgoing.map((p) => (
              <motion.div key={p.id} layout className="card p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm truncate">{p.toEmail}</span>
                  <span className="text-xs text-fog-700">{p.status}</span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <select
                    value={p.sharingLevel}
                    onChange={async (e) => { await setSharingLevel(p.id, e.target.value); reload() }}
                    className="flex-1 bg-ink-850 border border-ink-700 rounded-lg px-2 py-2 text-xs text-fog-300"
                  >
                    <option value="graph_only">Graph only (recommended)</option>
                    <option value="full">Full trip details</option>
                  </select>
                  <button onClick={async () => { await revokePartnership(p.id); reload() }}
                    className="px-3 py-2 rounded-lg bg-over/15 text-over text-xs">
                    Stop sharing
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verify the couples flow end-to-end**

```bash
cd /home/neuadmin/Documents/Schengen-Tracker
rm -f backend/data/app.sqlite*
php -S 127.0.0.1:8080 backend/index.php > /tmp/php-server.log 2>&1 &
cd frontend && npm run dev
```

Use two browser profiles (or a normal and a private window) so each has its own IndexedDB:

1. **Window A:** create account `ana@example.com`, add stays totalling ~70 days in the last 180.
2. **Window B:** create account `ben@example.com`, add a couple of short stays.
3. **Window A:** Partners → invite `ben@example.com`.
4. **Window B:** Partners → the invite appears → Accept → "Open their tracking".
5. Confirm B sees Ana's **days left** but **no trip names anywhere** — this is the privacy contract. Cross-check the raw response in the Network tab: the `graph_only` payload must contain no `stays` key.
6. Set the minimum trip length to 14 days and confirm the joint windows list changes.
7. Pick a proposed trip that would push Ana over 90 — the verdict must flag **her** and not Ben.
8. **Window A:** switch that partnership to "Full trip details" → B reloads → stay names now appear.
9. **Window A:** "Stop sharing" → B's "Open their tracking" now reports the data is unavailable.
10. **Window B:** go offline → reopen the partner → the cached figures appear with the "Offline — showing figures cached on …" notice.

- [ ] **Step 5: Run the full test suite and commit**

```bash
cd frontend && npm test
```

Expected: every suite passes.

```bash
cd /home/neuadmin/Documents/Schengen-Tracker
git add frontend/src
git commit -m "feat: partner invites, privacy-aware viewing and joint window detection"
```

---

## Task 17: README, schema delivery and the airplane acceptance test

**Files:**
- Create: `README.md`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: everything above.
- Produces: the run/build documentation and a verified standalone build.

- [ ] **Step 1: Write `README.md`**

````markdown
# Schengen Tracker

An offline-first tracker for the Schengen **90/180-day rule**. Add your stays, see
exactly how much of your 90-day allowance is used in any rolling 180-day window, and
export a PDF — all with no account and no internet connection.

An account is optional. It adds only two things: sync between devices, and sharing with
a partner so you can find dates you can both travel.

## What it does

- **Correct 90/180 maths.** For any date `D`, days of presence in the inclusive window
  `[D − 179, D]`. Entry and exit days both count, so 23 Jul → 30 Jul is 8 days.
- **Every trip is visible in the graph.** The rolling curve is drawn as stacked
  per-trip bands, so you can see exactly which trip drives which part of the curve.
- **Offline first.** IndexedDB is the source of truth. It works on a plane.
- **Dark only, mobile first.**
- **Privacy-aware sharing.** By default a partner sees only your allowance curve —
  never where you went. The server enforces this; it is not a client-side filter.

## Requirements

- Node 18.19+ (the frontend is pinned to Vite 5 / Tailwind 3 for this reason)
- PHP 8.1+ with `pdo_sqlite` — only if you want the optional backend

Check the PHP extension:

```bash
php -r 'var_dump(in_array("sqlite", PDO::getAvailableDrivers()));'   # must print true
```

If it prints `false`: `sudo apt install php8.3-sqlite3`

## Frontend

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests
npm run build    # produces dist/index.html
```

`npm run build` bundles the entire app — JS, CSS, everything — into a **single
self-contained `dist/index.html`**. Copy that one file anywhere, or open it directly:

```bash
xdg-open "file://$PWD/dist/index.html"
```

It runs with no server and no network. To install it as an app, serve `dist/` over HTTP
and use your browser's "Install" option.

## Backend (optional)

The frontend never requires the backend. Run it only if you want sync or partner
sharing.

```bash
# From the repository root:
php -S 127.0.0.1:8080 backend/index.php
curl http://127.0.0.1:8080/api/health     # {"ok":true,"driver":"sqlite"}
```

The SQLite file is created automatically at `backend/data/app.sqlite` on first request,
using `backend/schema.sql`.

Then, in the app: **Settings → Server address → `http://127.0.0.1:8080` → Save and
test**, and create an account. Any stays you already entered are claimed by that
account on your first sign-in.

### Using MySQL instead

The schema is driver-agnostic; `backend/schema.mysql.sql` is a 1:1 port. Point the
backend at MySQL with environment variables:

```bash
SCHENGEN_DB_DSN='mysql:host=127.0.0.1;dbname=schengen;charset=utf8mb4' \
SCHENGEN_DB_USER=schengen \
SCHENGEN_DB_PASS=secret \
php -S 127.0.0.1:8080 backend/index.php
```

### Deploying behind Apache or nginx

Point the document root at `backend/` and route every request to `index.php`. The
built `dist/index.html` is a static file and can be served from anywhere — including a
different host — because the API address is configured inside the app.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | liveness + active driver |
| POST | `/api/auth/register` | `{email, password, displayName?}` → `{token, user}` |
| POST | `/api/auth/login` | `{email, password}` → `{token, user}` |
| POST | `/api/auth/logout` | invalidates the bearer token |
| GET | `/api/auth/me` | current user |
| POST | `/api/sync` | `{lastSeq, changes[]}` → `{serverSeq, changes[]}` |
| POST | `/api/partners/invite` | `{email, sharingLevel?}` |
| POST | `/api/partners/respond` | `{id, accept}` |
| POST | `/api/partners/revoke` | `{id}` |
| POST | `/api/partners/sharing` | `{id, sharingLevel}` — sharer only |
| GET | `/api/partners` | `{outgoing[], incoming[]}` |
| GET | `/api/partners/{id}/tracking` | filtered by that partnership's sharing level |

Auth is a bearer token (`Authorization: Bearer <token>`), stored server-side as a
SHA-256 hash. Passwords use `password_hash`. Every query is parameterised.

### How sync works

- Local IndexedDB is the source of truth; the server is a replica.
- **Push:** every stay with `updatedAt` newer than the last push.
- **Pull:** every server row with `seq` greater than the client's cursor. `seq` is a
  server-side counter rather than a timestamp, so a skewed client clock cannot hide a
  record from another device.
- **Conflicts:** last-write-wins per record on `updatedAt`.
- **Deletes:** tombstones (`deleted: true`), never row removal.
- Because IDs are client-generated UUIDs, the same record merges instead of duplicating.
- Signing out keeps your local data. Signing back in runs the same two-way delta sync.

## Privacy model

Each partnership has its own sharing level, chosen by the person sharing:

- **`graph_only` (default)** — the partner receives only `{date, used, remaining}`.
  Trip names, countries and individual stay records are never written into the
  response.
- **`full`** — stays with names and dates are included.

Joint-window detection runs entirely on the `graph_only` payload, so the private
default loses no functionality. Sharing is one-directional per record, and revocable at
any time.

## Disclaimer

This tool is a planning aid, not legal advice. Border authorities make the final
determination on your Schengen entitlement.
````

- [ ] **Step 2: Update the root `.gitignore`**

```
node_modules/
dist/
*.sqlite
*.sqlite-shm
*.sqlite-wal
*.db
backend/data/
.DS_Store
```

- [ ] **Step 3: Run the full verification sweep**

```bash
cd /home/neuadmin/Documents/Schengen-Tracker/frontend
npm test
npm run build
ls -lh dist/index.html
grep -o 'src="[^"]*\.js"' dist/index.html | head
```

Expected: every test passes; `dist/index.html` exists as a single sizeable file; the
final `grep` prints **nothing** (no external script references).

- [ ] **Step 4: Run the airplane acceptance test**

This is the gate the whole design was built against. Open the built file directly —
not the dev server — with DevTools set to **Offline** and network throttling on:

```bash
xdg-open "file://$PWD/dist/index.html"
```

Work through every step and confirm each one:

1. The empty state explains that no account is needed.
2. Add three stays with the custom calendar. Each shows `DD MMM YYYY`.
3. The summary tiles, the stacked graph, the 90-day limit line, the today marker and
   the trip ribbon all render.
4. Tap a stay row → its band highlights and the others dim. Tap a ribbon segment → the
   same link works in reverse.
5. Tap **Edit** on a stay → the name, country and **both dates** are pre-filled. This is
   the original bug; it must be gone.
6. Set an end date before the start date → an inline error appears, and nothing saves.
7. Swipe a row left → it deletes with an Undo toast → Undo restores it.
8. Preview the PDF in-app. It renders without any download. Then download it and open
   the file — chart, tiles, stays table and generated-on date all present.
9. Reload the page → every stay is still there.
10. Confirm no horizontal scrolling at 390px width anywhere in the app.

Then the reconnection half:

11. Start the backend, go online, set the server address, create an account.
12. Confirm every stay entered offline is now on the server:
    ```bash
    php -r '$p=new PDO("sqlite:backend/data/app.sqlite"); foreach($p->query("SELECT name,start_date,end_date FROM stays") as $r) echo implode("  ", $r), PHP_EOL;'
    ```
13. Go offline, edit a stay, go online → the pill returns to "Synced" without any
    action from you, and the edit is on the server.

- [ ] **Step 5: Commit**

```bash
cd /home/neuadmin/Documents/Schengen-Tracker
git add README.md .gitignore
git commit -m "docs: README with run, build, sync and privacy documentation"
```

---

## Appendix: Spec coverage

| Spec section | Covered by |
|---|---|
| §1.1 Dark only | Task 1 (config), Global Constraints |
| §1.2 Offline, no account | Tasks 2, 5, 8, 10; verified in Task 17 |
| §1.3 Mobile-first | Tasks 6, 7, 8; width check in Tasks 8, 9, 17 |
| §1.4 Correct date handling | Tasks 3, 7 (regression test), 8 |
| §1.5 frontend-design skill | Tasks 1, 6–9 (palette, motion, typography) |
| §2 Tech stack | Tasks 1, 2, 11 |
| §3 Data model | Tasks 5 (client), 11 (server schema) |
| §4 Input and editing | Task 7 |
| §5 Compliance graph | Tasks 4 (maths), 9 (rendering, linking, tiles) |
| §6 Offline + sync | Tasks 12, 13 |
| §7 PDF preview then export | Task 10 |
| §8 Partner sharing and privacy | Tasks 14, 15, 16 |
| §9 Backend API | Tasks 11, 12, 14 |
| §10 Design and UX | Tasks 6–9, 16 |
| §11 Deliverables | Task 17 |

