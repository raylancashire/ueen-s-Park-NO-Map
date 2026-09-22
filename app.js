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
  performanceToggle: document.getElementById('performance-toggle'),
  performancePanel: document.getElementById('performance-panel'),
  bestPerformingList: document.getElementById('best-performing-list'),
  worstPerformingList: document.getElementById('worst-performing-list'),
  surveyTrendToggle: document.getElementById('survey-trend-toggle'),
  surveyTrendPanel: document.getElementById('survey-trend-panel'),
  surveyTrendSummary: document.getElementById('survey-trend-summary'),
  surveyTrendTableBody: document.getElementById('survey-trend-table-body')
};

let sites = [];
let surveys = [];
let surveyIndex = 0;
let selectedSiteRef = null;
let historyChart = null;
let comparisonChart = null;
let siteHistoryChart = null;
let surveyTrendChart = null;
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


function contrastTextColour(hex) {
  const clean = String(hex || '').replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return '#111111';

  const rgb = [0, 2, 4].map(i => parseInt(clean.slice(i, i + 2), 16) / 255);
  const linear = rgb.map(c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];

  // Choose the text colour with the stronger WCAG contrast ratio.
  const whiteContrast = 1.05 / (luminance + 0.05);
  const blackContrast = (luminance + 0.05) / 0.05;
  return whiteContrast >= blackContrast ? '#ffffff' : '#111111';
}

function markerIcon(siteRef, value) {
  const rounded = roundedResult(value);
  const label = rounded === null ? '' : rounded;
  const title = rounded === null ? `${siteRef}: no valid result for this survey` : `${siteRef}: ${rounded} µg/m³ (rounded to nearest whole number)`;
  return L.divIcon({
    className: '',
    html: `<div class="site-marker${rounded === null ? ' missing' : ''}" style="background:${colourFor(value)};color:${rounded === null ? '#ffffff' : contrastTextColour(colourFor(value))}" title="${title}">${label}</div>`,
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


function renderSiteHistoryChart(siteRef = null) {
  if (els.siteHistoryPanel.hidden) return;

  const LEGAL_LIMIT = 40;
  const chosenRef = siteRef || els.siteHistorySelect.value || selectedSiteRef || sites[0]?.site_ref;
  const site = sites.find(s => s.site_ref === chosenRef);
  if (!site) return;

  if (els.siteHistorySelect.value !== site.site_ref) els.siteHistorySelect.value = site.site_ref;
  els.siteHistoryTitle.textContent = `${site.site_ref} — ${site.location}`;

  const rows = surveys.map((survey, index) => {
    const value = survey.status === 'verified' && typeof survey.results?.[site.site_ref] === 'number' && Number.isFinite(survey.results[site.site_ref])
      ? survey.results[site.site_ref]
      : null;
    let changePct = null;
    if (value !== null) {
      const previous = previousComparable(index, site.site_ref);
      if (previous && previous.value !== 0) changePct = ((value - previous.value) / previous.value) * 100;
    }
    return { survey, value, changePct };
  });

  const validRows = rows.filter(row => row.value !== null);
  if (validRows.length) {
    const latest = validRows.at(-1);
    const pctLimit = (latest.value / LEGAL_LIMIT) * 100;
    let changeText = 'first available result';
    if (latest.changePct !== null) {
      const arrow = latest.changePct < 0 ? '↓' : latest.changePct > 0 ? '↑' : '→';
      const sign = latest.changePct > 0 ? '+' : '';
      changeText = `${arrow} ${sign}${formatNumber(latest.changePct)}% from previous available survey`;
    }
    els.siteHistoryNote.textContent = `Latest available result: ${formatNumber(latest.value)} µg/m³ (${formatNumber(pctLimit)}% of 40 µg/m³ limit), ${changeText}.`;
  } else {
    els.siteHistoryNote.textContent = 'No verified results are currently available for this monitoring location.';
  }

  const labels = rows.map(row => row.survey.label.replace('June ', 'Jun ').replace('July ', 'Jul ').replace('December ', 'Dec '));
  const values = rows.map(row => row.value);
  const pointColors = rows.map(row => row.value === null ? '#b5bdc3' : colourFor(row.value));

  const siteHistoryLabelsPlugin = {
    id: 'siteHistoryLabels',
    afterDatasetsDraw(chart) {
      const { ctx, chartArea } = chart;
      const meta = chart.getDatasetMeta(0);
      if (!meta || !chartArea) return;

      meta.data.forEach((bar, index) => {
        const row = rows[index];
        if (!row || row.value === null) return;

        const pctLimit = (row.value / LEGAL_LIMIT) * 100;
        const props = bar.getProps(['x', 'y', 'base'], true);
        const barTop = Math.min(props.y, props.base);
        const barBottom = Math.max(props.y, props.base);

        ctx.save();
        ctx.textAlign = 'center';

        // Percentage of the 40 µg/m³ annual mean limit, shown inside each bar.
        ctx.font = '700 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = contrastTextColour(colourFor(row.value));
        const insideY = Math.min(barBottom - 14, Math.max(barTop + 18, barTop + (barBottom - barTop) * 0.55));
        ctx.fillText(`${Math.round(pctLimit)}%`, props.x, insideY);

        // Percentage change from the previous available survey, shown above the bar.
        if (row.changePct !== null) {
          const arrow = row.changePct < 0 ? '↓' : row.changePct > 0 ? '↑' : '→';
          const sign = row.changePct > 0 ? '+' : '';
          ctx.font = '800 13px system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif';
          ctx.textBaseline = 'bottom';
          ctx.fillStyle = row.changePct < 0 ? '#14833b' : row.changePct > 0 ? '#c62828' : '#5f6b73';
          const labelY = Math.max(chartArea.top + 14, barTop - 7);
          ctx.fillText(`${arrow} ${sign}${Math.round(row.changePct)}%`, props.x, labelY);
        }

        ctx.restore();
      });
    }
  };

  // Linear least-squares trend using the actual survey dates, so irregular gaps
  // between survey rounds are reflected in the calculated trend.
  const datedValues = rows.map((row, index) => {
    if (row.value === null) return null;
    const [yearText, monthText = '01'] = row.survey.survey.split('-');
    const year = Number(yearText);
    const month = Number(monthText);
    const x = year + (month - 1) / 12;
    return { index, x, y: row.value };
  }).filter(Boolean);

  let trendValues = rows.map(() => null);
  if (datedValues.length >= 2) {
    const meanX = datedValues.reduce((sum, point) => sum + point.x, 0) / datedValues.length;
    const meanY = datedValues.reduce((sum, point) => sum + point.y, 0) / datedValues.length;
    const denominator = datedValues.reduce((sum, point) => sum + Math.pow(point.x - meanX, 2), 0);
    const slope = denominator === 0 ? 0 : datedValues.reduce((sum, point) => sum + (point.x - meanX) * (point.y - meanY), 0) / denominator;
    const intercept = meanY - slope * meanX;
    const lastValidIndex = datedValues.at(-1).index;

    trendValues = rows.map((row, index) => {
      if (index > lastValidIndex) return null;
      const [yearText, monthText = '01'] = row.survey.survey.split('-');
      const x = Number(yearText) + (Number(monthText) - 1) / 12;
      return intercept + slope * x;
    });
  }

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

  const numericValues = values.filter(v => typeof v === 'number' && Number.isFinite(v));
  const maxValue = numericValues.length ? Math.max(...numericValues) : LEGAL_LIMIT;
  const suggestedMax = Math.max(LEGAL_LIMIT + 10, Math.ceil(maxValue * 1.2 / 5) * 5);

  const canvas = document.getElementById('site-history-chart');
  if (siteHistoryChart) siteHistoryChart.destroy();
  siteHistoryChart = new Chart(canvas, {
    type: 'bar',
    plugins: [legalLimitLinePlugin, siteHistoryLabelsPlugin],
    data: {
      labels,
      datasets: [{
        type: 'bar',
        order: 2,
        label: 'Measured NO₂',
        data: values,
        backgroundColor: pointColors,
        borderColor: pointColors,
        borderWidth: 1,
        borderRadius: 4
      }, {
        type: 'line',
        order: 1,
        label: 'Linear trend',
        data: trendValues,
        borderColor: '#111111',
        borderWidth: 2,
        borderDash: [8, 6],
        tension: 0,
        spanGaps: true,
        pointRadius: 0,
        pointHoverRadius: 0,
        fill: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'nearest', intersect: true },
      plugins: {
        legend: { display: true },
        tooltip: {
          callbacks: {
            label: ctx => {
              if (ctx.datasetIndex === 1) return `Linear trend: ${formatNumber(ctx.raw)} µg/m³`;
              const row = rows[ctx.dataIndex];
              if (row.value === null) return row.survey.status === 'verified' ? 'No result' : 'Result not verified';
              const parts = [
                `${formatNumber(row.value)} µg/m³`,
                `${formatNumber((row.value / LEGAL_LIMIT) * 100)}% of 40 µg/m³ legal limit`
              ];
              if (row.changePct !== null) {
                const arrow = row.changePct < 0 ? '↓' : row.changePct > 0 ? '↑' : '→';
                parts.push(`${arrow} ${row.changePct > 0 ? '+' : ''}${formatNumber(row.changePct)}% from previous available survey`);
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
    els.siteHistoryToggle.textContent = willOpen ? 'Hide site trend over time' : 'Show site trend over time';
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



function surveyNetworkStats(survey) {
  if (!survey || survey.status !== 'verified') return null;
  const values = Object.values(survey.results || {}).filter(v => typeof v === 'number' && Number.isFinite(v));
  if (!values.length) return null;
  return {
    count: values.length,
    median: median(values),
    mean: values.reduce((sum, value) => sum + value, 0) / values.length,
    low: Math.min(...values),
    high: Math.max(...values)
  };
}

function surveyDirection(changePct) {
  if (changePct === null || !Number.isFinite(changePct)) return { label: '—', arrow: '', cls: '' };
  if (changePct <= -5) return { label: 'Improving', arrow: '↓', cls: 'trend-improving' };
  if (changePct >= 5) return { label: 'Deteriorating', arrow: '↑', cls: 'trend-deteriorating' };
  return { label: 'Stable', arrow: '→', cls: 'trend-stable' };
}

function renderSurveyTrendAnalysis() {
  if (!els.surveyTrendPanel || els.surveyTrendPanel.hidden) return;

  const rows = surveys.map((survey, index) => {
    const stats = surveyNetworkStats(survey);
    let previous = null;
    for (let i = index - 1; i >= 0; i--) {
      const candidate = surveyNetworkStats(surveys[i]);
      if (candidate) { previous = { survey: surveys[i], stats: candidate }; break; }
    }
    const diff = stats && previous ? stats.median - previous.stats.median : null;
    const changePct = stats && previous && previous.stats.median !== 0
      ? (diff / previous.stats.median) * 100 : null;
    return { survey, index, stats, previous, diff, changePct, direction: surveyDirection(changePct) };
  });

  const usable = rows.filter(row => row.stats);
  const selected = rows[surveyIndex];

  if (selected?.stats) {
    if (selected.previous) {
      const sign = selected.diff > 0 ? '+' : '';
      const pctSign = selected.changePct > 0 ? '+' : '';
      els.surveyTrendSummary.innerHTML = `<strong>${selected.direction.arrow} ${selected.direction.label}</strong> — ${selected.survey.label} network median: ${formatNumber(selected.stats.median)} µg/m³. ` +
        `Difference from ${selected.previous.survey.label}: ${sign}${formatNumber(selected.diff)} µg/m³ (${pctSign}${formatNumber(selected.changePct)}%).`;
    } else {
      els.surveyTrendSummary.innerHTML = `<strong>${selected.survey.label}</strong> — network median: ${formatNumber(selected.stats.median)} µg/m³. This is the first verified survey available for comparison.`;
    }
  } else {
    els.surveyTrendSummary.textContent = `${selected?.survey?.label || 'Selected survey'} does not have verified results available for network comparison.`;
  }

  els.surveyTrendTableBody.innerHTML = rows.map(row => {
    const selectedClass = row.index === surveyIndex ? ' survey-trend-selected' : '';
    const rowAttrs = ` class="survey-trend-row${selectedClass}" data-survey-index="${row.index}" tabindex="0" aria-selected="${row.index === surveyIndex}"`;
    if (!row.stats) {
      return `<tr${rowAttrs}><td>${row.survey.label}</td><td>—</td><td>—</td><td>—</td><td>${row.survey.status === 'pending' ? 'Pending' : 'No valid results'}</td></tr>`;
    }
    const diffText = row.diff === null ? '—' : `${row.diff > 0 ? '+' : ''}${formatNumber(row.diff)} µg/m³`;
    const pctText = row.changePct === null ? '—' : `${row.changePct > 0 ? '+' : ''}${formatNumber(row.changePct)}%`;
    const directionText = row.changePct === null ? '—' : `${row.direction.arrow} ${row.direction.label}`;
    return `<tr${rowAttrs}><td>${row.survey.label}</td><td>${formatNumber(row.stats.median)} µg/m³</td><td>${diffText}</td><td>${pctText}</td><td><span class="${row.direction.cls}">${directionText}</span></td></tr>`;
  }).join('');

  const canvas = document.getElementById('survey-trend-chart');
  if (!canvas) return;
  if (surveyTrendChart) surveyTrendChart.destroy();
  surveyTrendChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: usable.map(row => row.survey.label.replace('June ', 'Jun ').replace('July ', 'Jul ').replace('December ', 'Dec ')),
      datasets: [{
        label: 'Network median NO₂',
        data: usable.map(row => row.stats.median),
        borderWidth: 2,
        pointRadius: usable.map(row => row.index === surveyIndex ? 8 : 4),
        pointBackgroundColor: usable.map(row => row.index === surveyIndex ? '#d7191c' : '#2563eb'),
        pointHoverRadius: 7,
        tension: 0.18,
        fill: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'nearest', intersect: false },
      onClick: (_event, elements) => {
        if (!elements.length) return;
        const chosen = usable[elements[0].index];
        if (!chosen) return;
        setSurvey(chosen.index);
        els.surveyTrendTableBody.querySelector(`tr[data-survey-index="${chosen.index}"]`)?.scrollIntoView({ block: 'nearest' });
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            afterLabel: context => {
              const row = usable[context.dataIndex];
              const parts = [`${row.stats.count} valid outdoor sites`];
              if (row.changePct !== null) parts.push(`${row.direction.arrow} ${row.direction.label}: ${row.changePct > 0 ? '+' : ''}${formatNumber(row.changePct)}% from previous verified survey`);
              return parts;
            }
          }
        }
      },
      scales: {
        y: { title: { display: true, text: 'Median NO₂ (µg/m³)' }, beginAtZero: false },
        x: { ticks: { maxRotation: 45, minRotation: 0 } }
      }
    }
  });
}

function setupSurveyTrendAnalysis() {
  if (!els.surveyTrendToggle || !els.surveyTrendPanel) return;
  // Delegate events so the handlers survive table redraws.
  els.surveyTrendTableBody?.addEventListener('click', event => {
    const row = event.target.closest('tr[data-survey-index]');
    if (row) setSurvey(Number(row.dataset.surveyIndex));
  });
  els.surveyTrendTableBody?.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const row = event.target.closest('tr[data-survey-index]');
    if (!row) return;
    event.preventDefault();
    setSurvey(Number(row.dataset.surveyIndex));
  });
  els.surveyTrendToggle.addEventListener('click', () => {
    const willOpen = els.surveyTrendPanel.hidden;
    els.surveyTrendPanel.hidden = !willOpen;
    els.surveyTrendToggle.setAttribute('aria-expanded', String(willOpen));
    els.surveyTrendToggle.textContent = willOpen ? 'Hide survey trend analysis' : 'Show survey trend analysis';
    if (willOpen) {
      renderSurveyTrendAnalysis();
      requestAnimationFrame(() => surveyTrendChart?.resize());
    }
  });
}

function siteTrendPerformance(site) {
  const rows = surveys
    .filter(survey => survey.status === 'verified')
    .map(survey => ({
      survey,
      x: surveyDateValue(survey),
      value: typeof survey.results?.[site.site_ref] === 'number' && Number.isFinite(survey.results[site.site_ref])
        ? survey.results[site.site_ref] : null
    }))
    .filter(row => row.value !== null);

  if (rows.length < 2) return null;
  const meanX = rows.reduce((sum, row) => sum + row.x, 0) / rows.length;
  const meanY = rows.reduce((sum, row) => sum + row.value, 0) / rows.length;
  let numerator = 0;
  let denominator = 0;
  rows.forEach(row => {
    numerator += (row.x - meanX) * (row.value - meanY);
    denominator += (row.x - meanX) ** 2;
  });
  const slope = denominator ? numerator / denominator : 0;
  const first = rows[0].value;
  const latest = rows[rows.length - 1].value;
  const overallPct = first !== 0 ? ((latest - first) / first) * 100 : null;
  return { site, slope, overallPct, count: rows.length };
}

function performanceItemHtml(item, kind) {
  const improving = item.slope < 0;
  const worsening = item.slope > 0;
  const arrow = improving ? '↓' : worsening ? '↑' : '→';
  const cls = improving ? 'performance-down' : worsening ? 'performance-up' : 'performance-same';
  const overall = item.overallPct === null ? '—' : `${item.overallPct > 0 ? '+' : ''}${formatNumber(item.overallPct)}% overall`;
  return `<button class="performance-item ${kind}" type="button" data-site-ref="${item.site.site_ref}">
    <span class="performance-rank"></span>
    <span class="performance-site"><strong>${item.site.site_ref}</strong><small>${item.site.location}</small></span>
    <span class="performance-metrics ${cls}"><strong>${arrow} ${formatNumber(Math.abs(item.slope), 2)} µg/m³/yr</strong><small>${overall}</small></span>
  </button>`;
}

function renderPerformanceSummary() {
  if (!els.performancePanel || els.performancePanel.hidden) return;
  const ranked = sites.map(siteTrendPerformance).filter(Boolean).sort((a, b) => a.slope - b.slope);
  const best = ranked.slice(0, 3);
  const worst = ranked.slice(-3).sort((a, b) => b.slope - a.slope);

  els.bestPerformingList.innerHTML = best.map((item, i) => performanceItemHtml(item, 'best').replace('<span class="performance-rank"></span>', `<span class="performance-rank">${i + 1}</span>`)).join('');
  els.worstPerformingList.innerHTML = worst.map((item, i) => performanceItemHtml(item, 'worst').replace('<span class="performance-rank"></span>', `<span class="performance-rank">${i + 1}</span>`)).join('');

  els.performancePanel.querySelectorAll('.performance-item').forEach(button => {
    button.addEventListener('click', () => {
      const ref = button.dataset.siteRef;
      selectSite(ref, false);
      if (els.siteHistoryPanel.hidden) {
        els.siteHistoryPanel.hidden = false;
        els.siteHistoryToggle.setAttribute('aria-expanded', 'true');
        els.siteHistoryToggle.textContent = 'Hide site trend over time';
      }
      els.siteHistorySelect.value = ref;
      renderSiteHistoryChart(ref);
      els.siteHistoryPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

function setupPerformanceSummary() {
  if (!els.performanceToggle || !els.performancePanel) return;
  els.performanceToggle.addEventListener('click', () => {
    const willOpen = els.performancePanel.hidden;
    els.performancePanel.hidden = !willOpen;
    els.performanceToggle.setAttribute('aria-expanded', String(willOpen));
    els.performanceToggle.textContent = willOpen ? 'Hide best & worst performing locations' : 'Show best & worst performing locations';
    if (willOpen) renderPerformanceSummary();
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
  renderSurveyTrendAnalysis();
  renderPerformanceSummary();
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



function surveyDateValue(survey) {
  const parts = String(survey.survey || '').split('-').map(Number);
  const year = parts[0] || 2000;
  const month = parts[1] || 1;
  return Date.UTC(year, Math.max(0, month - 1), 15) / (365.2425 * 24 * 3600 * 1000);
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
  setupSurveyTrendAnalysis();
  setupPerformanceSummary();

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


  // Map display controls only. These do not alter survey or NO2 analysis logic.
  // Home button: return to a view containing all monitoring sites.
  if (bounds.length) {
    const monitoringBounds = L.latLngBounds(bounds);
    const HomeControl = L.Control.extend({
      options: { position: 'topleft' },
      onAdd: function () {
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
        const link = L.DomUtil.create('a', '', container);
        link.href = '#';
        link.title = 'Show all monitoring sites';
        link.setAttribute('aria-label', 'Show all monitoring sites');
        link.innerHTML = '&#8962;';
        link.style.fontSize = '22px';
        link.style.lineHeight = '30px';
        link.style.textAlign = 'center';
        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.on(link, 'click', L.DomEvent.stop)
          .on(link, 'click', () => map.fitBounds(monitoringBounds, { padding: [28, 28] }));
        return container;
      }
    });
    map.addControl(new HomeControl());
  }

  // Optional Queen's Park ward boundary. It is OFF by default and can be
  // enabled from Leaflet's standard Layers control in the top-right.
  const wardBoundaryUrl = "https://gis.london.gov.uk/arcgis/rest/services/apps/webmap_context_layer/FeatureServer/18/query?where=ward_code%3D%27E05013804%27&outFields=ward_name%2Cward_code&outSR=4326&f=geojson";
  fetch(wardBoundaryUrl)
    .then(r => {
      if (!r.ok) throw new Error(`Queen's Park boundary unavailable (${r.status})`);
      return r.json();
    })
    .then(geojson => {
      if (!geojson?.features?.length) throw new Error("Queen's Park boundary was not returned");
      const wardBoundaryLayer = L.geoJSON(geojson, {
        style: { color: '#d7191c', weight: 3, opacity: 0.95, fill: false },
        interactive: false
      });

      L.control.layers(null, {
        "Queen's Park ward boundary": wardBoundaryLayer
      }, {
        position: 'topright',
        collapsed: true
      }).addTo(map);
    })
    .catch(error => console.warn("Queen's Park boundary could not be loaded:", error));

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
