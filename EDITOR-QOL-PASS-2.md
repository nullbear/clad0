# Editor Card QoL Pass 2

Implemented in this pass:

- Moved slug, stable ID, and last-saved metadata to a bottom metadata section.
- Changed the action bar to a sticky in-flow footer so Save/Cancel remain reachable without covering bottom fields.
- Collapsed Name and Subname into a single top row with no labels.
- Generalized `sn` as `subname` placeholder text instead of taxa-specific scientific-name wording.
- Split rank semantics from rank styling:
  - `r` is now treated as RankText.
  - `rankStyle` controls which badge/name styling is applied.
  - blank RankStyle means “match RankText.”
- Added a styled RankStyle preview and styled option classes where the host browser permits option styling.
- Removed viewer rendering for deprecated rank mismatch/expected-rank UI.
- Server strips deprecated rank fields on next save:
  - `rankMismatch`
  - `expectedRank`
  - `hierarchicalRankPosition`
- Moved Tree Marker (`tag`) and Viewer Flags (`flags`) into the compact Flags section.
- Generalized Tree Marker placeholder text and removed reference-specific labeling.
- Tree search now matches:
  - name
  - subname
  - tree marker
  - viewer flags
- Converted legacy `css` flag input into `flags` on save and removes legacy `css` from saved nodes.
- Added client and server validation that entry name cannot be empty.

## Notes

`rankStyle` is intentionally optional. Existing projects without it keep their old visual behavior because the viewer falls back to `r` for styling.

The native HTML `<select>` element has limited cross-platform support for richly styled `<option>` rows. This pass adds option classes and a live styled preview. A later shell-only replacement could use a custom popover/listbox for fully themed rank style selection.

## Next steps

1. Replace the native RankStyle select with a custom accessible listbox so every option can be rendered exactly like the resulting rank badge.
2. Add a Project Settings panel for editing the available RankStyle presets instead of relying on hardcoded CSS rank classes.
3. Decide whether Tree Marker values should become an explicit searchable facet/filter, not only text search.
4. Add a small “clear stale metadata / mark reviewed” batch action now that saved timestamps are field-based.
5. Add tests for deprecated-field stripping during save and for `css` → `flags` migration.
