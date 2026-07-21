# Schengen 90/180 Tracker — Design Spec

**Date:** 2026-07-21
**Status:** Approved for planning

---

## 1. Purpose

An offline-first web app that tracks stays in the Schengen area against the 90/180-day
rule. It must be fully usable by a brand-new visitor with no account and no network:
add, edit, delete stays; read the compliance graph; preview and export a PDF. An
account is optional and adds only cross-device sync and partner sharing.

The design target is the **airplane scenario**: at 10,000 feet with no connectivity,
logged in or not, every feature above works. On reconnecting, data reconciles silently.

### Bugs in the reference app this design must kill

1. Dates render unformatted; editing a stay presents empty date fields, forcing re-entry.
2. Layout puts an oversized table above the graph.
3. No visual link between an individual trip and the portion of the curve it drives.
4. Login is mandatory.

---

## 2. Non-negotiable constraints

1. **Dark mode only.** One palette. No toggle, no `prefers-color-scheme` branch.
2. **Zero-account, zero-network baseline.** IndexedDB is the client source of truth.
3. **Mobile-first.** Phone is the primary device; all CRUD is comfortable one-handed.
4. **Correct date handling.** See §6.
5. **Premium visual design** via the `frontend-design` skill — not a default template.

---

## 3. Environment decisions

Two environment facts forced explicit choices before any code:

| Fact | Decision |
|---|---|
| PHP 8.3 has `pdo_mysql` but **no** `pdo_sqlite`/`sqlite3` | User installs `php8.3-sqlite3`. SQLite remains the default as specced. |
| Node is 18.19.1; Vite 7 / Tailwind 4 need Node 20+ | Pin **Vite 5 + Tailwind 3**. Tailwind 3's JS config is also the natural home for the dark palette. |

Additional decisions taken during design:

| Question | Decision |
|---|---|
| Future-dated stays? | **Yes.** Curve spans earliest stay → today + 180 days. Future portion visually distinct. |
| Frontend→API discovery | **In-app Settings field**, persisted in IndexedDB. Keeps `dist/index.html` drop-in. |
| Date entry | **Custom in-app calendar sheet.** Native `<input type=date>` is where the reference bug lives. |
| Joint-window computation | **Client-side**, from the partner's fetched curve. Works offline from cache. |
| Mobile list gestures | **Tap to expand, swipe-left to delete** with undo toast. |
| Partner data offline | **Cached in IndexedDB** with a visible `fetchedAt` staleness label. |
| Graph↔trip link | **Stacked per-trip areas + Gantt ribbon.** |

---

## 4. Tech stack

**Frontend** (`frontend/`)

- React 18 + **Vite 5**
- **Tailwind CSS 3**, dark palette baked into `tailwind.config.js`
- **Framer Motion** — modals, tab transitions, graph reveal, sync-status changes
- **Dexie.js** + `dexie-react-hooks` — persistence and reactive queries
- **Recharts** — stacked areas, reference line, shared x-axis with the trip ribbon
- **`@react-pdf/renderer`** — client-side preview and export from one component
- **`vite-plugin-singlefile`** — production build is a single self-contained `index.html`
- **`vite-plugin-pwa`** — installable, service-worker offline shell
- **Vitest** — engine unit tests

**Backend** (`backend/`)

- PHP 8.3, no framework. Single front controller + PDO.
- SQLite by default; all SQL goes through a thin data layer so MySQL is a driver swap.
- `schema.sql` and `schema.mysql.sql` shipped as migration files.
- The backend is **optional infrastructure**. The frontend must never hard-depend on it.

---

## 5. Architecture

```
Schengen-Tracker/
├── frontend/
│   ├── vite.config.js          singlefile + PWA plugins
│   ├── tailwind.config.js      dark palette
│   └── src/
│       ├── engine/             PURE — no React, no Dexie. Unit-tested.
│       │   ├── schengen.js     rolling-window math
│       │   ├── dates.js        ISO ↔ "27 Nov 2026", inclusive day ranges
│       │   └── joint.js        two-person feasibility + window scan
│       ├── db/
│       │   ├── db.js           Dexie schema
│       │   └── stays.js        repository (create/update/softDelete)
│       ├── sync/
│       │   ├── client.js       delta push+pull
│       │   ├── claim.js        claim-on-login
│       │   └── useOnline.js    online/offline events
│       ├── pdf/ReportDocument.jsx
│       └── ui/                 screens + components
├── backend/
│   ├── index.php               router
│   ├── lib/{db,auth,json,sharing}.php
│   ├── api/{auth,sync,partners}.php
│   ├── schema.sql
│   └── schema.mysql.sql
└── README.md
```

`frontend/` never imports from `backend/`. The only coupling is the JSON contract in §10.

### Why the engine is separated

All Schengen math lives in `src/engine/` as pure functions with no dependencies. This
makes it unit-testable without a DOM, reusable by the graph, the PDF renderer and the
partner joint-scan alike, and impossible to accidentally couple to UI state. Each unit
answers "what does it do / how do you use it / what does it depend on" in one line.

---

## 6. Data model

### Stay (core record)

| field | type | notes |
|---|---|---|
| `id` | UUID string | **client-generated** so offline records have stable identity |
| `name` | string | e.g. "Barcelona" |
| `country` | string \| null | optional |
| `startDate` | `YYYY-MM-DD` | ISO date, no time component |
| `endDate` | `YYYY-MM-DD` | must be `>= startDate` |
| `createdAt` | ISO timestamp, UTC | |
| `updatedAt` | ISO timestamp, UTC | drives last-write-wins |
| `deleted` | boolean | tombstone; never hard-deleted locally until synced |
| `ownerId` | string \| null | null when anonymous; set on claim |

### User

`id`, `email`, `passwordHash`, `displayName`, `settings` (JSON — default sharing level, etc.)

### Partnership

`id`, `fromUserId`, `toEmail`, `toUserId` (null until accepted),
`status` (`pending` | `accepted` | `declined` | `revoked`),
`sharingLevel` (`graph_only` | `full`), `createdAt`, `updatedAt`.

Sharing is **one-directional per record**. Accepting an invite does not auto-share back;
each side controls its own visibility independently.

### Local storage (Dexie v1)

| table | indexes | purpose |
|---|---|---|
| `stays` | `id`, `updatedAt`, `deleted` | source of truth |
| `meta` | key | `apiUrl`, `token`, `userId`, `lastSync` |
| `partners` | `id`, `status` | partnership records |
| `partnerCurves` | `partnerId` | cached graph_only series + `fetchedAt` |

There is deliberately **no separate sync queue** — `stays where updatedAt > lastSync`
*is* the pending set. One fewer structure to desynchronise.

---

## 7. Stays: input and editing

- Dates always display as **`DD MMM YYYY`** (`27 Nov 2026`). A raw or empty native date
  field never appears anywhere in the UI.
- Entry uses a **custom dark calendar sheet** with range selection: tap start, tap end.
- The edit modal is initialised from the stay object it is opened with, pre-filling
  name, country and **both** dates. There is no code path that yields an empty date
  field on edit.
- Validation: `endDate >= startDate`, name non-empty. Errors render inline next to the
  offending field. No silent failures.
- **Duration is inclusive of both entry and exit days.** 23 Jul → 30 Jul = 8 days.
- Writes hit IndexedDB immediately; `useLiveQuery` re-renders the list, graph and tiles
  reactively. No page reload, no manual re-entry.

---

## 8. The compliance engine

For a reference date `D`, count days present within the **inclusive** window
`[D − 179, D]`. Both entry and exit days count. The limit is **90**.

```
daysOfStay(stay)              → ISO dates, inclusive both ends
contribution(stay, D)         → count of this stay's days inside [D−179, D]
usageOn(stays, D)             → Σ contribution(stay, D)
series(stays, from, to)       → [{ date, total, byStay: { [id]: n } }]
status(used)                  → 'compliant' | 'warning' | 'over'
feasibility(stays, proposed)  → { ok, breachDate, peakUsed }
jointWindows(mineSeries, theirSeries, minLength, horizon) → [{ from, to }]
```

Overlapping stays must not double-count: a day present in two stays is one day of
presence. `daysOfStay` results are unioned into a date set before counting; for the
per-stay decomposition, a shared day is attributed to the earlier-starting stay so the
bands still sum exactly to `total`.

**Status thresholds:** `compliant` ≤ 75 · `warning` 76–90 · `over` > 90.

`series()` returning `byStay` is what makes the graph work: the stacked bands *are* the
decomposition of the rolling total, summing to it by construction rather than being an
approximation drawn alongside it.

---

## 9. Screens and UX

Bottom tab bar: **Tracker · Partners · Settings**.

### Tracker (primary screen), top to bottom

```
[ 47 days used ] [ 43 remaining ] [ ✓ Compliant ]     ← summary tiles
──────────────────────────────────────────────────
   stacked per-trip areas + 90-day limit line
   past solid · future dashed · "today" marker
   ┣━░ Lisbon ━┫ ┣━▒ Paris ━┫ ┣━█ Barcelona ━┫      ← trip ribbon, same x-axis
──────────────────────────────────────────────────
   compact stay list — tap expands, swipe-left deletes
                                              (+) FAB
```

- Graph is **on top**, values underneath. The list is a compact list, not a large block.
- X range: earliest stay → today + 180 days.
- Each stay has a stable assigned colour used by its band, its ribbon segment and its
  list row — the same colour identifies it everywhere.
- Tapping a list row dims every other band; tapping a band scrolls to and highlights its
  row. A single `highlightedStayId` piece of state drives both directions.
- Graph must be readable without horizontal scrolling on a phone.
- **Empty state** explains that the app works with no account and no network.
- Offline/sync status is a subtle header pill: `synced` / `syncing` / `offline` /
  `3 pending`.

### PDF

Opens full-screen from the Tracker header.

- Rendered **client-side** with `@react-pdf/renderer`, so it works offline.
- **Preview in-page first**, download only as a separate deliberate action. Never a
  forced download to view. `<PDFViewer>` on desktop; `<BlobProvider>` into an embedded
  view on mobile, because iOS Safari cannot render `PDFViewer`.
- Contents: stays table, compliance graph (serialised SVG so it stays vector), current
  window status, generated-on date.

---

## 10. Sync and the optional account

### Rules

- **Claim on register/login:** every local stay with `ownerId = null` gets the new
  `ownerId`, `lastSync` resets to null, and everything is pushed. Nothing entered
  offline is ever lost.
- **Delta-based:** client pushes stays with `updatedAt > lastSync`; server returns its
  changes since `lastSync`.
- **Conflict resolution: last-write-wins per record** on `updatedAt`. Deletes propagate
  as tombstones. Client-generated UUIDs mean the same record merges instead of
  duplicating.
- **Offline while logged in:** writes continue to IndexedDB. `online`/`offline` events
  are handled explicitly and trigger a flush on reconnect.
- **After logout local data persists.** The next login runs the same bidirectional delta
  sync rather than overwriting either side.
- Sync is background. The UI never awaits the network.

### API (PHP, JSON)

```
POST /api/auth/register        POST /api/auth/login
POST /api/auth/logout          GET  /api/auth/me
POST /api/sync                 { lastSync, changes[] } → { serverTime, changes[] }
POST /api/partners/invite      POST /api/partners/respond
POST /api/partners/revoke      GET  /api/partners
GET  /api/partners/{id}/tracking
```

Password hashing via `password_hash`. Bearer-token auth, tokens stored hashed. All
queries parameterised. Errors return clear JSON with appropriate status codes.

---

## 11. Partner sharing

### Invites

Enter a partner's email in-app to send an invite; they accept in-app. On acceptance the
`Partnership` becomes `accepted`.

### Viewing a partner

Once accepted, the partner's tracking is visible **at the sharing level they chose**.
A proposed trip ("Barcelona, 12–20 Sep") can be entered and checked against the 90/180
rule for **both** people, flagging who (if anyone) would breach.

### Auto-detected joint windows

The app scans forward **12 months** and highlights date ranges where both partners have
enough remaining allowance to travel together. A **minimum trip length** filter narrows
the results (e.g. "windows where we both have ≥ 7 days free"). The user never reasons
about this manually — it is derived from both datasets.

### Privacy (enforced server-side)

- The sharer controls visibility per partnership, in settings: `graph_only` or `full`.
- **`graph_only` (default):** the partner receives only `[{ date, used, remaining }]`.
  Trip names, countries and individual stay records are **never written into the
  response**, so there is nothing for a client to hide or leak.
- **`full`:** stays with names and dates are included.
- `jointWindows()` operates on exactly the `graph_only` payload, which proves the
  privacy boundary rather than asserting it.
- Sharing is revocable at any time; revocation takes effect server-side immediately.

---

## 12. Error handling

- **Form validation** renders inline, per field.
- **Sync failures** never block or interrupt the UI. The status pill shows the pending
  state; a retry happens on the next online event or user action.
- **Auth expiry** drops to anonymous-but-local: data stays visible, the pill shows a
  re-login prompt. No data loss, no forced logout screen.
- **PDF generation failure** surfaces an in-page error with a retry, never a blank
  viewer.
- **Backend unreachable** is a normal state, not an error state — it is indistinguishable
  from offline and treated identically.

---

## 13. Testing

**Vitest, on the pure engine:**

- Inclusive duration: 23 Jul → 30 Jul = 8 days.
- Window boundary: a day exactly 179 days before `D` counts; 180 days before does not.
- Overlapping stays do not double-count.
- Per-stay bands sum exactly to the rolling total on every date in the series.
- Status thresholds at 75/76, 90/91.
- LWW merge: newer `updatedAt` wins in both directions; tombstones survive a round-trip.
- `jointWindows` returns only ranges where neither person exceeds 90.

**Manual airplane test** (the acceptance gate):

1. `npm run build`
2. Open `dist/index.html` directly from the filesystem, DevTools set to offline.
3. Add, edit and delete stays; confirm dates pre-fill on edit; read the graph;
   preview and export the PDF.
4. Go online, log in, confirm local stays are claimed and synced without duplication.

---

## 14. Order of work

Each stage must be independently runnable.

1. Vite/React/Tailwind scaffold with Dexie, Framer Motion, PWA and singlefile plugins.
2. Engine + tests, then local stays CRUD with correct dates and the reactive graph.
3. PDF preview and export.
4. PHP backend, auth, delta sync; wire claim-on-login and the offline queue.
5. Partner invites, server-enforced privacy filtering, joint-window detection.
6. `README.md` (run and build steps for both halves) + schema files.

---

## 15. Deliverables

- `frontend/` — dev server and a verified standalone single-file production build.
- `backend/` — PHP API with `schema.sql` and `schema.mysql.sql`.
- `README.md` — exact run instructions for both halves.
- This spec.
