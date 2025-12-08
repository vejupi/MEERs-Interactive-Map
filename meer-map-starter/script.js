// Leaflet map with Program/Region/Type/Status filters + search
// Popups auto-pan and keep in view; details open via project.html?id=<id>

const DATA_URL = 'data/projects.sample.json';

const CATEGORY_CLASSES = {
  "Laboratory & Testing": "lab",
  "Field Research": "field",
  "Ecological & Water": "water",
  "Data & Modelling": "data",
  "Coordination & Training": "hub"
};

function markerFor(project){
  const cat = CATEGORY_CLASSES[project.type] || "field";
  const html = `<span class="dot ${cat}"></span>`;
  return L.divIcon({
    className: 'meer-marker',
    html,
    iconSize: [16,16],
    iconAnchor: [8,8]
  });
}

function popupHTML(p){
  const focus = p.focus || p.description || '';
  const role = p.role || '';
  const partners = p.partners ? `<div class="meta"><strong>Partners:</strong> ${p.partners}</div>` : '';

  const imageSrc = Array.isArray(p.images) && p.images.length ? p.images[0] : (p.image || '');
  const image = imageSrc ? `<img src="${imageSrc}" alt="${p.name}">` : '';

  // Prefer local details page unless an external link is provided
  const detailUrl = p.link || `project.html?id=${encodeURIComponent(p.id)}`;
  const linkBtn = (p.id || p.link)
    ? `<a class="button" href="${detailUrl}">View Gallery & Details</a>`
    : '';

  const year = p.year_started ? `Started: ${p.year_started}` : '';
  const updated = p.last_updated ? `Updated: ${p.last_updated}` : '';
  const yrs = (year || updated) ? `<div class="meta">${[year, updated].filter(Boolean).join(' · ')}</div>` : '';

  const needsVerify = p.status && /proposed|planned|under assessment/i.test(p.status);
  const badge = needsVerify
    ? `<span style="display:inline-block;background:#fff3cd;color:#946200;border:1px solid #ffe69c;padding:2px 6px;border-radius:6px;font-size:12px;margin-bottom:6px;">Needs verification</span>`
    : '';

  const metaLine = `${p.city ? p.city + ', ' : ''}${p.country || ''} · ${p.type || ''} · ${p.status || ''}`;
  const contact = p.contact ? `<div class="meta"><strong>Local Contact:</strong> ${p.contact}</div>` : '';
  const program = p.program ? `<div class="meta"><strong>Program:</strong> ${p.program}</div>` : '';

  return `
    <div class="popup">
      <div class="title">${p.name}</div>
      <div class="meta">${metaLine}</div>
      ${badge}
      ${image}
      <div class="desc">${focus}</div>
      ${role ? `<div class="meta"><strong>Role:</strong> ${role}</div>` : ''}
      ${partners}
      ${program}
      ${yrs}
      ${contact}
      ${linkBtn}
    </div>
  `;
}

let map;
let allProjects = [];
let markers = [];
let markerLayer;

const state = {
  programs: new Set(),
  regions: new Set(),
  types: new Set(),
  statuses: new Set(),
  search: ''
};

function hasCoords(p){
  return typeof p.lat === 'number' && !Number.isNaN(p.lat) &&
         typeof p.lng === 'number' && !Number.isNaN(p.lng);
}

function initMap(){
  map = L.map('map', {
    minZoom: 2,
    worldCopyJump: true
  }).setView([15, 10], 2);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    maxZoom: 19
  }).addTo(map);

  markerLayer = L.layerGroup().addTo(map);

  // Nudge map when any popup opens so top is never clipped
  map.on('popupopen', (e) => {
    try {
      const px = map.project(e.popup.getLatLng());
      px.y -= 100; // move up ~100px; increase if needed
      map.panTo(map.unproject(px), { animate: true });
    } catch (_) {}
  });

  fetch(DATA_URL)
    .then(r => r.json())
    .then(data => {
      allProjects = Array.isArray(data) ? data : [];
      buildFilterControls();
      renderMarkers();
    })
    .catch(err => console.error('Failed to load data:', err));

  const searchEl = document.getElementById('searchInput');
  if (searchEl){
    searchEl.addEventListener('input', (e)=>{
      state.search = e.target.value.toLowerCase().trim();
      renderMarkers();
    });
  }

  const resetBtn = document.getElementById('resetBtn');
  if (resetBtn){
    resetBtn.addEventListener('click', ()=>{
      state.programs.clear();
      state.regions.clear();
      state.types.clear();
      state.statuses.clear();
      state.search = '';
      if (searchEl) searchEl.value = '';
      document.querySelectorAll('.controls input[type="checkbox"]').forEach(cb => cb.checked = false);
      renderMarkers();
    });
  }
}

function buildFilterControls(){
  const programs = [...new Set(allProjects.map(p => p.program).filter(Boolean))].sort();
  const regions  = [...new Set(allProjects.map(p => p.region).filter(Boolean))].sort();
  const types    = [...new Set(allProjects.map(p => p.type).filter(Boolean))].sort();
  const statuses = [...new Set(allProjects.map(p => p.status).filter(Boolean))].sort();

  const makeGroup = (arr, containerId, setRef) => {
    const container = document.getElementById(containerId);
    if (!container) return; // safe if a group isn't present in HTML
    container.innerHTML = '';
    arr.forEach(val => {
      const id = `${containerId}-${val.replace(/\s+/g,'-').toLowerCase()}`;
      const label = document.createElement('label');
      label.innerHTML = `<input type="checkbox" id="${id}"> ${val}`;
      const cb = label.querySelector('input');
      cb.addEventListener('change', (e)=>{
        if (e.target.checked) setRef.add(val);
        else setRef.delete(val);
        renderMarkers();
      });
      container.appendChild(label);
    });
  };

  makeGroup(programs, 'programFilters', state.programs);
  makeGroup(regions,  'regionFilters',  state.regions);
  makeGroup(types,    'typeFilters',    state.types);
  makeGroup(statuses, 'statusFilters',  state.statuses);
}

function passesFilters(p){
  if (!hasCoords(p)) return false;

  const matchProgram = state.programs.size ? state.programs.has(p.program) : true;
  const matchRegion  = state.regions.size  ? state.regions.has(p.region)   : true;
  const matchType    = state.types.size    ? state.types.has(p.type)       : true;
  const matchStatus  = state.statuses.size ? state.statuses.has(p.status)  : true;

  const text = `${p.name||''} ${p.city||''} ${p.country||''} ${p.role||''} ${p.focus||p.description||''} ${p.partners||''}`.toLowerCase();
  const matchSearch = state.search ? text.includes(state.search) : true;

  return matchProgram && matchRegion && matchType && matchStatus && matchSearch;
}

function renderMarkers(){
  markerLayer.clearLayers();
  markers = [];

  const missing = allProjects.filter(p => !hasCoords(p));
  if (missing.length){
    console.info(`Skipped ${missing.length} site(s) without verified coordinates. First few:`,
      missing.slice(0,5).map(s => s.name));
  }

  const visible = allProjects.filter(p => passesFilters(p));
  visible.forEach(p => {
    const m = L.marker([p.lat, p.lng], { icon: markerFor(p) });

    // Bind popup with auto-pan options so it stays fully visible
    m.bindPopup(popupHTML(p), {
      autoPan: true,
      keepInView: true,
      autoPanPaddingTopLeft: [12, 80],      // extra top/left space so header isn't clipped
      autoPanPaddingBottomRight: [12, 20],
      maxWidth: 320,
      className: 'meer-popup'
    });

    // Optional: if zoomed way out, just increase zoom slightly (don't recenter)
    m.on('click', () => {
      if (map.getZoom() < 4) {
        map.setZoom(4, { animate: true });
      }
      // Let Leaflet's autoPan + popupopen nudge handle positioning
    });

    m.addTo(markerLayer);
    markers.push(m);
  });

  if (visible.length){
    const group = L.featureGroup(markers);
    map.fitBounds(group.getBounds().pad(0.2), { animate: true });
  }
}

document.addEventListener('DOMContentLoaded', initMap);
