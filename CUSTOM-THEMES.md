# clad0 Themes

clad0 now has two separate theme systems.

## 1. App-shell themes

App-shell themes style desktop-controlled interface surfaces:

- App Settings
- Project Settings
- Project picker shell surfaces
- shell-owned editor chrome/overrides
- any future HTML shell dialogs

The native Electron/OS menu and native right-click menu cannot be fully CSS themed because they are rendered by the operating system. Browser fallback context menus are CSS themed by the viewer/project theme.

Built-in shell themes live in:

```text
electron/shell-themes/
  parchment.css
  wiki-whitepage.css
  discord-dark.css
  scifi-solar.css
```

The selected app-shell theme is saved in Electron user data as `app-settings.json` under `appearance.theme`.

## 2. Project viewer themes

Project viewer themes style the project itself: the tree, entry page, viewer fallback context menu, sunburst view, entry display, project-rendered media, and static/browser presentation surfaces.

Built-in project themes live in:

```text
clad0-server/public/themes/
  parchment.css
  wiki-whitepage.css
  discord-dark.css
  scifi-solar.css
```

The selected project theme is saved in the active project data folder:

```text
/data/project-settings.json
```

```json
{
  "appearance": {
    "theme": "parchment",
    "customThemePath": ""
  }
}
```

The server injects the selected project theme into `index.html` when serving the viewer, and the viewer refreshes it from `/api/project-settings` when settings change.

## Theme loading order

Viewer pages load in this order:

1. `/style.css` base layout and behavior CSS
2. selected project theme from `/themes/<theme>.css`, or `/api/custom-theme.css`
3. desktop shell editor overrides, when running inside Electron

Settings windows load in this order:

1. built-in settings layout CSS
2. selected app-shell theme from `electron/shell-themes/<theme>.css`

## Built-in theme IDs

```text
parchment       Default parchment/book style
wiki-whitepage  Minimal white document style inspired by wiki pages
discord-dark    Dark app-like style inspired by Discord-style surfaces
scifi-solar     Solarized sci-fi terminal/document style
```

## Creating a custom project theme

A custom project theme is a CSS file selected in Project Settings → Appearance. It is not copied into the project automatically; the project stores the selected path.

Start by overriding these common variables:

```css
:root {
  --bg: #f8f9fa;
  --paper: #ffffff;
  --paper-soft: #ffffff;
  --ink: #202122;
  --muted: #54595d;
  --accent: #36c;
  --accent-2: #a2a9b1;
  --border: #a2a9b1;
}
```

Important viewer regions:

```css
body                  /* project viewer background */
#book                 /* full two-page viewer layout */
.page                 /* left/right page surfaces */
#left-page            /* tree/index page */
#right-page           /* entry page */
#spine                /* book spine separator */
#tree-controls        /* search/filter toolbar */
.trow                 /* tree row */
.entry-title          /* current entry title */
.entry-body           /* rendered entry content */
.ctx-menu             /* browser fallback right-click menu */
#sunburst-view        /* sunburst visualization surface */
.statsheet            /* statblock/stat sheet rendering */
.e-banner,.mon-image  /* media surfaces */
```

Use high-specificity or `!important` sparingly. The base app still contains legacy hardcoded styles in a few places, so the bundled themes include targeted overrides for those sections.

## Safety notes

- Avoid remote `@import` rules. The packaged app should work offline.
- Avoid styling global `*` unless necessary.
- Prefer CSS variables and documented regions.
- Keep project CSS focused on viewer presentation. Do not target app settings or Electron shell windows.
- Keep app-shell CSS focused on settings/dialog surfaces. Do not target project viewer content.
