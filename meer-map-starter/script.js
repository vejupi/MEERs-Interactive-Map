const DATA_URL = 'data/projects.json';

const CATEGORY_CLASSES = {
  "Laboratory & Testing": "lab",
  "Field Research": "field",
  "Ecological & Water": "water",
  "Data & Modelling": "data",
  "Coordination & Training": "hub"
};

const IS_MOBILE = window.matchMedia('(max-width: 768px)').matches;

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

/**
 * Pan the map *just enough* so the popup is visible.
 * This avoids centering/zooming that can cause popups to immediately close on mobile.
 */
function panPopupIntoView(popup) {
  if (!popup || !map) return;

  // Wait for popup to render (especially images), then pan inside view.
  setTimeout(() => {
    try {
      const padTop = 140;   // clears your header
      const padSide = 16;
      const padBottom = 24;

      map.panInside(popup.getLatLng(), {
        paddingTopLeft: [padSide, padTop],
        paddingBottomRight: [padSide, padBottom],
        animate: true
      });
    } catch (_) {}
  }, 80);
}

function initMap() {
  map = L.map('map', {
    minZoom: 2,
    worldCopyJump: true,

    // don't auto-close popups from taps/scrolls
    closePopupOnClick: false,

    // helps some mobile browsers
    tap: false
  }).setView([15, 10], 2);

  // ✅ Vertical bounds only (limits latitude, leaves longitude infinite)
  // Typical "sane" world clamp is about -85 to +85 because Web Mercator.
  const verticalBounds = L.latLngBounds(
    L.latLng(-85, -180),
    L.latLng(85, 180)
  );

  map.setMaxBounds(verticalBounds);

  // Keeps the user from "fighting" the edge; it gently bounces back inside bounds
  map.options.maxBoundsViscosity = 1.0;

  L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      maxZoom: 19
    }
  ).addTo(map);

  // cluster group for performance
  markerLayer = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 45,
    spiderfyOnMaxZoom: true
  }).addTo(map);

  fetch(DATA_URL)
    .then(r => {
      if (!r.ok) throw new Error(`Fetch failed: ${r.status} ${r.statusText}`);
      return r.json();
    })
    .then(data => {
      allProjects = data;
      buildFilterControls();
      renderMarkers();
    })
    .catch(err => {
      console.error('Failed to load data:', err);
      alert('Could not load project data. Check DATA_URL and that data/projects.json exists.');
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

  // When any popup opens, make sure it's visible (especially on mobile)
  map.on('popupopen', (e) => {
    if (IS_MOBILE) {
      panPopupIntoView(e.popup);
    } else {
      // desktop: gentle pan to avoid hiding under header
      try {
        map.panInside(e.popup.getLatLng(), {
          paddingTopLeft: [20, 140],
          paddingBottomRight: [20, 20],
          animate: true
        });
      } catch (_) {}
    }

    // stop touch/click bubbling from closing popup
    const el = e.popup.getElement();
    if (el) {
      L.DomEvent.disableClickPropagation(el);
      L.DomEvent.disableScrollPropagation(el);

      ['touchstart','touchmove','touchend','pointerdown','pointerup','mousedown','click'].forEach(evt => {
        el.addEventListener(evt, (ev) => {
          ev.stopPropagation();
        }, { passive: true });
      });
    }
  });
}

function buildFilterControls() {
  const regions = [...new Set(allProjects.map(p => p.region).filter(Boolean))].sort();
  const types = [...new Set(allProjects.map(p => p.type).filter(Boolean))].sort();
  const statuses = [...new Set(allProjects.map(p => p.status).filter(Boolean))].sort();

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
  makeGroup(types, 'typeFilters', state.types);
  makeGroup(statuses, 'statusFilters', state.statuses);
}

function passesFilters(p) {
  const matchRegion = state.regions.size ? state.regions.has(p.region) : true;
  const matchType = state.types.size ? state.types.has(p.type) : true;
  const matchStatus = state.statuses.size ? state.statuses.has(p.status) : true;
  const text = `${p.name} ${p.country || ''} ${p.city || ''} ${p.description || ''} ${p.focus || ''}`.toLowerCase();
  const matchSearch = state.search ? text.includes(state.search) : true;
  return matchRegion && matchType && matchStatus && matchSearch;
}

function renderMarkers() {
  markerLayer.clearLayers();
  markers = [];

  const visible = allProjects.filter(p => passesFilters(p));

  const popupOpts = {
    maxWidth: 320,

    // critical: don't let Leaflet auto-pan on mobile (it can cause instant close)
    autoPan: !IS_MOBILE,
    keepInView: !IS_MOBILE,

    // keep popups open while interacting
    closeOnClick: false,
    autoClose: false,
    closeButton: true
  };

  visible.forEach(p => {
    if (typeof p.lat !== 'number' || typeof p.lng !== 'number') return;

    const m = L.marker([p.lat, p.lng], { icon: markerFor(p) })
      .bindPopup(popupHTML(p), popupOpts);

    // Tooltip hover preview on desktop only
    if (!IS_MOBILE) {
      m.bindTooltip(
        `${p.name}${p.country ? ' – ' + p.country : ''}`,
        { direction: 'top', offset: [0, -4], opacity: 0.9 }
      );
    }

    // Mobile-safe click handler
    m.on('click', (e) => {
      L.DomEvent.stop(e); // prevents gesture chain issues
      m.openPopup();

      if (IS_MOBILE) {
        panPopupIntoView(m.getPopup());
      } else {
        map.setView([p.lat, p.lng], Math.max(map.getZoom(), 4), { animate: true });
      }
    });

    markerLayer.addLayer(m);
    markers.push(m);
  });

  if (markers.length) {
    const group = L.featureGroup(markers);
    map.fitBounds(group.getBounds().pad(0.2), { animate: true });
  }
}

document.addEventListener('DOMContentLoaded', initMap);
