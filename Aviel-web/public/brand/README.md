# Brand assets

The lockup is **the mark as artwork, with the words set as type beneath it**.
See `src/components/logo.tsx`.

The mark stays a PNG because it is artwork and carries its own colour. The
"Aviel" wordmark and the `Think · Decide · Grow` strapline are type, which is
what removed the old light/dark lockup pair — type follows the theme on its
own, stays crisp at any size, and needs no re-export when the strapline changes.

| File | Used by | Notes |
| --- | --- | --- |
| `Aviel-logo-color.png` | Every lockup, the collapsed sidebar, avatars | Icon only, square, transparent. 512×512 or larger |
| `Aviel-logo-dark.png` | Spare, for a light surface that needs a flat mark | Not currently referenced |
| `Aviel-logo-white.png` | Spare, for a dark surface that needs a flat mark | Not currently referenced |
| `favicon.ico` | Browser tab | Multi-size ico (16/32/48) |
| `apple-touch-icon.png` | iOS home screen | 180×180, no transparency — iOS composites on black |
| `icon-192.png` | Web app manifest | 192×192 |
| `icon-512.png` | Web app manifest, install prompt | 512×512 |

The two old `*-lockup-*.png` files are gone. They had the previous wordmark
baked into the pixels, so they could not survive the rename — and the lockup no
longer needs an image, because the words are type now.

`favicon.ico` and `apple-touch-icon.png` are **also served from the site root**,
because browsers request `/favicon.ico` unconditionally and iOS requests
`/apple-touch-icon.png`, both ignoring the tags in `layout.tsx` entirely. The
copies in `public/` and `public/brand/` must match.

## Components

- `AvielLockup` — mark, then "Aviel", then the strapline. Stacked and centred.
  `height` sizes the mark and the type scales from it, so one number sets the
  whole thing. The strapline drops out below ~22px word size rather than
  rendering as a grey smear.
- `AvielLockupInline` — mark beside the word, for a header row.
- `AvielIcon` — the mark alone, where only a square fits.

If the artwork ever fails to load, a drawn fallback appears rather than a blank
space. It follows the accent colour, because at that point it is interface
chrome standing in for the brand rather than the brand itself.
