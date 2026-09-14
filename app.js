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
  summaryHigh: document.getElementById('summary-high'),
  comparisonToggle: document.getElementById('comparison-toggle'),
  comparisonPanel: document.getElementById('comparison-panel'),
  comparisonTitle: document.getElementById('comparison-title'),
  comparisonNote: document.getElementById('comparison-note'),
  sortToggle: document.getElementById('sort-toggle'),
  sortDirection: document.getElementById('sort-direction'),
  siteHistoryToggle: document.getElementById('site-history-toggle'),
  siteHistoryPanel: document.getElementById('site-history-panel'),
  siteHistoryTitle: document.getElementById('site-history-title'),
  siteHistoryNote: document.getElementById('site-history-note'),
  siteHistorySelect: document.getElementById('site-history-select'),
  siteHistorySurvey: document.getElementById('site-history-survey'),
  siteHistoryResult: document.getElementById('site-history-result'),
  siteHistoryLimitPct: document.getElementById('site-history-limit-pct'),
  siteHistoryChange: document.getElementById('site-history-change'),
  worstTrendToggle: document.getElementById('worst-trend-toggle'),
  worstTrendPanel: document.getElementById('worst-trend-panel')
};

let sites = [];
let surveys = [];
let surveyIndex = 0;
let selectedSiteRef = null;
let historyChart = null;
let comparisonChart = null;
let siteHistoryChart = null;
let worstTrendChart = null;
let comparisonSort = 'desc';
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

function renderComparisonChart() {
  if (els.comparisonPanel.hidden) return;

  const LEGAL_LIMIT = 40;
  const survey = currentSurvey();
  els.comparisonTitle.textContent = `${survey.label} — all monitoring locations`;
  const focusedSite = selectedSiteRef ? sites.find(s => s.site_ref === selectedSiteRef) : null;
  const sortDescription = comparisonSort === 'desc' ? 'highest to lowest' : 'lowest to highest';
  els.comparisonNote.textContent = focusedSite
    ? `Location in focus: ${focusedSite.site_ref} — ${focusedSite.location}. Locations are ranked from ${sortDescription} percentage of the 40 µg/m³ annual mean legal limit. Labels also show change from the previous survey.`
    : `Locations are ranked from ${sortDescription} percentage of the 40 µg/m³ annual mean legal limit. Labels also show change from the previous survey. Select a monitoring point on the map to highlight that location.`;

  // Build one row per monitoring location. Sort valid results only, then append
  // missing results so they always stay at the bottom in both sort directions.
  const allRows = sites.map(site => {
    const value = valueFor(site.site_ref);
    const previous = value === null ? null : previousComparable(surveyIndex, site.site_ref);
    return {
      site,
      value,
      legalPct: value === null ? null : (value / LEGAL_LIMIT) * 100,
      changePct: value !== null && previous && previous.value !== 0
        ? ((value - previous.value) / previous.value) * 100
        : null,
      previousLabel: previous ? previous.survey.label : null
    };
  });

  const validRows = allRows
    .filter(row => Number.isFinite(row.legalPct))
    .sort((a, b) => comparisonSort === 'desc'
      ? b.legalPct - a.legalPct
      : a.legalPct - b.legalPct);

  const missingRows = allRows
    .filter(row => !Number.isFinite(row.legalPct))
    .sort((a, b) => a.site.site_ref.localeCompare(b.site.site_ref));

  const rows = [...validRows, ...missingRows];

  const labels = rows.map(row => `${row.site.site_ref} — ${row.site.location}`);
  const values = rows.map(row => row.value === null ? 0 : row.value);
  const backgroundColors = rows.map(row => row.value === null ? '#b5bdc3' : colourFor(row.value));
  const borderColors = rows.map(row => row.site.site_ref === selectedSiteRef ? '#17222b' : '#ffffff');
  const borderWidths = rows.map(row => row.site.site_ref === selectedSiteRef ? 4 : 1);

  const comparisonLabelsPlugin = {
    id: 'comparisonLabels',
    afterDatasetsDraw(chart) {
      const { ctx, chartArea } = chart;
      const meta = chart.getDatasetMeta(0);
      ctx.save();
      ctx.textBaseline = 'middle';
      meta.data.forEach((bar, index) => {
        const row = rows[index];
        if (row.value === null) return;

        const limitText = `${Math.round(row.legalPct)}% of limit`;
        let arrow = '→';
        let changeValueText = '— vs previous';
        let changeColour = '#53616b';

        if (row.changePct !== null) {
          arrow = row.changePct < 0 ? '↓' : row.changePct > 0 ? '↑' : '→';
          const sign = row.changePct > 0 ? '+' : '';
          changeValueText = `${sign}${formatNumber(row.changePct)}%`;
          changeColour = row.changePct < 0 ? '#15803d' : row.changePct > 0 ? '#c62828' : '#53616b';
        }

        ctx.font = '600 11px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        const limitWidth = ctx.measureText(limitText).width;
        const separator = '  |  ';
        const separatorWidth = ctx.measureText(separator).width;

        ctx.font = '800 15px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        const arrowWidth = ctx.measureText(arrow).width;
        ctx.font = '700 11px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        const changeWidth = ctx.measureText(` ${changeValueText}`).width;
        const totalWidth = limitWidth + separatorWidth + arrowWidth + changeWidth;
        let x = Math.min(bar.x + 8, chartArea.right - totalWidth - 2);

        ctx.font = '600 11px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillStyle = '#26343d';
        ctx.fillText(limitText, x, bar.y);
        x += limitWidth;
        ctx.fillStyle = '#7a858c';
        ctx.fillText(separator, x, bar.y);
        x += separatorWidth;

        ctx.font = '800 15px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillStyle = changeColour;
        ctx.fillText(arrow, x, bar.y);
        x += arrowWidth;
        ctx.font = '700 11px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        ctx.fillText(` ${changeValueText}`, x, bar.y);
      });
      ctx.restore();
    }
  };

  const numericValues = values.filter(v => typeof v === 'number' && Number.isFinite(v));
  const maxValue = numericValues.length ? Math.max(...numericValues) : LEGAL_LIMIT;
  const suggestedMax = Math.max(LEGAL_LIMIT + 10, Math.ceil(maxValue * 1.55 / 5) * 5);

  const legalLimitLinePlugin = {
    id: 'legalLimitLine',
    afterDraw(chart) {
      const { ctx, chartArea, scales } = chart;
      if (!chartArea || !scales.x) return;
      const x = scales.x.getPixelForValue(LEGAL_LIMIT);
      if (x < chartArea.left || x > chartArea.right) return;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x, chartArea.top);
      ctx.lineTo(x, chartArea.bottom);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#202020';
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = '600 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = '#202020';
      ctx.fillText('40 µg/m³ legal limit', x, chartArea.top - 4);
      ctx.restore();
    }
  };

  const canvas = document.getElementById('comparison-chart');
  if (comparisonChart) comparisonChart.destroy();
  comparisonChart = new Chart(canvas, {
    type: 'bar',
    plugins: [comparisonLabelsPlugin, legalLimitLinePlugin],
    data: {
      labels,
      datasets: [{
        label: 'NO₂ µg/m³',
        data: values,
        backgroundColor: backgroundColors,
        borderColor: borderColors,
        borderWidth: borderWidths,
        borderSkipped: false
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { right: 8 } },
      interaction: { mode: 'nearest', intersect: true },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const row = rows[ctx.dataIndex];
              if (row.value === null) return 'No result';
              const parts = [
                `${formatNumber(row.value)} µg/m³ (marker ${roundedResult(row.value)})`,
                `${formatNumber(row.legalPct)}% of 40 µg/m³ legal limit`
              ];
              if (row.changePct !== null) {
                const arrow = row.changePct < 0 ? '↓' : row.changePct > 0 ? '↑' : '→';
                parts.push(`${arrow} ${row.changePct > 0 ? '+' : ''}${formatNumber(row.changePct)}% from ${row.previousLabel}`);
              } else {
                parts.push('No comparable result in the previous survey');
              }
              return parts;
            }
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          suggestedMax,
          title: { display: true, text: 'NO₂ µg/m³' }
        },
        y: {
          ticks: { autoSkip: false }
        }
      }
    }
  });
}


function updateSiteHistorySummary(siteRef) {
  const LEGAL_LIMIT = 40;
  const survey = currentSurvey();
  const value = valueFor(siteRef);

  els.siteHistorySurvey.textContent = survey.label;
  els.siteHistoryChange.className = '';

  if (value === null) {
    els.siteHistoryResult.textContent = survey.status === 'pending' ? 'Awaiting verification' : 'No result';
    els.siteHistoryLimitPct.textContent = '—';
    els.siteHistoryChange.textContent = '—';
    return;
  }

  els.siteHistoryResult.textContent = `${formatNumber(value)} µg/m³`;
  els.siteHistoryLimitPct.textContent = `${formatNumber((value / LEGAL_LIMIT) * 100)}%`;

  const previous = previousComparable(surveyIndex, siteRef);
  if (!previous || previous.value === 0) {
    els.siteHistoryChange.textContent = surveyIndex === 0 ? 'First survey' : 'No comparable result';
    return;
  }

  const diffPct = ((value - previous.value) / previous.value) * 100;
  const arrow = diffPct < 0 ? '↓' : diffPct > 0 ? '↑' : '→';
  const sign = diffPct > 0 ? '+' : '';
  els.siteHistoryChange.textContent = `${arrow} ${sign}${formatNumber(diffPct)}%`;
  els.siteHistoryChange.className = diffPct < 0 ? 'history-change-down' : diffPct > 0 ? 'history-change-up' : 'history-change-same';
}

function renderSiteHistoryChart(siteRef = null) {
  if (els.siteHistoryPanel.hidden) return;

  const LEGAL_LIMIT = 40;
  const chosenRef = siteRef || els.siteHistorySelect.value || selectedSiteRef || sites[0]?.site_ref;
  const site = sites.find(s => s.site_ref === chosenRef);
  if (!site) return;

  if (els.siteHistorySelect.value !== site.site_ref) els.siteHistorySelect.value = site.site_ref;
  els.siteHistoryTitle.textContent = `${site.site_ref} — ${site.location}`;
  els.siteHistoryNote.textContent = 'All survey rounds are shown in chronological order. Missing or unverified results remain visible as gaps.';
  updateSiteHistorySummary(site.site_ref);

  const rows = surveys.map((survey, index) => {
    const value = survey.status === 'verified' && typeof survey.results?.[site.site_ref] === 'number' && Number.isFinite(survey.results[site.site_ref])
      ? survey.results[site.site_ref]
      : null;
    let changePct = null;
    if (value !== null && index > 0) {
      const prev = surveys[index - 1];
      const prevValue = prev?.status === 'verified' && typeof prev.results?.[site.site_ref] === 'number' && Number.isFinite(prev.results[site.site_ref])
        ? prev.results[site.site_ref]
        : null;
      if (prevValue !== null && prevValue !== 0) changePct = ((value - prevValue) / prevValue) * 100;
    }
    return { survey, value, changePct };
  });

  const labels = rows.map(row => row.survey.label.replace('June ', 'Jun ').replace('July ', 'Jul ').replace('December ', 'Dec '));
  const values = rows.map(row => row.value);
  const backgroundColors = rows.map(row => row.value === null ? '#b5bdc3' : colourFor(row.value));

  const legalLimitLinePlugin = {
    id: 'siteHistoryLegalLimitLine',
    afterDraw(chart) {
      const { ctx, chartArea, scales } = chart;
      if (!chartArea || !scales.y) return;
      const y = scales.y.getPixelForValue(LEGAL_LIMIT);
      if (y < chartArea.top || y > chartArea.bottom) return;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(chartArea.left, y);
      ctx.lineTo(chartArea.right, y);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#202020';
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = '600 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = '#202020';
      ctx.fillText('40 µg/m³ legal limit', chartArea.right, y - 4);
      ctx.restore();
    }
  };

  const valueLabelsPlugin = {
    id: 'siteHistoryValueLabels',
    afterDatasetsDraw(chart) {
      const { ctx, chartArea } = chart;
      const meta = chart.getDatasetMeta(0);
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.font = '700 11px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      rows.forEach((row, index) => {
        if (row.value === null) return;
        const bar = meta.data[index];
        const label = `${formatNumber(row.value)}`;
        const y = Math.max(chartArea.top + 12, bar.y - 5);
        ctx.fillStyle = '#26343d';
        ctx.fillText(label, bar.x, y);
      });
      ctx.restore();
    }
  };

  const numericValues = values.filter(v => typeof v === 'number' && Number.isFinite(v));
  const maxValue = numericValues.length ? Math.max(...numericValues) : LEGAL_LIMIT;
  const suggestedMax = Math.max(LEGAL_LIMIT + 10, Math.ceil(maxValue * 1.25 / 5) * 5);

  const canvas = document.getElementById('site-history-chart');
  if (siteHistoryChart) siteHistoryChart.destroy();
  siteHistoryChart = new Chart(canvas, {
    type: 'bar',
    plugins: [legalLimitLinePlugin, valueLabelsPlugin],
    data: {
      labels,
      datasets: [{
        label: 'NO₂ µg/m³',
        data: values,
        backgroundColor: backgroundColors,
        borderColor: rows.map(row => row.value === null ? '#9aa4aa' : '#ffffff'),
        borderWidth: 1,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'nearest', intersect: true },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const row = rows[ctx.dataIndex];
              if (row.value === null) return row.survey.status === 'verified' ? 'No result' : 'Result not verified';
              const parts = [
                `${formatNumber(row.value)} µg/m³`,
                `${formatNumber((row.value / LEGAL_LIMIT) * 100)}% of 40 µg/m³ legal limit`
              ];
              if (row.changePct !== null) {
                const arrow = row.changePct < 0 ? '↓' : row.changePct > 0 ? '↑' : '→';
                parts.push(`${arrow} ${row.changePct > 0 ? '+' : ''}${formatNumber(row.changePct)}% from immediately previous survey`);
              }
              return parts;
            }
          }
        }
      },
      scales: {
        y: { beginAtZero: true, suggestedMax, title: { display: true, text: 'NO₂ µg/m³' } },
        x: { ticks: { maxRotation: 45, minRotation: 0 } }
      }
    }
  });
}

function setupSiteHistoryComparison() {
  sites.forEach(site => {
    const option = document.createElement('option');
    option.value = site.site_ref;
    option.textContent = `${site.site_ref} — ${site.location}`;
    els.siteHistorySelect.appendChild(option);
  });

  els.siteHistorySelect.addEventListener('change', () => {
    renderSiteHistoryChart(els.siteHistorySelect.value);
  });

  els.siteHistoryToggle.addEventListener('click', () => {
    const willOpen = els.siteHistoryPanel.hidden;
    els.siteHistoryPanel.hidden = !willOpen;
    els.siteHistoryToggle.setAttribute('aria-expanded', String(willOpen));
    els.siteHistoryToggle.textContent = willOpen ? 'Hide one-location survey comparison' : 'Show one location across all surveys';
    if (willOpen) {
      const ref = selectedSiteRef || els.siteHistorySelect.value || sites[0]?.site_ref;
      renderSiteHistoryChart(ref);
      requestAnimationFrame(() => siteHistoryChart?.resize());
    }
  });
}

function setupSortToggle() {
  els.sortToggle.addEventListener('click', () => {
    comparisonSort = comparisonSort === 'desc' ? 'asc' : 'desc';
    const descending = comparisonSort === 'desc';
    els.sortDirection.textContent = descending ? 'Descending' : 'Ascending';
    els.sortToggle.querySelector('.sort-arrow').textContent = descending ? '↓' : '↑';
    els.sortToggle.setAttribute('aria-pressed', String(!descending));
    els.sortToggle.setAttribute('aria-label', descending
      ? 'Sort order descending. Click to switch to ascending.'
      : 'Sort order ascending. Click to switch to descending.');
    renderComparisonChart();
  });
}

function setupComparisonToggle() {
  els.comparisonToggle.addEventListener('click', () => {
    const willOpen = els.comparisonPanel.hidden;
    els.comparisonPanel.hidden = !willOpen;
    els.comparisonToggle.setAttribute('aria-expanded', String(willOpen));
    els.comparisonToggle.textContent = willOpen ? 'Hide location comparison chart' : 'Show location comparison chart';
    if (willOpen) {
      renderComparisonChart();
      requestAnimationFrame(() => comparisonChart?.resize());
    }
  });
}


function renderWorstTrendChart() {
  if (!els.worstTrendPanel || els.worstTrendPanel.hidden) return;
  const LEGAL_LIMIT = 40;

  const rows = surveys.map((survey, index) => {
    if (survey.status !== 'verified') return { survey, index, site: null, value: null, changePct: null };
    let worst = null;
    sites.forEach(site => {
      const value = survey.results?.[site.site_ref];
      if (typeof value !== 'number' || !Number.isFinite(value)) return;
      if (!worst || value > worst.value) worst = { site, value };
    });
    return { survey, index, site: worst?.site || null, value: worst?.value ?? null, changePct: null };
  });

  let previousValid = null;
  rows.forEach(row => {
    if (row.value === null) return;
    if (previousValid && previousValid.value !== 0) {
      row.changePct = ((row.value - previousValid.value) / previousValid.value) * 100;
    }
    previousValid = row;
  });

  const labels = rows.map(row => row.survey.label.replace('June ', 'Jun ').replace('July ', 'Jul ').replace('December ', 'Dec '));
  const values = rows.map(row => row.value);
  const backgroundColors = rows.map(row => row.value === null ? '#b5bdc3' : colourFor(row.value));

  const legalLimitLinePlugin = {
    id: 'worstTrendLegalLimitLine',
    afterDraw(chart) {
      const { ctx, chartArea, scales } = chart;
      if (!chartArea || !scales.y) return;
      const y = scales.y.getPixelForValue(LEGAL_LIMIT);
      if (y < chartArea.top || y > chartArea.bottom) return;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(chartArea.left, y);
      ctx.lineTo(chartArea.right, y);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#202020';
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = '600 12px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = '#202020';
      ctx.fillText('40 µg/m³ legal limit', chartArea.right, y - 4);
      ctx.restore();
    }
  };

  const labelsPlugin = {
    id: 'worstTrendLabels',
    afterDatasetsDraw(chart) {
      const { ctx, chartArea } = chart;
      const meta = chart.getDatasetMeta(0);
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.font = '700 11px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
      rows.forEach((row, i) => {
        if (row.value === null || !row.site) return;
        const bar = meta.data[i];
        const y = Math.max(chartArea.top + 24, bar.y - 5);
        ctx.fillStyle = '#26343d';
        ctx.fillText(`${row.site.site_ref} · ${formatNumber(row.value)}`, bar.x, y);
      });
      ctx.restore();
    }
  };

  const numericValues = values.filter(v => typeof v === 'number' && Number.isFinite(v));
  const maxValue = numericValues.length ? Math.max(...numericValues) : LEGAL_LIMIT;
  const suggestedMax = Math.max(LEGAL_LIMIT + 10, Math.ceil(maxValue * 1.25 / 5) * 5);

  const canvas = document.getElementById('worst-trend-chart');
  if (worstTrendChart) worstTrendChart.destroy();
  worstTrendChart = new Chart(canvas, {
    type: 'bar',
    plugins: [legalLimitLinePlugin, labelsPlugin],
    data: {
      labels,
      datasets: [{
        label: 'Highest NO₂ result',
        data: values,
        backgroundColor: backgroundColors,
        borderColor: rows.map(row => row.index === surveyIndex ? '#0d6b4f' : '#ffffff'),
        borderWidth: rows.map(row => row.index === surveyIndex ? 4 : 1),
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: items => rows[items[0]?.dataIndex]?.survey.label || '',
            label: ctx => {
              const row = rows[ctx.dataIndex];
              if (row.value === null || !row.site) return row.survey.status === 'verified' ? 'No valid result' : 'Results awaiting verification';
              const parts = [
                `${row.site.site_ref} — ${row.site.location}`,
                `${formatNumber(row.value)} µg/m³`,
                `${formatNumber((row.value / LEGAL_LIMIT) * 100)}% of 40 µg/m³ legal limit`
              ];
              if (row.changePct !== null) {
                const arrow = row.changePct < 0 ? '↓' : row.changePct > 0 ? '↑' : '→';
                parts.push(`${arrow} ${row.changePct > 0 ? '+' : ''}${formatNumber(row.changePct)}% vs previous survey's highest result`);
              }
              return parts;
            }
          }
        }
      },
      scales: {
        y: { beginAtZero: true, suggestedMax, title: { display: true, text: 'Highest NO₂ result (µg/m³)' } },
        x: { ticks: { maxRotation: 45, minRotation: 0 } }
      }
    }
  });
}

function setupWorstTrendComparison() {
  if (!els.worstTrendToggle || !els.worstTrendPanel) return;
  els.worstTrendToggle.addEventListener('click', () => {
    const willOpen = els.worstTrendPanel.hidden;
    els.worstTrendPanel.hidden = !willOpen;
    els.worstTrendToggle.setAttribute('aria-expanded', String(willOpen));
    els.worstTrendToggle.textContent = willOpen ? 'Hide worst-performing location trend' : 'Show worst-performing location trend';
    if (willOpen) {
      renderWorstTrendChart();
      requestAnimationFrame(() => worstTrendChart?.resize());
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
  renderComparisonChart();
  if (els.siteHistorySelect) els.siteHistorySelect.value = siteRef;
  renderSiteHistoryChart(siteRef);
  updateUrl();

  if (openPopup) entry.marker.openPopup();
}

function setSurvey(index) {
  surveyIndex = Math.max(0, Math.min(index, surveys.length - 1));
  updateSurveyControls();
  updateMarkers();
  if (!els.siteHistoryPanel.hidden) updateSiteHistorySummary(els.siteHistorySelect.value || selectedSiteRef || sites[0]?.site_ref);
  updateSummary();
  renderComparisonChart();
  renderWorstTrendChart();
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
  setupComparisonToggle();
  setupSortToggle();
  setupSiteHistoryComparison();
  setupWorstTrendComparison();

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
