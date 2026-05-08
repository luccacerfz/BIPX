# Config Runtime (Phase 1)

This folder centralizes tunable game configuration for camera, lighting, fog,
quality, and gameplay values.

## Files

- `defaults.js`: baseline values for `desktop`, `mobilePro`, `mobile`, and `tablet`
- `schema.js`: metadata for editor controls (type, min, max, step)
- `targets.js`: target resolution (`desktop` / `mobilePro` / `mobile` / `tablet`)
- `runtime.js`: override store + localStorage persistence + subscriptions
- `index.js`: public exports

## Notes

- Phase 1 only introduces the config foundation.
- `src/main.js` still uses existing values directly and will be migrated in
  phase 2.
