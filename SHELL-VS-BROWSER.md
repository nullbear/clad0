# Shell-dependent vs browser-dependent behavior

clad0 can run as a normal browser-hosted viewer or inside the Chromium/Electron desktop shell. The viewer must detect the shell through `window.clad0Desktop && window.clad0Desktop.isShell` and avoid assuming Electron-only capabilities exist.

## Context menus

Browser mode owns the HTML fallback context menu. Electron shell mode owns the native menu. The viewer still decides which entry was clicked and sends a small action payload to the shell, but it does not also render the browser context menu in shell mode.

Browser fallback supports export downloads through normal Blob downloads. Shell mode may later replace those with native Save dialogs, but the viewer-side export endpoints stay available.

## Detached editor windows

Only the shell can open a separate resizable editor window. Browser mode keeps editing in the modal editor. Viewer code exposes the current entry id and editor route through shell IPC, but browser mode does not show shell-only window controls.

## File-system access

Opening folders, picking arbitrary custom CSS files, creating project backups, and managing known project paths belong to the shell. Browser mode can display configured paths but should not require local filesystem access.

## Project feature enforcement

Feature flags are not shell-only. `allowEdits`, `sunburstEnabled`, `statsEnabled`, `mediaEnabled`, and `staleTrackingEnabled` must affect both browser and shell mode. The server also enforces `allowEdits` so read-only projects cannot be modified by hidden or manually-called write endpoints.

## Theme boundaries

Project themes style project/viewer presentation. App-shell styling protects editor/settings/shell controls so a project theme cannot accidentally break critical authoring UI. Custom project CSS should be scoped to viewer surfaces whenever possible.

## Clipboard and downloads

Browser mode should use standard browser APIs. Shell mode can provide native dialogs and clipboard helpers later, but the viewer should always retain a browser-safe fallback.

## Dev tools and diagnostics

Developer tools, runtime folders, logs, and packaged app diagnostics are shell concerns and belong in App Settings -> Advanced. They should not be exposed from Project Settings or the browser-hosted viewer.

## Future shell-only candidates

- Native Save As dialogs for entry/subtree export.
- Native file pickers for custom themes and media selection.
- Recent projects jump list.
- OS-level open/reveal actions.
- Detached compare/diff windows for save conflicts.

## Future browser-only/public candidates

- Static hosted read-only viewer.
- Browser-safe export downloads.
- Public search/index routing.
- Public permalink routing by slug or stable id.

## Theme boundary

clad0 intentionally separates app-shell themes from project viewer themes.

- App-shell themes are app-local and live under `electron/shell-themes/`. They style settings windows and shell-owned HTML surfaces.
- Project viewer themes are project-selected and live under `clad0-server/public/themes/`. They style the browser/server viewer and exported project-facing surfaces.
- Native Electron/OS menus are not CSS-styled by the app. They may follow OS appearance instead.
- Browser fallback right-click menus use viewer/project CSS because they are part of the browser-rendered project UI.

## Additional shell/browser boundaries identified in Editor QoL pass 3

- **Editing surface**: In the Electron shell, entry edit actions should prefer detached editor windows. In browser mode, the inline modal editor remains the fallback.
- **Context menus**: Electron shell should own native right-click menus. Browser mode should render the HTML fallback menu because there is no shell menu service.
- **Viewer tabs**: Browser mode naturally uses browser tabs. Electron does not provide a cross-platform tab strip by default, so the current shell-safe behavior is opening additional viewer windows. A future shell tab system should be implemented deliberately with BrowserView/WebContentsView and explicit tab state.
- **Editor chrome**: Detached shell editor windows should use app-shell styling and not inherit project-theme presentation chrome or viewer backdrops.
- **Project theme vs editor UI**: Project themes style rendered project content. Editor controls, detached editor windows, settings windows, and native shell affordances belong to the app-shell visual layer.
- **Deprecated hardcoded media**: Hardcoded banner display/upload UI is now browser/shell independent and disabled in both. Image custom fields are the preferred project-rendered media model.

## PDF export and media manager

- PDF export is shell-enhanced. In Electron, the viewer sends export HTML to the shell and the shell writes a PDF through `webContents.printToPDF()` after a Save dialog.
- In browser mode, PDF export falls back to opening a printable HTML document.
- The Media Library Manager is shell-only because it scans and opens the active external `/data/media` folder through Electron filesystem access.
