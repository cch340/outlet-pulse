# OutletPulse — Logo assets

Icon mark + wordmark for **OutletPulse**, a retail-operations monitoring app.
Concept: a heartbeat "pulse" in a rounded tile — the live activity of every outlet.

## Brand tokens

| Token            | Value       | Use                                         |
| ---------------- | ----------- | ------------------------------------------- |
| Accent (silver)  | `#64748b`   | Mark tile fill, "Pulse" wordmark            |
| Accent reversed  | `#94a3b8`   | "Pulse" on dark backgrounds                 |
| Ink              | `#1c1917`   | "Outlet" wordmark, mono-dark tile           |
| Surface / stroke | `#e7e5e4`   | Mono-light tile background                  |
| Pulse stroke     | `#ffffff`   | Heartbeat line inside the filled tile       |

**Typeface:** IBM Plex Sans, weight 700, letter-spacing ≈ -0.02em (matches the app UI).
Load via Google Fonts: `IBM+Plex+Sans:wght@700`.

## Files

### `svg/` — scalable source (edit these)
- `mark.svg` — primary icon, silver tile + white pulse
- `mark-mono-dark.svg` — ink tile (single-color dark)
- `mark-mono-light.svg` — light tile, silver pulse
- `glyph.svg` / `glyph-white.svg` — pulse line only, no tile (transparent)
- `logo-horizontal.svg` — mark + wordmark, on light
- `logo-horizontal-reversed.svg` — for dark backgrounds
- `logo-stacked.svg` / `logo-stacked-reversed.svg` — vertical lockup
- `wordmark.svg` — type only

> The lockup SVGs render live text in IBM Plex Sans (imported inside the file). If you need
> the wordmark as vector outlines (no font dependency), open in a vector editor and
> "convert text to paths", or ask and I'll export outlined versions.

### `favicon/` — rasterized (drop into `/public`)
- `favicon.svg`, `favicon-16.png`, `favicon-32.png`, `favicon-48.png`, `favicon-64.png`
- `apple-touch-icon-180.png`
- `icon-192.png`, `icon-512.png` (PWA / manifest)

## Usage

### HTML head
```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon-180.png" />
```

### manifest.json
```json
{
  "name": "OutletPulse",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ],
  "theme_color": "#64748b",
  "background_color": "#1c1917"
}
```

### React component
See `Logo.jsx` — inline SVG mark + wordmark, `variant="horizontal" | "stacked" | "mark"`
and `tone="default" | "reversed"`. Accent is a prop so it tracks your theme.

## Clear space & minimum size
- Keep clear space ≈ the mark's corner radius on all sides.
- Mark: minimum 20px. Full horizontal lockup: minimum ~120px wide.
- Never stretch, recolor the pulse line, or place the silver tile on a mid-gray background
  (use the mono-dark or mono-light tile there).
