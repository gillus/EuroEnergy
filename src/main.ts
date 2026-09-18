import './style.css';
import { createCharts, detailTitle } from './charts';
import { COUNTRY_NAMES, EU27, EU_AGGREGATE } from './countries';
import { loadData, type Data } from './data';
import { describeFlag, formatDate, formatValue } from './format';
import { GROUPS, METRICS, metricYears, readMetric, type Metric } from './indicators';
import { classBreaks, createMap, type MapState } from './map';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const groupSelect = $<HTMLSelectElement>('group');
const metricSelect = $<HTMLSelectElement>('metric');
const perCapitaInput = $<HTMLInputElement>('per-capita');
const yearInput = $<HTMLInputElement>('year');
const playButton = $<HTMLButtonElement>('play');

const DEFAULT: { metric: string; country: string } = { metric: 'ren-REN', country: 'IT' };

interface State extends MapState {
  years: string[];
}

/** Latest year in which most EU countries report, so the first view is not a half-empty map. */
function defaultYear(data: Data, metric: Metric, years: string[]): string {
  for (let i = years.length - 1; i >= 0; i--) {
    const reporting = EU27.filter((g) => metric.value(data, g, years[i])).length;
    if (reporting >= EU27.length * 0.8) return years[i];
  }
  return years[years.length - 1];
}

function readHash(): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(location.hash.slice(1)));
}

function writeHash(state: State) {
  const params = new URLSearchParams({ i: state.metric.id, a: state.year, p: state.selected });
  if (state.perCapita) params.set('pc', '1');
  history.replaceState(null, '', `#${params}`);
}

async function main() {
  const [data, geojson] = await Promise.all([
    loadData(),
    fetch(`${import.meta.env.BASE_URL}geo/europe.json`).then((r) => r.json()),
  ]);

  const hash = readHash();
  const metric = METRICS.get(hash.i) ?? METRICS.get(DEFAULT.metric)!;
  const years = metricYears(data, metric, EU27);
  const state: State = {
    metric,
    years,
    year: years.includes(hash.a) ? hash.a : defaultYear(data, metric, years),
    perCapita: hash.pc === '1',
    selected: hash.p in COUNTRY_NAMES ? hash.p : DEFAULT.country,
  };

  const select = (geo: string) => {
    state.selected = geo;
    render();
  };
  const map = createMap($('map'), geojson, select);
  const charts = createCharts($('trend'), $('detail'), $('ranking'), select);

  for (const g of GROUPS) groupSelect.add(new Option(g.label, g.id));

  function fillMetricSelect() {
    const group = GROUPS.find((g) => g.id === state.metric.group)!;
    metricSelect.replaceChildren(...group.metrics.map((m) => new Option(m.label, m.id)));
    metricSelect.value = state.metric.id;
    groupSelect.value = group.id;
  }

  function setMetric(metric: Metric) {
    state.metric = metric;
    state.years = metricYears(data, metric, EU27);
    if (!state.years.includes(state.year)) state.year = defaultYear(data, metric, state.years);
    fillMetricSelect();
    render();
  }

  groupSelect.addEventListener('change', () => {
    setMetric(GROUPS.find((g) => g.id === groupSelect.value)!.metrics[0]);
  });
  metricSelect.addEventListener('change', () => setMetric(METRICS.get(metricSelect.value)!));
  perCapitaInput.addEventListener('change', () => {
    state.perCapita = perCapitaInput.checked;
    render();
  });
  yearInput.addEventListener('input', () => {
    state.year = state.years[Number(yearInput.value)];
    render();
  });

  let timer: number | undefined;
  function stop() {
    clearInterval(timer);
    timer = undefined;
    playButton.textContent = '▶';
  }
  playButton.addEventListener('click', () => {
    if (timer !== undefined) return stop();
    if (state.year === state.years[state.years.length - 1]) state.year = state.years[0];
    playButton.textContent = '❚❚';
    render();
    timer = window.setInterval(() => {
      const i = state.years.indexOf(state.year);
      if (i >= state.years.length - 1) return stop();
      state.year = state.years[i + 1];
      render();
    }, 800);
  });

  function renderPanel() {
    const { metric, year, perCapita, selected } = state;
    $('country-name').textContent = COUNTRY_NAMES[selected];
    const r = readMetric(data, metric, selected, year, perCapita);
    const flag = r ? describeFlag(r.flag) : '';
    $('country-value').textContent = r
      ? `${formatValue(r.value, r.unit, r.decimals)}${flag ? ` (${flag})` : ''}`
      : `n.d. nel ${year}`;

    // Rank among EU member states only, so non-EU countries don't shift the positions.
    let rank = '';
    if (r && (EU27 as readonly string[]).includes(selected)) {
      const values = EU27.map((g) => readMetric(data, metric, g, year, perCapita)?.value).filter(
        (v): v is number => v !== undefined,
      );
      const position = values.filter((v) => v > r.value).length + 1;
      rank = `${position}° su ${values.length} paesi UE nel ${year}`;
    } else if (r && selected !== EU_AGGREGATE) {
      const eu = readMetric(data, metric, EU_AGGREGATE, year, perCapita);
      if (eu) rank = `UE 27: ${formatValue(eu.value, eu.unit, eu.decimals)}`;
    } else if (r) {
      rank = `nel ${year}`;
    }
    $('country-rank').textContent = rank;
  }

  function render() {
    const { metric, year, years, perCapita } = state;
    const group = GROUPS.find((g) => g.id === metric.group)!;
    const unit = perCapita && metric.perCapita ? metric.perCapita.unit : metric.unit;

    perCapitaInput.disabled = !metric.perCapita;
    perCapitaInput.checked = perCapita && !!metric.perCapita;
    $('per-capita-label').classList.toggle('disabled', !metric.perCapita);
    yearInput.max = String(years.length - 1);
    yearInput.value = String(years.indexOf(year));
    $('year-label').textContent = year;

    $('map-title').textContent = `${group.label} — ${metric.label} (${unit}), ${year}`;
    $('metric-description').textContent = metric.description;
    $('detail-title').textContent = detailTitle(metric);
    $('ranking-title').textContent = `Classifica ${year}: ${metric.label.toLowerCase()} (${unit})`;

    const breaks = classBreaks(data, metric, perCapita, years);
    map.render(data, state, breaks);
    charts.render(data, state, years, breaks);
    renderPanel();
    writeHash(state);
  }

  $('datasets').textContent = GROUPS.map((g) => g.dataset).concat('demo_pjan').join(', ');
  const lastUpdate = Object.values(data.meta.datasets)
    .map((d) => d.updated)
    .sort()
    .at(-1);
  $('updated').textContent =
    `Dati scaricati il ${formatDate(data.meta.fetchedAt)}` +
    (lastUpdate ? ` · ultimo aggiornamento Eurostat: ${formatDate(lastUpdate)}` : '');

  map.onLayoutChange(render);
  fillMetricSelect();
  render();
}

main().catch((err: Error) => {
  const box = $('error');
  box.textContent = `Errore nel caricamento della dashboard: ${err.message}`;
  box.hidden = false;
  console.error(err);
});
