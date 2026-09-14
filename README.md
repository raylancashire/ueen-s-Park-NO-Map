# Queen's Park NO₂ Monitoring Map

Starter public map for Queen's Park outdoor diffusion-tube monitoring sites QP01–QP18.

## Files
- `index.html` — page structure
- `styles.css` — responsive styling
- `app.js` — Leaflet map and marker behaviour
- `data/sites.json` — verified master site references and coordinates

QP19 and QP20 are indoor monitors and are intentionally excluded from the public map.

## Preview locally
Because the map loads `data/sites.json`, preview it through a simple local web server rather than opening `index.html` directly.

For example:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## GitHub Pages
Upload all files preserving the folder structure, enable GitHub Pages for the repository, and use the published Pages URL in an iframe on Webador or the Queen's Park Community Council website.

## Direct site links
The map already supports links such as:

`?site=QP04`

This opens the map at the selected monitoring point.

## Next stage
Add historical NO₂ results, survey navigation, previous-survey change calculations and a site time-series chart.
