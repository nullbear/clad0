# Theme Pill/Control Pass

This pass makes rank, tag, flag, and rank-style picker surfaces theme-aware.

## Viewer/project themes

Project themes now define shared pill/control variables such as:

- `--pill-font`
- `--pill-radius`
- `--pill-bg`
- `--pill-ink`
- `--tag-pill-bg`
- `--flag-pill-bg`
- `--control-bg`
- `--menu-bg`

These variables are consumed by rank stamps, tree rank pills, tag stamps, flag chips, and the custom RankStyle picker.

## Shell themes

Shell themes now also define button/pill variables so Project Settings, App Settings, project picker, and shell-owned editor controls do not fall back to mismatched browser button styles.

Native Electron context menus remain OS-rendered and cannot be CSS-themed.
