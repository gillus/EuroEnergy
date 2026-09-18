// Registry of what can be shown on the map. A group is an entry of the "Indicatore" menu, a metric
// one of its variants. Every metric reads the raw files through `value`; per-capita values are
// derived here from the population series so every chart treats them the same way.

import { population, type Data } from './data';
import { MIX_OTHER, MIX_SOURCES } from './mix';
import type { Obs, Series } from './types';

export type GroupId = 'renewables' | 'electricity' | 'consumption' | 'imports';

export interface Metric {
  id: string;
  group: GroupId;
  label: string;
  unit: string;
  decimals: number;
  description: string;
  /** Sequential palette, one color per class of the map legend. */
  palette: string[];
  /** Fixed class breaks; when absent they are derived from the data distribution. */
  breaks?: number[];
  /** Lower bound of the ranking axis, so one extreme outlier doesn't flatten every other bar. */
  axisFloor?: number;
  /** Enables the per-capita toggle: value × factor / population. */
  perCapita?: { unit: string; decimals: number; factor: number };
  value(data: Data, geo: string, year: string): Obs | undefined;
}

export interface Group {
  id: GroupId;
  label: string;
  dataset: string;
  metrics: Metric[];
}

const GREENS = ['#edf8e9', '#c7e9c0', '#a1d99b', '#74c476', '#41ab5d', '#238b45', '#005a32'];
const BLUES = ['#eff3ff', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#084594'];
const ORANGES = ['#feedde', '#fdd0a2', '#fdae6b', '#fd8d3c', '#f16913', '#d94801', '#8c2d04'];
// Diverging: blue for net exporters (negative dependency), reds for importers.
const DEPENDENCY = ['#2166ac', '#fee5d9', '#fcbba1', '#fc9272', '#fb6a4a', '#de2d26', '#a50f15'];

function fromSeries(series: Series | undefined, geo: string, year: string): Obs | undefined {
  return series?.[geo]?.[year];
}

/**
 * Palette for the share of an electricity source: near-white → source color → darkened source
 * color, so light hues like solar yellow still have visibly distinct classes.
 */
function ramp(color: string, steps = 7): string[] {
  const hex = (s: string) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
  const light = hex('#f6f6f2');
  const mid = hex(color);
  const dark = mid.map((c) => c * 0.55);
  const mix = (a: number[], b: number[], t: number) => a.map((c, k) => Math.round(c + (b[k] - c) * t));
  return Array.from({ length: steps }, (_, i) => {
    const t = i / (steps - 1);
    const rgb = t <= 0.6 ? mix(light, mid, t / 0.6) : mix(mid, dark, (t - 0.6) / 0.4);
    return `rgb(${rgb.join(',')})`;
  });
}

/** Share (%) of some mix components over total production. */
function electricityShare(keys: string[]) {
  return (data: Data, geo: string, year: string): Obs | undefined => {
    const total = fromSeries(data.electricity.series.total, geo, year);
    if (!total || total[0] <= 0) return undefined;
    let sum = 0;
    let flag = total[1];
    for (const k of keys) {
      const obs = fromSeries(data.electricity.series[k], geo, year);
      if (!obs) return undefined;
      sum += obs[0];
      flag ??= obs[1];
    }
    return [(100 * sum) / total[0], flag];
  };
}

const renewable = (code: string, label: string, description: string): Metric => ({
  id: `ren-${code}`,
  group: 'renewables',
  label,
  unit: '%',
  decimals: 1,
  description,
  palette: GREENS,
  value: (d, geo, year) => fromSeries(d.renewables.series[code], geo, year),
});

const dependency = (code: string, label: string): Metric => ({
  id: `imp-${code}`,
  group: 'imports',
  label,
  unit: '%',
  decimals: 1,
  description:
    'Importazioni nette in rapporto all\'energia lorda disponibile. Valori negativi: esportatore netto; oltre 100%: accumulo di scorte.',
  palette: DEPENDENCY,
  breaks: [0, 20, 40, 60, 80, 95],
  axisFloor: -100, // Norway is around -500%
  value: (d, geo, year) => fromSeries(d.importDependency.series[code], geo, year),
});

const consumption = (code: string, label: string, description: string): Metric => ({
  id: `cons-${code}`,
  group: 'consumption',
  label,
  unit: 'Mtep',
  decimals: 1,
  description,
  palette: ORANGES,
  perCapita: { unit: 'tep/ab', decimals: 2, factor: 1e6 },
  value: (d, geo, year) => fromSeries(d.consumption.series[code], geo, year),
});

export const GROUPS: Group[] = [
  {
    id: 'renewables',
    label: 'Quota di energia rinnovabile',
    dataset: 'nrg_ind_ren',
    metrics: [
      renewable('REN', 'Totale', 'Quota di rinnovabili sul consumo finale lordo di energia (indicatore dei target UE).'),
      renewable('REN_ELC', 'Elettricità', 'Quota di rinnovabili nel consumo lordo di elettricità.'),
      renewable('REN_HEAT_CL', 'Riscaldamento e raffreddamento', 'Quota di rinnovabili nel riscaldamento e raffreddamento.'),
      renewable('REN_TRA', 'Trasporti', 'Quota di rinnovabili nei trasporti.'),
    ],
  },
  {
    id: 'electricity',
    label: 'Produzione elettrica',
    dataset: 'nrg_bal_peh',
    metrics: [
      {
        id: 'elc-total',
        group: 'electricity',
        label: 'Produzione totale',
        unit: 'TWh',
        decimals: 1,
        description: 'Produzione lorda di elettricità.',
        palette: BLUES,
        perCapita: { unit: 'MWh/ab', decimals: 1, factor: 1e6 },
        value: (d, geo, year) => {
          const obs = fromSeries(d.electricity.series.total, geo, year);
          return obs && [obs[0] / 1000, obs[1]];
        },
      },
      {
        id: 'elc-fossil',
        group: 'electricity',
        label: 'Quota fossili',
        unit: '%',
        decimals: 1,
        description: 'Quota di gas, carbone e petrolio nella produzione lorda di elettricità.',
        palette: ramp('#5b5550'),
        value: electricityShare(['gas', 'coal', 'oil']),
      },
      ...[...MIX_SOURCES, MIX_OTHER].map(
        (s): Metric => ({
          id: `elc-${s.key}`,
          group: 'electricity',
          label: `Quota ${s.label.toLowerCase()}`,
          unit: '%',
          decimals: 1,
          description: `Quota della fonte "${s.label}" nella produzione lorda di elettricità.`,
          palette: ramp(s.color),
          value: electricityShare([s.key]),
        }),
      ),
    ],
  },
  {
    id: 'consumption',
    label: 'Consumi energetici',
    dataset: 'nrg_ind_eff',
    metrics: [
      consumption('PEC_EED', 'Consumo di energia primaria', 'Consumo di energia primaria (definizione della direttiva Efficienza energetica).'),
      consumption('FEC_EED', 'Consumo finale di energia', 'Consumo finale di energia (definizione della direttiva Efficienza energetica).'),
    ],
  },
  {
    id: 'imports',
    label: 'Dipendenza dalle importazioni',
    dataset: 'nrg_ind_id',
    metrics: [
      dependency('TOTAL', 'Tutti i prodotti energetici'),
      dependency('G3000', 'Gas naturale'),
      dependency('O4000XBIO', 'Petrolio e derivati'),
      dependency('C0000X0350-0370', 'Combustibili fossili solidi'),
    ],
  },
];

export const METRICS = new Map(GROUPS.flatMap((g) => g.metrics).map((m) => [m.id, m]));

export interface Reading {
  value: number;
  flag: string | null;
  unit: string;
  decimals: number;
}

/** Value of a metric, optionally per capita; undefined when Eurostat has no data. */
export function readMetric(data: Data, metric: Metric, geo: string, year: string, perCapita: boolean): Reading | undefined {
  const obs = metric.value(data, geo, year);
  if (!obs) return undefined;
  if (perCapita && metric.perCapita) {
    const pop = population(data, geo, year);
    if (!pop) return undefined;
    const { unit, decimals, factor } = metric.perCapita;
    return { value: (obs[0] * factor) / pop, flag: obs[1], unit, decimals };
  }
  return { value: obs[0], flag: obs[1], unit: metric.unit, decimals: metric.decimals };
}

/** Years for which the metric has at least one value, ascending. */
export function metricYears(data: Data, metric: Metric, geos: readonly string[]): string[] {
  const years = new Set<string>();
  for (let y = 2000; y <= new Date().getFullYear(); y++) {
    const year = String(y);
    if (geos.some((g) => metric.value(data, g, year))) years.add(year);
  }
  return [...years];
}
