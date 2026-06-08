# Export / Media / Crosslink Renderer Pass

Implemented in this pass:

- Added **Export as... PDF** for entry and subtree context menus.
  - Electron shell uses `webContents.printToPDF()` and a Save dialog.
  - Browser mode falls back to an HTML print window.
- Renamed Project menu wording from `/data`-specific wording to **Open Data Folder** / **Use Existing Data Folder**.
- Added **Project -> Media Library Manager...**.
  - Opens `electron/media-manager.html`.
  - Lists files from the active project `/data/media` folder.
  - Provides open file/folder actions.
- Added a plugin-like custom field renderer registry in `viewer.js`.
  - `window.clad0RegisterFieldRenderer(type, fn)` can register/override field renderers.
  - Built-ins now use the registry path.
- Added `sublinks` custom field type.
  - Renders the current entry's visible children using the same list renderer as crosslinks.
- Generalized `crosslink` rendering.
  - Crosslinks now render as the same linked entry list style used by `sublinks`.
- Removed the hardcoded subordinate taxa section from the default viewer render.
  - Add a custom field with `type: sublinks` to opt into that display.
- Added prose crosslink syntax:
  - `[[entry-slug]]`
  - `[[entry-slug | Alias]]`
  - stored as `[[sid:<stable-id> | Alias]]` on save when a target can be resolved.
  - decoded back to current slugs when opened in the editor.
- Added lightweight crosslink autocomplete after three typed characters.
  - Works in plain text inputs and EasyMDE/CodeMirror markdown editors.

Notes:

- This pass still avoids adding jQuery UI as a new dependency. The project already uses EasyMDE/CodeMirror, D3, marked, and DOMPurify from bundled vendor assets. A jQuery UI adoption should be explicit because it adds a second UI interaction framework and CSS layer that would need to be themed across shell/project surfaces.
