# clad0 — Field Journal of the Throat

A Node.js server that serves the taxonomy viewer and exposes a REST API for
reading and editing the taxonomy data, which is persisted to disk as JSON
rather than embedded in a single HTML file.

## Quick start

```bash
node server.js          # listens on http://localhost:3000
PORT=8080 node server.js
npm start               # same as node server.js
npm run dev             # same but restarts on file changes (Node ≥ 18)
```

No dependencies beyond Node.js itself (≥ 18). Nothing to install.

## File layout

```
clad0/
├── server.js          ← entry point — run this
├── package.json
├── data/
│   └── clado.json     ← full taxonomy tree (read/write)
└── public/
    ├── index.html     ← HTML shell (loads style.css and viewer.js)
    ├── style.css      ← all viewer styles
    └── viewer.js      ← viewer application; fetches /api/clado on load
```

## REST API

| Method   | Path                | Description                                      |
|----------|---------------------|--------------------------------------------------|
| `GET`    | `/`                 | Viewer shell HTML                                |
| `GET`    | `/api/clado`        | Full CLADO tree as JSON                          |
| `GET`    | `/api/node/:id`     | Single node by id                                |
| `PUT`    | `/api/node/:id`     | Update prose/metadata fields of an existing node |
| `POST`   | `/api/node`         | Append a new child node                          |
| `DELETE` | `/api/node/:id`     | Remove a node and its entire subtree             |

### PUT — update a node

Send any subset of writable fields as a JSON body. The `id` and `c` (children)
fields are ignored; structural changes go through POST/DELETE instead.

```bash
curl -X PUT http://localhost:3000/api/node/el-lithic-order \
  -H 'Content-Type: application/json' \
  -d '{"note":"Updated note text", "gorge": true}'
```

Response: `{ "ok": true, "id": "el-lithic-order", "changed": ["note","gorge"] }`

### POST — add a new child node

```bash
curl -X POST http://localhost:3000/api/node \
  -H 'Content-Type: application/json' \
  -d '{
    "parentId": "el-earth-phylum",
    "node": {
      "id": "el-my-new-order",
      "n": "My New Order",
      "r": "Order",
      "c": []
    }
  }'
```

### DELETE — remove a node

```bash
curl -X DELETE http://localhost:3000/api/node/el-my-new-order
```

## Node schema

Key fields the viewer uses:

| Key          | Meaning                                              |
|--------------|------------------------------------------------------|
| `id`         | Stable unique identifier (string, no spaces)         |
| `n`          | Display name                                         |
| `r`          | Taxonomic rank (Kingdom, Phylum, Class, …, Species)  |
| `c`          | Children array                                       |
| `g`          | Summary / first prose section                        |
| `tax`        | Taxonomic definition                                 |
| `ap`         | Physical appearance                                  |
| `eco`        | Ecology / persistence                                |
| `beh`        | Behaviour                                            |
| `traitsText` | Stable traits                                        |
| `abilities`  | Abilities                                            |
| `bg`         | Background / field relevance                         |
| `sn`         | Scientific name (italic in viewer)                   |
| `t`          | Trait tags array (e.g. `["mineral","mega"]`)         |
| `gorge`      | `true` → present in the active Gorge                 |
| `ctx`        | `true` → context/non-Gorge entry                     |
| `theorized`  | `true` → inferred, no specimen                       |
| `fossil`     | `true` → extinct                                     |
| `tag`        | `"Reference"` or `"Catalogue"` for non-taxon nodes  |

## Editing in-browser (next step)

The viewer already renders all eight prose sections. The next milestone is to
wire a click-to-edit overlay that POSTs the edited fields to `PUT /api/node/:id`
and re-renders the affected entry without a full page reload.
