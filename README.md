# Queen's Park NO₂ Monitoring Map — v5

Interactive public Leaflet map for Queen's Park outdoor diffusion-tube monitoring sites QP01–QP18.

## What's new in this version

- Survey selector plus Previous / Next controls.
- Marker colours update with the selected survey result.
- Click a marker to see the current NO₂ result.
- Automatic change from the immediately previous survey, in µg/m³ and percent.
- Historical line chart for the selected site.
- Survey summary showing number of results, median, lowest and highest.
- Direct links can use `?site=QP04&survey=2025-06`.
- QP19 and QP20 remain excluded because they are indoor monitors.

## Data files

- `data/sites.json` — fixed verified master locations for QP01–QP18.
- `data/results.json` — survey results keyed by QP site reference.

Verified result rounds currently loaded:

- June 2017
- June 2018
- June 2019
- July 2021
- June 2024
- December 2024
- June 2025

December 2025 and June 2026 are included in the selector as **pending** only. The uploaded spreadsheets contain later sample references/dates but their NO₂ result column repeats earlier values, so those readings should be verified before public display.

## Upload to GitHub

Replace the existing repository files with the contents of this folder while preserving the structure:

```text
index.html
styles.css
app.js
data/
  sites.json
  results.json
README.md
```

GitHub Pages will update automatically after the commit is deployed.

## Embed elsewhere

The same GitHub Pages URL can later be embedded on Webador and the Queen's Park Community Council website with an iframe.


## Marker rounding
Marker labels use standard rounding to the nearest whole number (for example 32.4 → 32 and 32.5 → 33). Marker colours are based on that rounded value.


## Missing results
If a monitoring site has no usable result for a survey (for example a missing/lost tube, invalid result, or unverified data), its marker remains visible at the fixed site location but is shown as a grey marker with no number. The popup identifies the QP site and states that there is no valid result for that survey.
