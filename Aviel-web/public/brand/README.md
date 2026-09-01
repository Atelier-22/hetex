# Brand assets

The Aviel wordmark is **drawn as type, not loaded as an image** — see
`src/components/logo.tsx`. It sets "Aviel" in Cormorant Garamond over the
`Think · Decide · Grow` strapline, follows the light and dark themes, and stays
crisp at any size. There is nothing to export and nothing to keep in sync.

The five PNG logo and lockup files that used to live here have been removed.
They were the previous brand's artwork, nothing referenced them once the
wordmark became type, and leaving them would have meant the old identity
resurfacing the next time someone reached for a logo file.

## What is still an image, and still wrong

These four are the **previous brand's artwork**. They cannot be generated from
type, because the browser and the operating system need real image files:

| File | Used by | Size |
| --- | --- | --- |
| `favicon.ico` | Browser tab | multi-size ico (16/32/48) |
| `apple-touch-icon.png` | iOS home screen | 180×180, no transparency — iOS composites on black |
| `icon-192.png` | Web app manifest | 192×192 |
| `icon-512.png` | Web app manifest, install prompt | 512×512 |

Until they are replaced, a browser tab and an installed icon still show the old
mark. Replacing them is a design task, not a code one: drop in files with these
exact names and sizes and nothing else needs to change.

`favicon.ico` and `apple-touch-icon.png` are **also served from the site root**,
because browsers request `/favicon.ico` unconditionally and iOS requests
`/apple-touch-icon.png`, both ignoring the tags in `layout.tsx` entirely. The
copies in `public/` and `public/brand/` must match.

## The mark

Where a square icon is needed — a collapsed sidebar, an avatar slot —
`AvielIcon` draws a serif "A" on the accent gradient. It is the one place the
accent is allowed to carry the brand, because there is no wordmark beside it to
do that job.
