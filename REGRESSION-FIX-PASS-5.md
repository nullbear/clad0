# Regression Fix Pass 5

Fixes based on the 15-item report:

- Custom prose field editor now persists the applied value through Save instead of writing blank values.
- Viewer field edit buttons target the specific field editor.
- Custom field rename/delete now removes orphaned light/detail values on save.
- Image field references survive key rename because the existing value is copied to the new key and the old key is cleaned only after save.
- Legacy theme IDs are hidden from selectors and normalized to the four canonical themes.
- Added broader theme coverage for custom-field controls, rank/tag/flag pills, shell editor buttons, and field surfaces.
- Removed/overrode hardcoded rank pseudo-label styling that prevented generic rank styles from working.
- Add-child flow no longer carries dead scientific-name/subname plumbing.
- Detached editor windows now have dirty-close protection.
- RankText and RankStyle no longer display labels in the editor.
- RankStyle picker now shows one pill: the dropdown button itself, not a second preview pill.
- RankStyle options now render as Style 1–Style 8 instead of legacy taxonomy names.
- RankStyle is independent from RankText and applies regardless of the text in the rank pill.
- RankText is the visible pill text, capped at 16 characters.
- Tree viewer rank pills render again using generic style classes.

Notes:

- Existing saved `rankStyle` values such as `Species`, `Kingdom`, etc. are normalized at runtime/server-save into `style-1` through `style-8`.
- The old CSS files `clean-light.css`, `dark-archive.css`, and `high-contrast.css` remain as compatibility aliases, but they are no longer presented as separate selectable themes.
