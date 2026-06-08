# Desktop settings and menu notes

## Implemented in this pass

- Renamed **Reveal Active /data Folder** to **Open Project Folder**.
- Renamed the project-picker row action from **Show folder** to **Open Project Folder**.
- Removed the default Electron **Edit** menu because it was not intentionally designed for clad0 yet.
- Added **View → Sunburst View** as a checkbox menu item that calls the same renderer function as the in-page sunburst button.
- Added renderer-to-main state reporting so the menu checkbox updates when Sunburst View is toggled from the page button.
- Added **Project → Project Settings…**.
- Added **Project → App Settings…**.
- Added per-project `/data/project-settings.json`.
- Added app-level `app-settings.json` in Electron user data.
- Updated empty project creation to include `project-settings.json` alongside `clado.json`, `prose/`, `stats/`, and `media/`.

## Current project settings

Project settings are stored inside the active project `/data` folder and move with the project:

- project display name
- description
- Appearance category with built-in/custom theme selection and media display settings
- feature toggles for Sunburst View, Stats UI, Media UI, and Stale Tracking
- read-only project metadata and important paths

## Current app settings

App settings are stored in Electron user data:

- show project picker on launch
- restore last project
- app shell appearance preferences
- advanced developer tools visibility
- read-only app metadata and important paths

The project registry remains in Electron user data as `projects.json`; it is a user-specific pointer list, not project data.

## Future planning candidates

These are good candidates for a later design pass once the repo’s workflow is clearer:

- Move expand/collapse/search visibility preferences into app settings.
- Add project-level taxonomy/display defaults beyond the current Appearance feature gates.
- Add export/backup/import actions under Project once the `/data` format is finalized.
- Add a deliberate Edit menu later if there are real app-level commands for undo/redo beyond text fields and the in-page editor.

## 2026-06 settings refinement

- Project Settings and App Settings are now distinct windows.
- Each settings window uses a left category sidebar and styled setting rows.
- Mutable app settings moved to Electron user data to avoid writing to temporary/runtime install paths.
- Project Settings now has General, Appearance, Paths, and Advanced categories.
- App Settings now has General, Appearance, Paths, and Advanced categories.
- Project Appearance owns feature gates for Sunburst, Stats, Media, and Stale Tracking.
- Project Appearance owns the CSS theme selection. Built-in themes are packaged with the app shell under `clad0-server/public/themes/`.
- `CUSTOM-THEMES.md` documents theme authoring sections and stable CSS regions.
- Stale tracking uses the `revised` field stored in `clado.json`; it does not rely on filesystem metadata.

## 2026-06 shell/viewer implementation pass

- Added project `features.allowEdits`; when disabled, mutation UI is hidden and `/api/node*` writes are rejected by the server.
- Entry right-click menus are now shell-aware: Electron receives an entry payload and opens a native menu; normal browsers keep the HTML fallback menu.
- Added detached Electron editor windows using the existing server entrypoint and viewer with `?editor=<entry-id>`.
- Added custom-field layout metadata controls for common percentage widths, sticky behavior, and overflow mode.
- Added project-local custom field template definitions under Project Settings → Advanced.
- Added stale save conflict detection using the stored `revised` field, not filesystem metadata.
- Expanded entry export to support entry/subtree JSON and Markdown.

## Pass update: stale tracking and shell-aware editor behavior

- Missing, empty, nonnumeric, or zero `revised` values now count as stale when stale tracking is enabled.
- The tree stale marker appears for entries with no proper saved timestamp.
- Last Saved displays `Unknown / never saved` for missing timestamps.
- Custom image fields can upload project media and store a stable `/media/...` reference on the entry.
- The custom-field editor now provides shell-independent drag reorder and percentage width resizing.
- Electron shell mode receives native right-click entry menus; browser mode keeps the fallback HTML context menu.
