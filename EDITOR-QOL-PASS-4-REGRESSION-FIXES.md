# Editor QoL Pass 4 — Regression fixes

This pass fixes regressions from the shell-aware/custom-field editor work.

## Fixed

- Detached Electron editor windows now mark the document as editor-only before the viewer paints, reducing the full-viewer flicker that happened while the edit card was opening.
- The detached shell editor window is hidden until `ready-to-show` so users do not see the intermediate viewer state.
- Custom field prose cards no longer embed full markdown editors in the card body and no longer show textarea-like `No content` blocks.
- Custom field modal edits now update the live value object without being overwritten by the layout refresh cycle.
- Saving a single field from the viewer now writes directly to the server and rerenders the selected entry.
- Saving from a detached shell editor now broadcasts an `entry:saved` event to other shell windows so the main viewer can refresh from disk/server state.
- Field-level edit buttons now render inside each field section header, not in the page header.
- Field-level edit buttons open the focused field editor instead of the full edit card.
- Custom field layout cards now use explicit flex sizing so two `50%` fields can sit beside each other when there is enough horizontal space.

## Still intentional

The shell editor still reuses the main viewer script and edit-card builder, but the document is placed into an editor-only shell mode before first paint. A fully separate `editor.html` can still be built later if the editor becomes a substantially different app surface.
