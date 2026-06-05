# Changelog

All notable changes to **clad0** are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and the project aims to follow
[Semantic Versioning](https://semver.org/).

---

## [1.0.0-alpha.1] — 2026-06-04

First tagged prerelease. Covers everything since the initial commit `2ef8372`
("First Commit") through the current working tree — the work in the `duping
glitch` commit plus the uncommitted changes. This release turns clad0 from a
fixed-layout taxonomy viewer into a general, schema-driven field-journal editor,
and reworks the radial overview.

> **Heads-up before upgrading:** run `node assign-sids.js` once, with the server
> stopped, before using crosslinks (see _Migration_ below).

### Added

- **Static IDs (`sid`).** Every entry now carries an immutable surrogate id of
  the form `k000123`. Files stay keyed by the human-readable slug, but the sid
  is a stable handle that *follows* the slug across renames. Assigned lazily on
  create and edit.
- **Per-entry field schemas (`fields[]`).** An entry can define its own fields
  instead of the fixed taxon layout. Field types:
  - `prose` — a markdown body section
  - `short` — an italic header line (like a scientific name)
  - `text` — a labelled single line
  - `check` — a boolean, rendered as a labelled badge
  - `select` — a value chosen from a fixed option list
  - `crosslink` — a link to one or more other entries
- **Crosslinks.** The `crosslink` field type references other entries by their
  stable `sid`, so links survive a target's slug rename. You enter target
  slug(s); they're stored as sids and rendered as clickable links showing each
  target's current name. Unresolved/deleted targets show a muted marker.
- **Right-click context menu** on tree rows *and* sunburst arcs: Edit, Add
  child, New child from template ▸, Duplicate (with subtree), Delete.
- **Templates.** Flag any entry as a template (`isTemplate`). _New child from
  template_ deep-duplicates the template into the chosen parent — carrying its
  schema and content — with a fresh sid/slug, your own name and rank, and the
  template flag cleared. The submenu always offers an _Empty entry_ fallback.
- **Duplicate subtree** — `POST /api/node/:id/duplicate`. Clones an entry and
  all descendants with fresh sids and unique slugs, copying prose, stat, and
  image files. Accepts optional `overrides` for light identity fields.
- **Zoomable D3 sunburst overview.** A full-screen radial map of the tree; click
  an arc to focus and zoom, right-click for the context menu.
- **FIFO detail cache (client).** Prose is fetched on demand; once the cached
  total passes a ~2 MB budget, the oldest entries' bulk fields are evicted
  (their light tree fields are kept) and refetched later. Bounds memory in long
  sessions; the open entry is never evicted.
- **`GET /api/sanity`** — read-only integrity report: duplicate slugs, duplicate
  sids, entries missing a sid, and totals.
- **`assign-sids.js`** — idempotent migration that backfills a sid on every
  entry, backs up `clado.json` first, and prints a duplicate-slug report.

### Changed

- **New entries are created clean.** A new child gets an empty custom-field
  schema (`fields: []`) with no taxon prose sections and no inherited flags —
  so it shows a neutral "no content yet" state, and you add fields (or stamp a
  template). Legacy taxon entries (those with no `fields` key) keep the original
  taxon layout untouched.
- **Add-child dialog** reduced to _name_ + _rank_ (the taxon-specific scientific
  name prompt was removed; set it as a field or via a template instead).
- **`PUT /api/node/:id`** now supports slug renames (returns `409` on collision
  and moves the entry's prose/stat/image files), routes prose and schema-prose
  fields to the per-entry detail file, ensures a sid, and stamps `revised`.
- **Sunburst colour model** is now stable hierarchical hue intervals: each node
  splits its hue range evenly among its children, so a node's children fan out
  around its colour and every colour is fixed by tree position — no more
  flicker/reshuffle as you zoom (replaces the old ordinal palette).
- **Sunburst depth**: four generations below the focus are visible at once (was
  roughly two).

### Fixed

- Boolean (`check`) fields rendered a bare "Yes" line; they now render as a
  labelled badge in the badge row.
- Sunburst **ghost labels**: hidden labels still showed their halo because only
  `fill-opacity` was toggled — visibility now toggles whole-element `opacity`.
- Sunburst **ghost borders**: hidden arcs left a faint outline — arc stroke
  opacity now tracks arc visibility.
- Sunburst labels could pile up at the top of the diagram after a zoom.
- Sunburst **lag at high zoom levels**: labels no longer tween per frame (they
  snap into place and fade in after the zoom), and zooms with many on-screen
  arcs snap to the target instead of animating frame-by-frame.
- Add-child crash (`Cannot set properties of null`) introduced when the
  scientific-name input was removed from the dialog.

### Migration

1. Stop the server.
2. `node assign-sids.js` — backs up `clado.json`, assigns any missing sids, and
   reports duplicate slugs. **Required** for rename-safe crosslinks; without a
   sid, a crosslink falls back to storing the raw slug.
3. Restart the server and hard-refresh the browser.

### Known issues

- Eight pre-existing **duplicate slugs** remain in the data
  (`el-proto`, `el-efreeti-genus`, `el-efreeti-noble`, `el-djinn-genus`,
  `el-djinn-noble`, `el-marid-genus`, `el-marid-noble`,
  `ettins-3735580-ettin-families-family`). `GET /api/sanity` lists them; an
  auto-fixer is planned.
- Sunburst rendering, colours, and zoom feel are best judged in a browser; the
  server/test suite can't exercise the live D3 canvas.

---

## Baseline — `2ef8372` ("First Commit")

The starting point this release builds on. It already included (approximately):
the Node HTTP server and single-page viewer; the JSON taxonomy split into a slim
tree (`clado.json`) plus per-entry prose/stat/image files; the fixed taxon entry
layout; custom search-only flags; stale-revision tracking; 5e stat sheets; and
the `move` / `reorder` structural endpoints. Everything in the section above is
new relative to this point.
