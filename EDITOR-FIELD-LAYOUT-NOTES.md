# Editor field layout notes

This pass adds the foundation for treating custom fields as layout-aware editor/viewer components.

## Field metadata

Each field may carry layout metadata:

```json
{
  "key": "appearance",
  "label": "Appearance",
  "type": "prose",
  "layout": {
    "width": "50%",
    "overflow": "scroll",
    "sticky": false
  }
}
```

Supported common widths are `25%`, `33%`, `50%`, `66%`, `75%`, and `100%`.

## Implemented editor behavior

- Custom field values render in a percentage-based flex grid.
- Fields can be dragged to reorder them.
- The resize handle cycles through common percentage widths.
- Field definitions can also be dragged to reorder.
- Overflow can be set to grow or scroll.
- Sticky fields are rendered sticky in the viewer.
- Image fields can upload media into the project `/data/media` folder and store the resulting `/media/...` reference on the entry.
- Statblock fields render as statblock placeholders and respect the project `statsEnabled` flag.

This is a native implementation rather than a jQuery UI dependency. It preserves the same product behavior without adding a new packaged dependency to the app shell.

## Not yet done

- True freeform subsection/region design, such as named sidebars.
- Multi-field selection and bulk layout edits.
- Visual drag handles for nested field groups.
- A dedicated media library manager.
- Rich diff UI for conflicting editor saves.
