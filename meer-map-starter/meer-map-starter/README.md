# MEER Global Projects Map – Starter (Leaflet.js)

This starter gives you a **standalone interactive map** you can host at `map.meer.org` and **embed** inside Webflow with an `<iframe>`.

## Contents
- `index.html` – layout, controls, and Leaflet map container
- `style.css` – MEER-themed styling (uses #0077c8)
- `script.js` – loads data, renders markers, popups, and simple filters
- `data/projects.sample.json` – example data you can replace with your real dataset

## Quick start (local)
Because the map loads JSON via `fetch`, you need to run a local server (opening `index.html` as a file will block the request).

### Option A: Python (built-in)
```bash
cd meer-map-starter
python3 -m http.server 8000
```
Then open http://localhost:8000 in your browser.

### Option B: VS Code Live Server
Right–click `index.html` → “Open with Live Server”.

## Data format
`data/projects.sample.json` contains an array of objects:
```json
{
  "name": "Freetown Cooling Project",
  "region": "Africa",
  "type": "Field Research",
  "status": "Active",
  "lat": 8.4844,
  "lng": -13.2344,
  "city": "Freetown",
  "country": "Sierra Leone",
  "description": "Reflective roofing reducing indoor heat in informal housing.",
  "partners": "Local NGOs, Community Members",
  "image": "https://example.com/image.jpg",
  "link": "https://meer.org/projects/freetown"
}
```
You can add/remove fields; the script is resilient to missing optional fields.

## Embed in Webflow
Once the standalone is hosted (for example at `https://map.meer.org`), add an **Embed** element to your Webflow page and paste:
```html
<iframe src="https://map.meer.org" style="width:100%; height:600px; border:none;" title="MEER Global Projects Map"></iframe>
```
Adjust `height` as needed.

## Theming
- Brand color (MEER blue) is defined in `:root` as `--meer-blue: #0077c8;`.
- Marker colors by category are defined in `.dot.<category>` rules inside `style.css`.
- Modify CSS to adjust legend, panel, and popup styles.

## Notes
- If you host the JSON on another domain, ensure **CORS** is enabled, or serve the JSON from the same origin as `index.html`.
- For clustering many markers later, you can add Leaflet.markercluster.
- For search by name only, this starter uses a simple text filter. You can swap to a plugin for fuzzy search if desired.
