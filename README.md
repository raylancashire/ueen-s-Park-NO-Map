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


## Version 6
Adds a collapsible horizontal bar chart comparing all outdoor monitoring locations for the selected survey. The currently selected map location is shown as the location in focus and is highlighted with a stronger outline. Missing results remain visible as gaps/no result.


## v7 comparison chart
The collapsible location comparison chart now shows, for each valid result:
- the percentage of the 40 µg/m³ annual mean legal limit;
- the percentage increase/decrease from the immediately previous survey;
- the same details in the hover tooltip.

A note explains that short diffusion-tube survey periods are not themselves an annual legal-compliance assessment.


## v9 comparison chart
Adds a dashed reference line at 40 µg/m³ to the location comparison chart, labelled as the legal-limit reference.


## v10 update
The location comparison chart now defaults to descending order (highest percentage of the 40 µg/m³ legal limit first). A Sort order switch lets viewers toggle between Descending and Ascending. Missing results remain at the bottom in either order.


## v12 change indicators
The comparison chart uses bold colour-coded change indicators: increases are shown in red with an upward arrow, decreases in green with a downward arrow, and unchanged results in neutral grey.


### v12 fix
Missing/no-result sites are now explicitly separated from sortable results and always appended to the bottom of the comparison chart in both descending and ascending modes.


## Version 13

Adds a second collapsible comparison chart for a single monitoring location across all survey rounds. Use the location selector, or click a map marker first and then open the chart. Bars follow the map concentration colours, gaps represent missing/unverified results, and a dashed reference line marks 40 µg/m³.


## v15
The one-location comparison panel now includes a visible snapshot for the selected survey: exact NO₂ result, percentage of the 40 µg/m³ limit, and percentage change from the immediately previous survey. Increases are red and decreases are green.

## v16 — worst-performing location trend

Adds a collapsible survey-trend chart showing the highest valid outdoor NO₂ result in each verified survey, identifying the QP site responsible, its percentage of the 40 µg/m³ limit, and the change versus the previous survey's highest result.


## v18
The detailed multi-site trend table has been replaced with a simpler single-site trend chart. Choose QP01–QP18 from a dropdown to see its NO₂ results through time as a line chart, with concentration-coloured points, the 40 µg/m³ reference line, and tooltip details for percentage of the limit and change from the previous available survey.

## v19
Adds a dashed linear trend line to the selectable single-site trend chart. The regression uses the actual survey dates, so irregular gaps between survey rounds are reflected in the calculation. The trend line stops at the latest verified result and does not extrapolate into pending surveys.
