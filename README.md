# Schengen Tracker

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

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

### A note on Node 18

`frontend/package.json`'s build script is:

```json
"build": "NODE_OPTIONS=--experimental-global-webcrypto vite build"
```

Node 18 has no global `crypto`, and `workbox-build` (used by `vite-plugin-pwa` to
generate the service worker) requires one at build time. The flag is a Node-18
accommodation only: it is already inert on Node 20+, where `crypto` is a real global,
and can be removed entirely if you upgrade. `vite.config.js` also sets
`globalThis.crypto ??= webcrypto` at the top of the config file for the same reason, and
raises workbox's `maximumFileSizeToCacheInBytes` to 6 MB — the single-file production
bundle is roughly 2.1 MB once Recharts and `@react-pdf/renderer` are inlined, which is
past workbox's 2 MiB default precache limit.

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
php -S 127.0.0.1:8123 backend/index.php
curl http://127.0.0.1:8123/api/health     # {"ok":true,"driver":"sqlite"}
```

The SQLite file is created automatically at `backend/data/app.sqlite` on first request,
using `backend/schema.sql`.

Then, in the app: **Settings → Server address → `http://127.0.0.1:8123` → Save and
test**, and create an account. Any stays you already entered are claimed by that
account on your first sign-in.

Port `8123` is just this host's example port — use whatever port is free on yours; the
app has no assumption about it beyond what you type into Settings.

### Using MySQL instead

The schema is driver-agnostic; `backend/schema.mysql.sql` is a 1:1 port. Point the
backend at MySQL with environment variables:

```bash
SCHENGEN_DB_DSN='mysql:host=127.0.0.1;dbname=schengen;charset=utf8mb4' \
SCHENGEN_DB_USER=schengen \
SCHENGEN_DB_PASS=secret \
php -S 127.0.0.1:8123 backend/index.php
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

## Verification status

Automated verification (test suite, production build, self-containment check, and a
backend smoke test) has been run and passed — see the commands below. The manual
**airplane acceptance test** — driving the built `dist/index.html` in a real browser
with DevTools set to Offline — has **not** been run as part of this delivery; it
requires a human at the keyboard and is the remaining verification step before this is
considered fully signed off.

```bash
cd frontend
npm test          # 73 tests
npm run build
grep -o 'src="[^"]*\.js"' dist/index.html   # must print nothing
```

To run the manual pass yourself, open the built file with DevTools offline and network
throttling on:

```bash
xdg-open "file://$PWD/dist/index.html"
```

and work through:

1. The empty state explains that no account is needed.
2. Add three stays with the custom calendar. Each shows `DD MMM YYYY`.
3. The summary tiles, the stacked graph, the 90-day limit line, the today marker and
   the trip ribbon all render.
4. Tap a stay row → its band highlights and the others dim. Tap a ribbon segment → the
   same link works in reverse.
5. Tap **Edit** on a stay → the name, country and **both dates** are pre-filled.
6. Set an end date before the start date → an inline error appears, and nothing saves.
7. Swipe a row left → it deletes with an Undo toast → Undo restores it.
8. Preview the PDF in-app, then download it and open the file — chart, tiles, stays
   table and generated-on date all present.
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

## License

Released under the [MIT License](LICENSE) © 2026 Olivier Lüthy. You're free to use, modify and distribute this
software, including commercially, as long as the copyright notice and license are included.

## Author

Built by **Olivier Lüthy** — [GitHub](https://github.com/olivierluethy).
