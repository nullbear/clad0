# clad0 — Field Journal of the Throat

A small, dependency-free Node.js application for browsing and editing a large
phylogenetic field journal. A bare HTTP server exposes a REST API over a JSON
taxonomy; a vanilla-JS single-page viewer renders it as a two-page "book" — a
tree index on the left, the selected entry on the right — with an optional
full-screen radial (sunburst) overview.

Entries are no longer locked to a fixed taxon layout: each entry can define its
own **fields**, link to other entries, be **duplicated**, or be stamped out from
a **template**.

> Status: **1.0.0-alpha.1** (prerelease). See `CHANGELOG.md`.

## Quick start

```bash
node server.js            # http://localhost:3000
PORT=8080 node server.js  # custom port
npm start                 # = node server.js
npm run dev               # restarts on file changes (Node --watch)
```

No dependencies beyond Node.js itself (**≥ 18**) — nothing to install. Windows
launchers `start.bat` / `start.ps1` are included.

After pulling a new build: restart the server and **hard-refresh** the browser.


## Standalone Chromium desktop app

This repo also includes an Electron wrapper for building clad0 as a Windows `.exe` while keeping `clad0-server/server.js` as the server entrypoint.

```bash
npm install
npm start                 # run desktop shell
npm run dist              # build Windows installer .exe
npm run dist:portable     # build portable .exe
```

The desktop wrapper starts `clad0-server/server.js` on a random localhost port, opens it in a Chromium window, and points mutable data at Electron's writable user-data folder via `CLAD0_DATA_DIR`. See `BUILD-DESKTOP.md`.

## Repository layout

```
clad0-server/
├── server.js          ← entry point (run this); in-memory tree + REST API
├── package.json
├── assign-sids.js     ← migration: backfill stable ids (run once, see below)
├── README.md
├── CHANGELOG.md
├── data/
│   ├── clado.json     ← slim taxonomy tree (structure + light fields)
│   ├── prose/         ← per-entry detail, one <slug>.json per entry
│   ├── stats/         ← per-entry 5e stat sheets, <slug>.json
│   └── media/         ← per-entry images
└── public/
    ├── index.html     ← shell (loads style.css + viewer.js)
    ├── style.css
    └── viewer.js      ← the viewer/editor app; fetches /api/clado on load
```

Detail is **split out** of the main tree: `clado.json` holds structure plus
small "light" fields (name, rank, flags, sid, field schema, crosslinks), while
bulk prose lives in `data/prose/<slug>.json` and is loaded on demand. This keeps
the tree fast to load and the data hand-editable.

## Core concepts

### Slugs and static ids

- Every entry has a human-readable **slug** (`id`, e.g. `el-lithic-order`). All
  files are keyed by the slug, so the data stays easy to read and edit by hand.
- Every entry also has an immutable **static id** (`sid`, e.g. `k000123`). The
  sid is a stable handle that **follows the slug** when an entry is renamed.
- Renaming an entry's slug moves its prose/stat/image files and updates anything
  that referenced it — because references are stored by sid, not slug.

### Field schemas

An entry with a `fields` array is in **schema mode** and renders exactly the
fields it declares. Each field is `{ key, label, type, options? }`:

| Type | Renders as |
|------|------------|
| `prose` | a markdown body section |
| `short` | an italic header line |
| `text` | a labelled single line |
| `check` | a boolean → labelled badge |
| `select` | one value from `options` |
| `crosslink` | clickable link(s) to other entries |

An entry with **no** `fields` key falls back to the original fixed taxon layout
(summary / taxonomy / appearance / ecology / behaviour / traits / abilities /
background). New entries are created in schema mode with an empty `fields` array.

### Crosslinks

A `crosslink` field stores the **sid(s)** of its targets. In the editor you type
target slug(s), comma-separated; they're resolved to sids on save. In the viewer
they render as links showing each target's current name and jump to it on click.
Because they hold sids, links keep working after a target is renamed.

### Templates

Mark any entry `isTemplate` to use it as a prototype. Right-click a parent →
**New child from template ▸** to deep-duplicate a template into it (schema and
content included) with a fresh sid/slug and your own name and rank. An _Empty
entry_ option is always offered.

### Sunburst overview

A full-screen radial map of the whole tree. Click an arc to focus/zoom;
right-click for the context menu. Colours use stable hierarchical hue intervals
(fixed by tree position), and four generations below the focus are shown at once.

## REST API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Viewer shell HTML |
| `GET` | `/api/clado` | Full taxonomy tree (slim) as JSON |
| `GET` | `/api/meta` | Dataset metadata |
| `GET` | `/api/sanity` | Integrity report (dup slugs/sids, missing sids, totals) |
| `GET` | `/api/node/:id` | One node, assembled (light fields + prose detail) |
| `PUT` | `/api/node/:id` | Update fields; supports slug rename (`409` on collision) |
| `POST` | `/api/node` | Append a new child of `parentId` |
| `POST` | `/api/node/:id/duplicate` | Clone an entry + subtree (fresh sids/slugs) |
| `POST` | `/api/node/:id/move` | Reparent / reorder an entry |
| `POST` | `/api/node/:id/reorder` | Reorder the children of `:id` |
| `DELETE` | `/api/node/:id` | Remove an entry and its subtree (+ its detail files) |
| `GET`/`PUT` | `/api/node/:id/stats` | Read/write the entry's 5e stat sheet |
| `GET`/`PUT`/`DELETE` | `/api/node/:id/image` | Entry image |
| `GET` | `/media/*` | Static media files |

### PUT — update a node

Send any subset of writable fields. Prose and schema-prose fields are routed to
the detail file; light fields stay on the tree node. Passing a different `id`
renames the slug (moving files, keeping the sid). `revised` is stamped
automatically.

```bash
curl -X PUT http://localhost:3000/api/node/el-lithic-order \
  -H 'Content-Type: application/json' \
  -d '{"note":"Updated note", "gorge": true}'
# → { "ok": true, "id": "el-lithic-order", "sid": "k000042", "changed": ["note","gorge"] }
```

### POST — add a child

```bash
curl -X POST http://localhost:3000/api/node \
  -H 'Content-Type: application/json' \
  -d '{"parentId":"el-earth-phylum","node":{"n":"My New Order","r":"Order","fields":[],"c":[]}}'
```

### POST — duplicate / create from template

```bash
curl -X POST http://localhost:3000/api/node/some-template/duplicate \
  -H 'Content-Type: application/json' \
  -d '{"parentId":"cat-world","name":"The Greymarch","overrides":{"r":"Entry","isTemplate":false}}'
```

## Node fields

Light fields (live on the tree node):

| Key | Meaning |
|-----|---------|
| `id` | Slug — stable, file-keyed identifier (no spaces) |
| `sid` | Static id (`k######`) — immutable; follows the slug on rename |
| `n` | Display name |
| `r` | Rank (Kingdom … Species, or `Entry` for non-taxa) |
| `c` | Children array |
| `sn` | Scientific name / short header line (italic) |
| `fields` | Field-schema array (presence ⇒ schema mode) |
| `flags` | Custom search-only flag slugs |
| `gorge`/`ctx`/`theorized`/`fossil`/`curse` | Taxon badges/flags |
| `isTemplate` | Use this entry as a duplication prototype |
| `staleExempt` | Exclude from stale-revision tracking |
| `revised` | Last-edit timestamp (ms) |
| `tag` | `Root`/`Reference`/`Catalogue` for non-taxon container nodes |

Detail fields (live in `data/prose/<slug>.json`, loaded on demand): `summary`,
`tax`, `ap`, `eco`, `beh`, `traitsText`, `abilities`, `bg`, `g`, `note`, plus any
`prose`-type schema field keys.

## Migration

Run once, **with the server stopped**, especially before using crosslinks:

```bash
node assign-sids.js
```

It backs up `clado.json`, assigns a `sid` to every entry that lacks one, and
prints a duplicate-slug report. Idempotent. Without a sid, a crosslink falls
back to storing the raw slug and is no longer rename-safe.

## Data safety

The server writes JSON to disk on every edit. `assign-sids.js` makes a timestamped
backup of `clado.json` before touching it. Because prose lives in per-entry files
keyed by slug, the data is diffable and recoverable by hand. Keeping `data/` under
version control or a periodic copy is recommended.

## Development & tests

The server is a single file with no build step. The codebase ships with a set of
Node-based test harnesses:

- **Client** tests evaluate `public/viewer.js` whole-file in a VM with a Proxy DOM
  stub — run them from the `clad0-server/` directory.
- **Server** tests copy the repo to a temp dir, spawn the server on a test port,
  poll `/api/clado`, and assert over the REST API.

D3 rendering, the markdown editor, and live click-through behaviour are browser-only
and aren't covered by the headless suites.

## License

MIT.
