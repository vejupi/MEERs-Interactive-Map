// IMPORTANT: make sure this matches your actual file name:
// if your file is data/projects.json, change it below.
const DATA_URL = 'data/projects.sample.json';

const CATEGORY_CLASSES = {
  "Laboratory & Testing": "lab",
  "Field Research": "field",
  "Ecological & Water": "water",
  "Data & Modelling": "data",
  "Coordination & Training": "hub"
};

function markerFor(project) {
  const cat = CATEGORY_CLASSES[project.type] || "field";
  const html = `<span class="dot ${cat}"></span>`;
  return L.divIcon({
    className: 'meer-marker',
    html,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });
}

function popupHTML(p) {
  const focus = p.focus || p.description || '';
  const role = p.role || '';
  const partners = p.partners
    ? `<div class="meta"><strong>Partners:</strong> ${p.partners}</div>`
    : '';

  const imageSrc = Array.isArray(p.images) && p.images.length
    ? p.images[0]
    : (p.image || '');
  const image = imageSrc
    ? `<img src="${imageSrc}" alt="${p.name}" loading="lazy">`
    : '';

  const detailUrl = p.link || (p.id ? `project.html?id=${encodeURIComponent(p.id)}` : '');
  const linkBtn = detailUrl
    ? `<a class="button" href="${detailUrl}">View Gallery &amp; Details</a>`
    : '';

  const year = p.year_started ? `Started: ${p.year_started}` : '';
  const updated = p.last_updated ? `Updated: ${p.last_updated}` : '';
  const yrs = (year || updated)
    ? `<div class="meta">${[year, updated].filter(Boolean).join(' · ')}</div>`
    : '';

  const needsVerify = p.status && /proposed|planned|under assessment/i.test(p.status || '');
  const badge = needsVerify
    ? `<span class="badge-warn">Needs verification</span>`
    : '';

  const metaLine = `${p.city ? p.city + ', ' : ''}${p.country || ''} · ${p.type || ''} · ${p.status || ''}`;
  const contact = p.contact
    ? `<div class="meta"><strong>Local Contact:</strong> ${p.contact}</div>`
    : '';
  const program = p.program
    ? `<div class="meta"><strong>Program:</strong> ${p.program}</div>`
    : '';

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
  regions: new Set(),
  types: new Set(),
  statuses: new Set(),
  search: ''
};

function initMap() {
  map = L.map('map', {
    minZoom: 2,
    worldCopyJump: true
  }).setView([15, 10], 2);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    maxZoom: 19
  }).addTo(map);

  // cluster group for performance
  markerLayer = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 45
  }).addTo(map);

  fetch(DATA_URL)
    .then(r => {
      if (!r.ok) {
        console.error('Failed to fetch data:', r.status, r.statusText);
        throw new Error('Network response was not ok');
      }
      return r.json();
    })
    .then(data => {
      allProjects = data;
      buildFilterControls();
      renderMarkers();
    })
    .catch(err => {
      console.error('Failed to load data:', err);
      alert('Could not load project data. Check DATA_URL and JSON file name/path.');
    });

  document.getElementById('searchInput').addEventListener('input', (e) => {
    state.search = e.target.value.toLowerCase().trim();
    renderMarkers();
  });

  document.getElementById('resetBtn').addEventListener('click', () => {
    state.regions.clear();
    state.types.clear();
    state.statuses.clear();
    state.search = '';
    document.getElementById('searchInput').value = '';
    document.querySelectorAll('.controls input[type="checkbox"]').forEach(cb => cb.checked = false);
    renderMarkers();
  });

  map.on('popupopen', (e) => {
    map.panInside(e.popup.getLatLng(), {
      paddingTopLeft: [0, 80]
    });
  });
}

function buildFilterControls() {
  const regions = [...new Set(allProjects.map(p => p.region).filter(Boolean))].sort();
  const types   = [...new Set(allProjects.map(p => p.type).filter(Boolean))].sort();
  const statuses= [...new Set(allProjects.map(p => p.status).filter(Boolean))].sort();

  const makeGroup = (arr, containerId, setRef) => {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    arr.forEach(val => {
      const id = `${containerId}-${val.replace(/\s+/g, '-').toLowerCase()}`;
      const label = document.createElement('label');
      label.innerHTML = `<input type="checkbox" id="${id}"> ${val}`;
      const cb = label.querySelector('input');
      cb.addEventListener('change', (e) => {
        if (e.target.checked) setRef.add(val);
        else setRef.delete(val);
        renderMarkers();
      });
      container.appendChild(label);
    });
  };

  makeGroup(regions, 'regionFilters', state.regions);
  makeGroup(types,   'typeFilters',   state.types);
  makeGroup(statuses,'statusFilters', state.statuses);
}

function passesFilters(p) {
  const matchRegion = state.regions.size ? state.regions.has(p.region) : true;
  const matchType   = state.types.size   ? state.types.has(p.type) : true;
  const matchStatus = state.statuses.size? state.statuses.has(p.status) : true;
  const text = `${p.name} ${p.country || ''} ${p.city || ''} ${p.description || ''} ${p.focus || ''}`.toLowerCase();
  const matchSearch = state.search ? text.includes(state.search) : true;
  return matchRegion && matchType && matchStatus && matchSearch;
}

function renderMarkers() {
  markerLayer.clearLayers();
  markers = [];

  const visible = allProjects.filter(p => passesFilters(p));
  visible.forEach(p => {
    if (typeof p.lat !== 'number' || typeof p.lng !== 'number') return;

    const m = L.marker([p.lat, p.lng], { icon: markerFor(p) });

    m.bindPopup(popupHTML(p), { maxWidth: 300 });

    // hover tooltip preview
    m.bindTooltip(
      `${p.name}${p.country ? ' – ' + p.country : ''}`,
      {
        direction: 'top',
        offset: [0, -4],
        opacity: 0.9
      }
    );

    m.on('click', () => {
      map.setView([p.lat, p.lng], Math.max(map.getZoom(), 4), { animate: true });
    });

    markerLayer.addLayer(m);
    markers.push(m);
  });

  if (visible.length) {
    const group = L.featureGroup(markers);
    map.fitBounds(group.getBounds().pad(0.2), { animate: true });
  }
}

document.addEventListener('DOMContentLoaded', initMap);

