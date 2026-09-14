const map = L.map('map', {
  scrollWheelZoom: true,
  zoomControl: true
}).setView([51.5293, -0.2088], 15);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

const panelRef = document.getElementById('panel-ref');
const panelLocation = document.getElementById('panel-location');
const panelCoordinates = document.getElementById('panel-coordinates');
const panelLat = document.getElementById('panel-lat');
const panelLon = document.getElementById('panel-lon');

function markerIcon(siteRef) {
  const number = siteRef.replace('QP', '');
  return L.divIcon({
    className: '',
    html: `<div class="site-marker">${number}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -14]
  });
}

function selectSite(site, marker, openPopup = true) {
  panelRef.textContent = site.site_ref;
  panelLocation.textContent = site.location;
  panelLat.textContent = site.lat.toFixed(6);
  panelLon.textContent = site.lon.toFixed(6);
  panelCoordinates.hidden = false;

  const url = new URL(window.location.href);
  url.searchParams.set('site', site.site_ref);
  history.replaceState({}, '', url);

  if (openPopup) marker.openPopup();
}

fetch('data/sites.json')
  .then(response => {
    if (!response.ok) throw new Error(`Unable to load monitoring sites (${response.status})`);
    return response.json();
  })
  .then(sites => {
    const markers = new Map();
    const bounds = [];

    sites.forEach(site => {
      const marker = L.marker([site.lat, site.lon], { icon: markerIcon(site.site_ref) })
        .addTo(map)
        .bindPopup(`<div class="popup-ref">${site.site_ref}</div><div class="popup-location">${site.location}</div>`);

      marker.on('click', () => selectSite(site, marker, false));
      markers.set(site.site_ref.toUpperCase(), { site, marker });
      bounds.push([site.lat, site.lon]);
    });

    if (bounds.length) map.fitBounds(bounds, { padding: [28, 28] });

    const requestedSite = new URLSearchParams(window.location.search).get('site');
    if (requestedSite && markers.has(requestedSite.toUpperCase())) {
      const { site, marker } = markers.get(requestedSite.toUpperCase());
      map.setView([site.lat, site.lon], 17);
      selectSite(site, marker, true);
    }
  })
  .catch(error => {
    console.error(error);
    panelRef.textContent = 'Map data unavailable';
    panelLocation.textContent = 'The monitoring-site data could not be loaded.';
  });
