import type { LineSeriesOption } from 'echarts/charts';
import { createChart } from './echarts';
import { COUNTRY_NAMES, EU_AGGREGATE } from './countries';
import type { Data } from './data';
import { formatNumber, formatValue } from './format';
import { GROUPS, readMetric, type Metric } from './indicators';
import { classColors, colorFor, type MapState } from './map';
import { MIX_OTHER, MIX_SOURCES } from './mix';

const COUNTRY_COLOR = '#1d4e89';
const EU_COLOR = '#8a8a8a';
const LINE_COLORS = ['#1d4e89', '#2a9d8f', '#e9a03b', '#c8553d'];

const axisLabel = { fontSize: 11, color: '#555' };
const grid = { left: 48, right: 16, top: 36, bottom: 28 };

function unitOf(metric: Metric, perCapita: boolean) {
  return perCapita && metric.perCapita ? metric.perCapita : { unit: metric.unit, decimals: metric.decimals };
}

function yearMarker(year: string) {
  return {
    silent: true,
    symbol: 'none',
    lineStyle: { color: '#bbb', type: 'solid' as const },
    label: { show: false },
    data: [{ xAxis: year }],
  };
}

export function detailTitle(metric: Metric): string {
  switch (metric.group) {
    case 'electricity':
      return 'Produzione elettrica per fonte (TWh)';
    case 'renewables':
      return 'Quota rinnovabili per settore';
    case 'consumption':
      return 'Energia primaria e finale';
    case 'imports':
      return 'Dipendenza per prodotto';
  }
}

export function createCharts(
  trendEl: HTMLElement,
  detailEl: HTMLElement,
  rankingEl: HTMLElement,
  onSelect: (geo: string) => void,
) {
  const trend = createChart(trendEl);
  const detail = createChart(detailEl);
  const ranking = createChart(rankingEl);

  // Rebuild the charts only when what they plot changes; a year change merges into the existing
  // option, so the year marker and the ranking bars move without replaying the entry animation.
  let lastKey = '';
  let opts = { notMerge: true };

  ranking.on('click', (p) => {
    const geo = (p.data as { geo?: string } | undefined)?.geo;
    if (geo) onSelect(geo);
  });

  function renderTrend(data: Data, state: MapState, years: string[]) {
    const { metric, perCapita, selected } = state;
    const { unit, decimals } = unitOf(metric, perCapita);
    const line = (geo: string) => years.map((y) => readMetric(data, metric, geo, y, perCapita)?.value ?? null);
    const series: LineSeriesOption[] = [
      {
        name: COUNTRY_NAMES[selected],
        type: 'line',
        data: line(selected),
        color: COUNTRY_COLOR,
        symbolSize: 4,
        connectNulls: false,
        markLine: yearMarker(state.year),
      },
    ];
    if (selected !== EU_AGGREGATE) {
      series.push({
        name: 'UE 27',
        type: 'line',
        data: line(EU_AGGREGATE),
        color: EU_COLOR,
        symbolSize: 0,
        connectNulls: false,
        lineStyle: { type: 'dashed' },
      });
    }
    trend.setOption(
      {
        grid,
        legend: { top: 0, textStyle: { fontSize: 11 } },
        tooltip: {
          trigger: 'axis',
          valueFormatter: (v: number | null) => (v == null ? 'n.d.' : formatValue(v, unit, decimals)),
        },
        xAxis: { type: 'category', data: years, axisLabel },
        yAxis: { type: 'value', name: unit, nameTextStyle: axisLabel, axisLabel, scale: unit !== '%' },
        series,
      },
      opts,
    );
  }

  function renderElectricityMix(data: Data, state: MapState, years: string[]) {
    const sources = [...MIX_SOURCES, MIX_OTHER];
    detail.setOption(
      {
        grid: { ...grid, top: 70 },
        legend: { top: 0, type: 'plain', itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 10 } },
        tooltip: {
          trigger: 'axis',
          order: 'seriesDesc',
          valueFormatter: (v: number | null) => (v == null ? 'n.d.' : `${formatNumber(v, 1)} TWh`),
        },
        xAxis: { type: 'category', data: years, axisLabel, boundaryGap: false },
        yAxis: { type: 'value', name: 'TWh', nameTextStyle: axisLabel, axisLabel },
        series: sources.map((s, i) => ({
          name: s.label,
          type: 'line',
          stack: 'mix',
          areaStyle: { opacity: 0.9 },
          lineStyle: { width: 0 },
          symbol: 'none',
          color: s.color,
          data: years.map((y) => {
            const obs = data.electricity.series[s.key]?.[state.selected]?.[y];
            return obs ? obs[0] / 1000 : null;
          }),
          markLine: i === 0 ? yearMarker(state.year) : undefined,
        })),
      },
      opts,
    );
  }

  function renderVariants(data: Data, state: MapState, years: string[]) {
    const metrics = GROUPS.find((g) => g.id === state.metric.group)!.metrics;
    const { unit, decimals } = unitOf(state.metric, state.perCapita);
    detail.setOption(
      {
        grid: { ...grid, top: 48 },
        legend: { top: 0, textStyle: { fontSize: 11 } },
        tooltip: {
          trigger: 'axis',
          valueFormatter: (v: number | null) => (v == null ? 'n.d.' : formatValue(v, unit, decimals)),
        },
        xAxis: { type: 'category', data: years, axisLabel },
        yAxis: { type: 'value', name: unit, nameTextStyle: axisLabel, axisLabel, scale: unit !== '%' },
        series: metrics.map((m, i) => ({
          name: m.label,
          type: 'line',
          color: LINE_COLORS[i % LINE_COLORS.length],
          symbolSize: 3,
          lineStyle: { width: m.id === state.metric.id ? 3 : 1.5 },
          data: years.map((y) => readMetric(data, m, state.selected, y, state.perCapita)?.value ?? null),
          markLine: i === 0 ? yearMarker(state.year) : undefined,
        })),
      },
      opts,
    );
  }

  function renderRanking(data: Data, state: MapState, breaks: number[]) {
    const { metric, year, perCapita, selected } = state;
    const { unit, decimals } = unitOf(metric, perCapita);
    const colors = classColors(metric, breaks);
    const rows = Object.keys(COUNTRY_NAMES)
      .map((geo) => ({ geo, r: readMetric(data, metric, geo, year, perCapita) }))
      .filter((row) => row.r)
      .sort((a, b) => b.r!.value - a.r!.value);

    ranking.setOption(
      {
        grid: { left: 48, right: 16, top: 32, bottom: 40 },
        tooltip: {
          trigger: 'item',
          formatter: (p: { data: { geo: string; value: number } }) =>
            `<b>${COUNTRY_NAMES[p.data.geo]}</b><br>${formatValue(p.data.value, unit, decimals)}`,
        },
        xAxis: {
          type: 'category',
          data: rows.map((row) => (row.geo === EU_AGGREGATE ? 'UE27' : row.geo)),
          axisLabel: { ...axisLabel, interval: 0, rotate: 90, fontSize: 10 },
        },
        yAxis: {
          type: 'value',
          name: unit,
          nameTextStyle: axisLabel,
          axisLabel,
          min: metric.axisFloor === undefined ? undefined : ({ min }: { min: number }) => Math.max(min, metric.axisFloor!),
        },
        series: [
          {
            type: 'bar',
            barCategoryGap: '20%',
            data: rows.map(({ geo, r }) => ({
              geo,
              value: r!.value,
              itemStyle: {
                color: geo === EU_AGGREGATE ? EU_COLOR : colorFor(colors, breaks, r!.value),
                borderColor: geo === selected ? '#111' : 'transparent',
                borderWidth: geo === selected ? 2 : 0,
              },
            })),
          },
        ],
      },
      opts,
    );
  }

  function render(data: Data, state: MapState, years: string[], breaks: number[]) {
    const key = `${state.metric.id}|${state.selected}|${state.perCapita}`;
    opts = { notMerge: key !== lastKey };
    lastKey = key;
    renderTrend(data, state, years);
    if (state.metric.group === 'electricity') renderElectricityMix(data, state, years);
    else renderVariants(data, state, years);
    renderRanking(data, state, breaks);
  }

  return { render };
}
