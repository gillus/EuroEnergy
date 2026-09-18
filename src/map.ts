import { geoAzimuthalEqualArea } from 'd3-geo';
import { createChart, echarts } from './echarts';
import { COUNTRY_NAMES, EU_AGGREGATE } from './countries';
import type { Data } from './data';
import { describeFlag, formatNumber, formatValue } from './format';
import { readMetric, type Metric } from './indicators';

// Lambert azimuthal equal-area centred on Europe, as in the EU's official ETRS89-LAEA (EPSG:3035).
const projection = geoAzimuthalEqualArea().rotate([-10, -52]);
const VIEW_CENTER = projection([12, 53])!;

const NO_DATA = '#d4d4d4';
const CONTEXT = '#f1f1ee';
const ZERO_BREAK = 0.01;

export interface MapState {
  metric: Metric;
  year: string;
  perCapita: boolean;
  selected: string;
}

/** Class breaks shared by every year of a metric, so colors stay comparable while the year changes. */
export function classBreaks(data: Data, metric: Metric, perCapita: boolean, years: string[]): number[] {
  if (metric.breaks && !(perCapita && metric.perCapita)) return metric.breaks;
  const values: number[] = [];
  for (const geo of Object.keys(COUNTRY_NAMES)) {
    if (geo === EU_AGGREGATE) continue;
    for (const year of years) {
      const r = readMetric(data, metric, geo, year, perCapita);
      if (r) values.push(r.value);
    }
  }
  values.sort((a, b) => a - b);
  let classes = metric.palette.length;
  const breaks: number[] = [];
  // Shares like nuclear are exactly 0 for many countries: give zero its own class instead of
  // letting the quantiles collapse onto it.
  let pool = values;
  if (values.filter((v) => v === 0).length >= values.length / classes) {
    breaks.push(ZERO_BREAK);
    pool = values.filter((v) => v > 0);
    classes -= 1;
  }
  for (let i = 1; i < classes; i++) {
    const b = niceRound(pool[Math.floor((i / classes) * (pool.length - 1))] ?? 0);
    if (breaks.length === 0 || b > breaks[breaks.length - 1]) breaks.push(b);
  }
  return breaks;
}

/** Rounds to two significant digits so legend labels stay readable. */
function niceRound(v: number): number {
  if (v === 0) return 0;
  const magnitude = 10 ** (Math.floor(Math.log10(Math.abs(v))) - 1);
  return Math.round(v / magnitude) * magnitude;
}

/** Palette colors actually used: the darkest ones when duplicate breaks were dropped. */
export function classColors(metric: Metric, breaks: number[]): string[] {
  return metric.palette.slice(metric.palette.length - breaks.length - 1);
}

export function colorFor(colors: string[], breaks: number[], value: number): string {
  const i = breaks.findIndex((b) => value < b);
  return colors[i === -1 ? breaks.length : i];
}

// On narrow screens the legend moves below the map instead of covering it.
const compact = window.matchMedia('(max-width: 600px)');

export function createMap(
  el: HTMLElement,
  geojson: object,
  onSelect: (geo: string) => void,
) {
  echarts.registerMap('europe', geojson as Parameters<typeof echarts.registerMap>[1]);
  const regions = (geojson as { features: { properties: { id: string } }[] }).features.map((f) => f.properties.id);
  const chart = createChart(el);

  chart.on('click', (params) => {
    if (params.name in COUNTRY_NAMES) onSelect(params.name);
  });

  function render(data: Data, state: MapState, breaks: number[]) {
    const { metric, year, perCapita, selected } = state;
    const unit = perCapita && metric.perCapita ? metric.perCapita.unit : metric.unit;
    const decimals = perCapita && metric.perCapita ? metric.perCapita.decimals : metric.decimals;
    const colors = classColors(metric, breaks);
    const fmt = (v: number) => formatNumber(v, Math.abs(v) < 10 && v % 1 !== 0 ? 1 : 0);

    const pieces = colors.map((color, i) => {
      if (i === 0) return { lt: breaks[0], color, label: breaks[0] === ZERO_BREAK ? '0' : `< ${fmt(breaks[0])}` };
      const from = breaks[i - 1] === ZERO_BREAK ? 0 : breaks[i - 1];
      if (i === breaks.length) return { gte: breaks[i - 1], color, label: `≥ ${fmt(from)}` };
      return { gte: breaks[i - 1], lt: breaks[i], color, label: `${fmt(from)} – ${fmt(breaks[i])}` };
    });

    const seriesData = regions.map((geo) => {
      const border = geo === selected ? { borderColor: '#111', borderWidth: 2 } : {};
      if (!(geo in COUNTRY_NAMES)) {
        return { name: geo, value: NaN, itemStyle: { areaColor: CONTEXT }, emphasis: { disabled: true } };
      }
      const r = readMetric(data, metric, geo, year, perCapita);
      return r
        ? { name: geo, value: r.value, flag: r.flag, itemStyle: border }
        : { name: geo, value: NaN, itemStyle: { areaColor: NO_DATA, ...border } };
    });

    // Plain merge (no replaceMerge) keeps the user's zoom and pan while the year or metric changes.
    chart.setOption(
      {
        tooltip: {
          trigger: 'item',
          formatter: (p: { name: string; value: number; data: { flag?: string | null } }) => {
            const name = COUNTRY_NAMES[p.name];
            if (!name) return '';
            if (Number.isNaN(p.value)) return `<b>${name}</b><br>Dato non disponibile per il ${year}`;
            const flag = describeFlag(p.data.flag ?? null);
            return `<b>${name}</b><br>${formatValue(p.value, unit, decimals)}${flag ? ` <i>(${flag})</i>` : ''}`;
          },
        },
        visualMap: {
          type: 'piecewise',
          pieces,
          ...(compact.matches
            ? { orient: 'horizontal', left: 'center', bottom: 0, itemGap: 4, itemWidth: 8, itemHeight: 8, textStyle: { fontSize: 9 } }
            : { orient: 'vertical', left: 8, bottom: 8, itemGap: 10, itemWidth: 14, itemHeight: 10, textStyle: { fontSize: 11 } }),
          backgroundColor: 'rgba(255,255,255,0.85)',
          padding: 6,
        },
        series: [
          {
            type: 'map',
            map: 'europe',
            projection: {
              project: (p: number[]) => projection(p as [number, number])!,
              unproject: (p: number[]) => projection.invert!(p as [number, number])!,
            },
            // Slight zoom on central Europe: the canvas edge then crops the far east of the
            // clipped Russia/Turkey shapes cleanly.
            center: VIEW_CENTER,
            zoom: 1.15,
            // layoutSize is relative to the shorter side and keeps the aspect ratio; on narrow
            // screens the map moves up to leave room for the legend.
            layoutCenter: compact.matches ? ['50%', '46%'] : ['50%', '50%'],
            layoutSize: compact.matches ? '110%' : '100%',
            roam: true,
            scaleLimit: { min: 1, max: 8 },
            itemStyle: { borderColor: '#fff', borderWidth: 0.6, areaColor: NO_DATA },
            emphasis: { label: { show: false }, itemStyle: { areaColor: undefined, borderColor: '#333', borderWidth: 1.2 } },
            select: { disabled: true },
            label: { show: false },
            data: seriesData,
          },
        ],
      },
    );
  }

  return { render, onLayoutChange: (cb: () => void) => compact.addEventListener('change', cb) };
}
