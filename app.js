const map = L.map('map', {
  scrollWheelZoom: true,
  zoomControl: true
}).setView([51.5293, -0.2088], 15);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

const els = {
  surveySelect: document.getElementById('survey-select'),
  surveyStatus: document.getElementById('survey-status'),
  prev: document.getElementById('prev-survey'),
  next: document.getElementById('next-survey'),
  panelRef: document.getElementById('panel-ref'),
  panelLocation: document.getElementById('panel-location'),
  panelCoordinates: document.getElementById('panel-coordinates'),
  panelLat: document.getElementById('panel-lat'),
  panelLon: document.getElementById('panel-lon'),
  resultPanel: document.getElementById('result-panel'),
  resultSurvey: document.getElementById('result-survey'),
  resultValue: document.getElementById('result-value'),
  changeBox: document.getElementById('change-box'),
  chartWrap: document.getElementById('chart-wrap'),
  summaryCount: document.getElementById('summary-count'),
  summaryMedian: document.getElementById('summary-median'),
  summaryLow: document.getElementById('summary-low'),
  summaryHigh: document.getElementById('summary-high')
};

let sites = [];
let surveys = [];
let surveyIndex = 0;
let selectedSiteRef = null;
let historyChart = null;
const markers = new Map();

function formatNumber(value, digits = 1) {
  return Number(value).toFixed(digits).replace(/\.0$/, '');
}

const no2ColourScale = [
  [13, '#000066'], [16, '#01129c'], [19, '#0325d3'], [22, '#064af4'],
  [25, '#0c95e9'], [28, '#19cfd2'], [31, '#2cd2ba'], [34, '#68de85'],
  [37, '#a4eb50'], [40, '#ffff00'], [43, '#fff000'], [46, '#ffd600'],
  [49, '#ffbb00'], [52, '#ffae00'], [55, '#ffa000'], [58, '#ff8500'],
  [61, '#ff7800'], [64, '#ff3f00'], [67, '#ff3000'], [70, '#ff2000'],
  [73, '#fe1500'], [76, '#fd0900'], [79, '#fa0101'], [83, '#f40202'],
  [85, '#e90404'], [88, '#d30909'], [91, '#a61313'], [94, '#4d2727'],
  [97, '#331a1a']
];

function roundedResult(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return Math.round(Number(value));
}

function colourFor(value) {
  const rounded = roundedResult(value);
  if (rounded === null) return '#7d8992';
  const match = no2ColourScale.find(([limit]) => rounded <= limit);
  return match ? match[1] : no2ColourScale.at(-1)[1];
}

function markerIcon(siteRef, value) {
  const rounded = roundedResult(value);
  const label = rounded === null ? '' : rounded;
  const title = rounded === null ? `${siteRef}: no valid result for this survey` : `${siteRef}: ${rounded} µg/m³ (rounded to nearest whole number)`;
  return L.divIcon({
    className: '',
    html: `<div class="site-marker${rounded === null ? ' missing' : ''}" style="background:${colourFor(value)}" title="${title}">${label}</div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -18]
  });
}

function currentSurvey() {
  return surveys[surveyIndex];
}

function valueFor(siteRef, index = surveyIndex) {
  const survey = surveys[index];
  if (!survey || survey.status !== 'verified') return null;
  const value = survey.results?.[siteRef];
  return value === undefined ? null : value;
}

function updateUrl() {
  const url = new URL(window.location.href);
  url.searchParams.set('survey', currentSurvey().survey);
  if (selectedSiteRef) url.searchParams.set('site', selectedSiteRef);
  history.replaceState({}, '', url);
}

function popupHtml(site) {
  const survey = currentSurvey();
  const value = valueFor(site.site_ref);
  const result = survey.status === 'pending'
    ? `<div class="popup-note">Results awaiting verification.</div>`
    : value === null
      ? `<div class="popup-note">No valid result for this survey.</div>`
      : `<div class="popup-result">${formatNumber(value)} µg/m³ <span class="popup-rounded">(marker ${roundedResult(value)})</span></div>`;
  return `<div class="popup-ref">${site.site_ref}</div><div class="popup-location">${site.location}</div>${result}`;
}

function updateMarkers() {
  sites.forEach(site => {
    const entry = markers.get(site.site_ref);
    if (!entry) return;
    const value = valueFor(site.site_ref);
    entry.marker.setIcon(markerIcon(site.site_ref, value));
    entry.marker.setPopupContent(popupHtml(site));
  });
}

function updateSurveyControls() {
  const survey = currentSurvey();
  els.surveySelect.value = survey.survey;
  els.prev.disabled = surveyIndex === 0;
  els.next.disabled = surveyIndex === surveys.length - 1;
  els.surveyStatus.textContent = survey.status === 'pending' ? (survey.note || 'Results awaiting verification.') : 'Verified survey data';
  els.surveyStatus.className = `survey-status ${survey.status === 'pending' ? 'pending' : ''}`;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function updateSummary() {
  const survey = currentSurvey();
  const values = survey.status === 'verified'
    ? Object.values(survey.results || {}).filter(v => typeof v === 'number' && Number.isFinite(v))
    : [];

  if (!values.length) {
    els.summaryCount.textContent = '0';
    els.summaryMedian.textContent = '—';
    els.summaryLow.textContent = '—';
    els.summaryHigh.textContent = '—';
    return;
  }

  els.summaryCount.textContent = `${values.length} of 18`;
  els.summaryMedian.textContent = `${formatNumber(median(values))} µg/m³`;
  els.summaryLow.textContent = `${formatNumber(Math.min(...values))} µg/m³`;
  els.summaryHigh.textContent = `${formatNumber(Math.max(...values))} µg/m³`;
}

function previousComparable(index, siteRef) {
  if (index <= 0) return null;
  const prev = surveys[index - 1];
  if (!prev || prev.status !== 'verified') return null;
  const value = prev.results?.[siteRef];
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return { survey: prev, value };
}

function renderChange(siteRef, currentValue) {
  els.changeBox.className = 'change-box';
  if (currentValue === null) {
    els.changeBox.textContent = 'Change from previous survey cannot be calculated because there is no verified result for this site in the selected survey.';
    return;
  }

  const previous = previousComparable(surveyIndex, siteRef);
  if (!previous) {
    els.changeBox.textContent = surveyIndex === 0
      ? 'This is the first survey in the series.'
      : 'No result is available for this site in the immediately previous survey.';
    return;
  }

  const diff = currentValue - previous.value;
  const pct = previous.value === 0 ? null : (diff / previous.value) * 100;
  const arrow = diff < 0 ? '↓' : diff > 0 ? '↑' : '→';
  els.changeBox.classList.add(diff < 0 ? 'down' : diff > 0 ? 'up' : 'same');
  els.changeBox.innerHTML = `<strong>${arrow} ${diff > 0 ? '+' : ''}${formatNumber(diff)} µg/m³</strong> from ${previous.survey.label}` +
    (pct === null ? '' : ` (${pct > 0 ? '+' : ''}${formatNumber(pct)}%)`);
}

function renderChart(siteRef) {
  const labels = [];
  const data = [];
  surveys.forEach(survey => {
    if (survey.status !== 'verified') return;
    labels.push(survey.label.replace('June ', 'Jun ').replace('July ', 'Jul ').replace('December ', 'Dec '));
    const v = survey.results?.[siteRef];
    data.push(typeof v === 'number' && Number.isFinite(v) ? v : null);
  });

  els.chartWrap.hidden = false;
  const canvas = document.getElementById('history-chart');
  if (historyChart) historyChart.destroy();
  historyChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'NO₂ µg/m³',
        data,
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.15,
        spanGaps: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'nearest', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ctx.raw === null ? 'No result' : `${ctx.raw} µg/m³` } }
      },
      scales: {
        y: { beginAtZero: true, title: { display: true, text: 'NO₂ µg/m³' } },
        x: { ticks: { maxRotation: 45, minRotation: 0 } }
      }
    }
  });
}

function selectSite(siteRef, openPopup = false) {
  const site = sites.find(s => s.site_ref === siteRef);
  const entry = markers.get(siteRef);
  if (!site || !entry) return;
  selectedSiteRef = siteRef;

  els.panelRef.textContent = site.site_ref;
  els.panelLocation.textContent = site.location;
  els.panelLat.textContent = site.lat.toFixed(6);
  els.panelLon.textContent = site.lon.toFixed(6);
  els.panelCoordinates.hidden = false;
  els.resultPanel.hidden = false;

  const survey = currentSurvey();
  const value = valueFor(siteRef);
  els.resultSurvey.textContent = survey.label;
  els.resultValue.textContent = survey.status === 'pending' ? 'Pending' : value === null ? 'No result' : formatNumber(value);
  renderChange(siteRef, value);
  renderChart(siteRef);
  updateUrl();

  if (openPopup) entry.marker.openPopup();
}

function setSurvey(index) {
  surveyIndex = Math.max(0, Math.min(index, surveys.length - 1));
  updateSurveyControls();
  updateMarkers();
  updateSummary();
  if (selectedSiteRef) selectSite(selectedSiteRef, false);
  else updateUrl();
}

function buildSurveySelect() {
  surveys.forEach(survey => {
    const option = document.createElement('option');
    option.value = survey.survey;
    option.textContent = survey.status === 'pending' ? `${survey.label} — pending` : survey.label;
    els.surveySelect.appendChild(option);
  });
  els.surveySelect.addEventListener('change', () => {
    const index = surveys.findIndex(s => s.survey === els.surveySelect.value);
    if (index >= 0) setSurvey(index);
  });
  els.prev.addEventListener('click', () => setSurvey(surveyIndex - 1));
  els.next.addEventListener('click', () => setSurvey(surveyIndex + 1));
}

Promise.all([
  fetch('data/sites.json').then(r => { if (!r.ok) throw new Error(`Unable to load monitoring sites (${r.status})`); return r.json(); }),
  fetch('data/results.json').then(r => { if (!r.ok) throw new Error(`Unable to load survey results (${r.status})`); return r.json(); })
]).then(([siteData, surveyData]) => {
  sites = siteData;
  surveys = surveyData;
  buildSurveySelect();

  const bounds = [];
  sites.forEach(site => {
    const marker = L.marker([site.lat, site.lon], { icon: markerIcon(site.site_ref, null) })
      .addTo(map)
      .bindPopup(popupHtml(site));
    marker.on('click', () => selectSite(site.site_ref, false));
    markers.set(site.site_ref, { site, marker });
    bounds.push([site.lat, site.lon]);
  });
  if (bounds.length) map.fitBounds(bounds, { padding: [28, 28] });

  const params = new URLSearchParams(window.location.search);
  const requestedSurvey = params.get('survey');
  const requestedSite = params.get('site')?.toUpperCase();
  const requestedIndex = requestedSurvey ? surveys.findIndex(s => s.survey === requestedSurvey) : -1;
  // Default to the latest verified survey rather than a pending one.
  const latestVerified = surveys.map((s, i) => ({...s, i})).filter(s => s.status === 'verified').at(-1)?.i ?? 0;
  setSurvey(requestedIndex >= 0 ? requestedIndex : latestVerified);

  if (requestedSite && markers.has(requestedSite)) {
    const site = markers.get(requestedSite).site;
    map.setView([site.lat, site.lon], 17);
    selectSite(requestedSite, true);
  }
}).catch(error => {
  console.error(error);
  els.panelRef.textContent = 'Map data unavailable';
  els.panelLocation.textContent = 'The monitoring-site or survey-result data could not be loaded.';
});
