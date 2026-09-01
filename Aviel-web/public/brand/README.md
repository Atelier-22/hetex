# Brand assets

The app references these by exact filename. Names must match.

| File | Used by | Notes |
| --- | --- | --- |
| `Aviel-logo-color.png` | Empty-chat screen (80px), collapsed sidebar (28px) | Icon only, square, transparent. 512×512 or larger |
| `Aviel-lockup-light.png` | Sidebar header and auth pages **in light theme** | Icon + wordmark, **dark text**, transparent |
| `Aviel-lockup-dark.png` | Sidebar header and auth pages **in dark theme** | Icon + wordmark, **white text**, transparent |
| `favicon.ico` | Browser tab | Multi-size ico (16/32/48) |
| `apple-touch-icon.png` | iOS home screen | 180×180, no transparency — iOS composites it on black |
| `icon-192.png` | Web app manifest | 192×192 |
| `icon-512.png` | Web app manifest, install prompts | 512×512 |

## Why two lockups

The wordmark colour is baked into the artwork, so one file cannot serve both
themes. [`logo.tsx`](../../src/components/logo.tsx) picks between them from the
resolved theme, which also covers "system".

## Sizing

The lockup renders height-driven with `width: auto`, so its own aspect ratio
decides the width and it can never be stretched. Supplying a `width` treats it
as a maximum for the same reason. Export the two lockups at the **same aspect
ratio** or the header will shift height when the theme changes.

## If a file is missing

Nothing renders broken: the lockup falls back to the text "Aviel AI" and the
icon to a screen-reader-only label. The favicon will 404 in the tab until
`favicon.ico` exists.

## Icons are declared in metadata, not by file convention

Next.js would otherwise pick up `src/app/favicon.ico`, `src/app/icon.png`, and
`src/app/apple-icon.png` automatically, and those take precedence over
`metadata.icons`. Those files were removed so everything lives here — don't
re-add them, or they will silently override this folder.
