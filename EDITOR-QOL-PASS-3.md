# Editor Card QoL Pass 3

Implemented changes:

- Tree marker and viewer flags now live on their own row beneath the compact checkbox flag grid.
- Stable ID and Last saved display as plain metadata, without bordered field styling.
- Custom field cards use gap-aware percentage widths so two `50%` cards can sit beside one another in the editor card.
- Viewer Edit buttons open the detached shell editor when Electron shell support is available; browser mode keeps the inline editor.
- Detached editor mode visually renders only the editor card, without the viewer backdrop, rounded card border, or dimmed viewer behind it.
- Detached editor Cancel/Close closes the shell window.
- RankText is now a 16-character text field. RankStyle is a visual style selector; its dropdown items render rank pills instead of plain text labels.
- Custom field cards no longer embed full markdown editors directly in the layout grid. Prose cards show a preview and an Edit button that opens a focused markdown editor panel.
- Field drag and width cycling are constrained to explicit handles, so clicking the card no longer causes resize/reorder behavior.
- Hardcoded banner image viewer/editor UI is deprecated and no longer rendered. Use image custom fields instead.
- Electron shell context menu now offers Open in New Viewer Window. Cross-platform Electron tab strips were not added because Electron does not provide a complete built-in tab UI; this is the safe interim shell behavior.

Remaining next steps:

1. Replace the width-cycle handle with a true drag-resize grip if a layout library is added.
2. Add an app-shell custom field editor window instead of the current focused modal when running under Electron.
3. Add a tabbed shell workspace if the project adopts a custom tab strip, likely one BrowserView/WebContentsView per tab.
4. Add rank-style preset editing in Project Settings.
5. Add migration/cleanup for existing hardcoded banner media files if users want the old files moved into image custom fields automatically.
