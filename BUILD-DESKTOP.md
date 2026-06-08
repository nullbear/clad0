# Building clad0 as a standalone Chromium `.exe`

This project is packaged with Electron. The built Windows executable contains the Chromium shell, the Node runtime, the `clad0-server/server.js` entrypoint, the browser UI, bundled frontend vendor libraries, and server dependencies.

The mutable `clad0-server/data` folder is intentionally **not** packaged. Each desktop project points at an external `/data` folder selected by the user.

## Run in development

```powershell
npm install
npm start
```

On first launch, clad0 opens a project picker. Use it to:

- create an empty project folder, which creates the minimum required data layout:
  - `clado.json`
  - `project-settings.json`
  - `prose/`
  - `stats/`
  - `media/`
- use an existing clad0 `/data` folder
- switch between registered projects
- open the active project folder from **Project → Open Project Folder**

The active project path is passed to the server as `CLAD0_DATA_DIR`, while `clad0-server/server.js` remains the server entrypoint.

## Build Windows executables

Installer:

```powershell
npm run dist
```

Portable executable:

```powershell
npm run dist:portable
```

Outputs are written to `dist/`.

## Data/project behavior

The executable ships app code and frontend vendor libraries only. User data stays outside the app install and can be backed up or moved independently.

Registered projects are stored in the Electron user-data directory in `projects.json`. Each project record contains a display name and a pointer to its external `/data` folder. Use **Project → Switch Project…** or the project picker to change the active pointer.

Each project stores project-specific settings in its own `/data/project-settings.json`. Current project settings include:

- project display name
- description
- project Appearance settings: packaged CSS theme, optional custom theme path, media display behavior
- project feature toggles: Sunburst View, Stats UI, Media UI, and Stale Tracking
- useful paths for `clado.json`, `prose/`, `stats/`, and `media/`

App-specific settings are stored in Electron's stable user-data folder as `app-settings.json`. The install/runtime folder is treated as immutable app code unless an explicit future portable mode is added. Current app settings include:

- whether to show the project picker on launch
- app shell appearance preferences
- advanced developer tools visibility
- useful stable paths for the app config folder, app settings file, default projects folder, and project registry

## Menu behavior

The desktop menu is intentionally small:

- **Project** contains project switching/creation, project settings, app settings, opening the active project folder, reload, and quit.
- **View → Sunburst View** mirrors the in-page sunburst button and updates when the in-page button changes state.

The standard Edit menu was removed because clad0 already handles editing through its in-page editor controls and the menu had not been intentionally designed yet.

An empty project starts with a hidden `catalogue-root` node and no children. New entries can then be created from inside clad0.
