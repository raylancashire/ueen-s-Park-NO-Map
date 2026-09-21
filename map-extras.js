/* Optional map controls for the Queen's Park NO₂ map.
   This file deliberately does not alter survey/data logic in app.js. */
(function () {
  'use strict';

  function waitForMap(attempt) {
    if (typeof L === 'undefined' || typeof map === 'undefined') {
      if (attempt < 100) window.setTimeout(function () { waitForMap(attempt + 1); }, 100);
      return;
    }

    var homeBounds = null;

    function getSiteBounds() {
      if (typeof sites === 'undefined' || !Array.isArray(sites) || !sites.length) return null;
      var coords = sites
        .filter(function (site) { return Number.isFinite(Number(site.lat)) && Number.isFinite(Number(site.lon)); })
        .map(function (site) { return [Number(site.lat), Number(site.lon)]; });
      return coords.length ? L.latLngBounds(coords) : null;
    }

    var HomeControl = L.Control.extend({
      options: { position: 'topleft' },
      onAdd: function () {
        var container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
        var button = L.DomUtil.create('a', '', container);
        button.href = '#';
        button.title = 'Show all monitoring sites';
        button.setAttribute('aria-label', 'Show all monitoring sites');
        button.setAttribute('role', 'button');
        button.innerHTML = '&#8962;';
        button.style.fontSize = '22px';
        button.style.lineHeight = '30px';
        button.style.textAlign = 'center';

        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.on(button, 'click', function (event) {
          L.DomEvent.preventDefault(event);
          var siteBounds = getSiteBounds();
          var bounds = homeBounds || siteBounds;
          if (bounds && bounds.isValid()) map.fitBounds(bounds, { padding: [30, 30] });
        });
        return container;
      }
    });
    new HomeControl().addTo(map);

    /* Current Queen's Park ward boundary, loaded as an optional external layer.
       Failure here is intentionally isolated so the core NO₂ map continues to work. */
    var boundaryUrl = 'https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/Wards_December_2022_Boundaries_UK_BGC/FeatureServer/0/query?where=WD22CD%3D%27E05013804%27&outFields=WD22CD%2CWD22NM&returnGeometry=true&outSR=4326&f=geojson';

    fetch(boundaryUrl)
      .then(function (response) {
        if (!response.ok) throw new Error('Boundary request failed: ' + response.status);
        return response.json();
      })
      .then(function (geojson) {
        if (!geojson || !Array.isArray(geojson.features) || !geojson.features.length) {
          throw new Error('Queen\'s Park boundary was not returned.');
        }
        var layer = L.geoJSON(geojson, {
          style: function () {
            return { color: '#d7191c', weight: 3, opacity: 0.9, fill: false, interactive: false };
          }
        }).addTo(map);
        layer.bringToBack();

        var siteBounds = getSiteBounds();
        var boundaryBounds = layer.getBounds();
        if (siteBounds && siteBounds.isValid()) {
          homeBounds = L.latLngBounds(siteBounds);
          if (boundaryBounds.isValid()) homeBounds.extend(boundaryBounds);
        } else if (boundaryBounds.isValid()) {
          homeBounds = boundaryBounds;
        }
      })
      .catch(function (error) {
        console.warn('Optional Queen\'s Park boundary unavailable:', error);
        homeBounds = getSiteBounds();
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { waitForMap(0); });
  } else {
    waitForMap(0);
  }
}());
