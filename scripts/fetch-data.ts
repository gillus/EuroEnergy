// Downloads the Eurostat datasets used by the dashboard and writes compact JSON files to public/data.
// Nothing is written unless every dataset downloads successfully, so a failed run keeps the old data.
//
//   npm run data

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseJsonStat, type Cell, type JsonStatDataset } from './lib/jsonstat';
import { EU27, EU_AGGREGATE, GEO_CODES } from '../src/countries';
import { MIX_OTHER, MIX_SOURCES, MIX_TOTAL_SIEC } from '../src/mix';
import type { DataFile, Meta, Obs, Series } from '../src/types';

const API = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data';
const SINCE = '2000';
const OUT_DIR = join(import.meta.dirname, '..', 'public', 'data');
const GEOS = new Set(GEO_CODES);

const meta: Meta = { fetchedAt: new Date().toISOString(), datasets: {} };

async function fetchDataset(code: string, filters: Record<string, string | string[]>): Promise<Cell[]> {
  const params = new URLSearchParams({ format: 'JSON', lang: 'EN', sinceTimePeriod: SINCE });
  for (const [dim, values] of Object.entries(filters)) {
    for (const v of [values].flat()) params.append(dim, v);
  }
  const url = `${API}/${code}?${params}`;

  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const ds = (await res.json()) as JsonStatDataset;
      meta.datasets[code] = { label: ds.label, updated: ds.updated };
      const cells = parseJsonStat(ds).filter((c) => GEOS.has(c.dims.geo));
      console.log(`${code}: ${cells.length} celle (aggiornato ${ds.updated})`);
      return cells;
    } catch (err) {
      if (attempt >= 3) throw new Error(`${code}: ${(err as Error).message}`);
      console.warn(`${code}: tentativo ${attempt} fallito, riprovo…`);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Groups cells into series keyed by the value of `variantDim`. Cells without a value are dropped. */
function toSeries(cells: Cell[], variantDim: string): Record<string, Series> {
  const out: Record<string, Series> = {};
  for (const c of cells) {
    if (c.value === null) continue;
    const variant = (out[c.dims[variantDim]] ??= {});
    (variant[c.dims.geo] ??= {})[c.dims.time] = [round(c.value), c.flag];
  }
  return out;
}

/** Combines nrg_bal_peh SIEC series into the electricity sources of MIX_SOURCES, plus total and remainder. */
function buildMix(bySiec: Record<string, Series>): Record<string, Series> {
  const total = bySiec[MIX_TOTAL_SIEC] ?? {};
  const out: Record<string, Series> = { total };
  for (const s of [...MIX_SOURCES.map((s) => s.key), MIX_OTHER.key]) out[s] = {};

  for (const [geo, years] of Object.entries(total)) {
    for (const [year, [tot, totFlag]] of Object.entries(years)) {
      let sum = 0;
      for (const src of MIX_SOURCES) {
        let v = 0;
        let flag: string | null = null;
        for (const siec of src.siec) {
          const obs: Obs | undefined = bySiec[siec]?.[geo]?.[year];
          if (obs) {
            v += obs[0];
            flag ??= obs[1];
          }
        }
        v = round(v);
        sum += v;
        (out[src.key][geo] ??= {})[year] = [v, flag];
      }
      (out[MIX_OTHER.key][geo] ??= {})[year] = [Math.max(0, round(tot - sum)), totFlag];
    }
  }

  // Eurostat does not publish every SIEC code for the EU aggregate (e.g. BIOE), which would push
  // bioenergy into "other". Rebuild the aggregate as the sum of member states when all 27 report.
  for (const series of Object.values(out)) {
    const years = Object.keys(series[EU_AGGREGATE] ?? {});
    for (const year of years) {
      const obs = EU27.map((geo) => series[geo]?.[year]);
      if (obs.every(Boolean)) series[EU_AGGREGATE][year] = [round(obs.reduce((s, o) => s + o![0], 0)), null];
    }
  }
  return out;
}

async function main() {
  const siecCodes = [MIX_TOTAL_SIEC, ...MIX_SOURCES.flatMap((s) => s.siec)];

  const [ren, peh, eff, dep, pop] = await Promise.all([
    fetchDataset('nrg_ind_ren', { nrg_bal: ['REN', 'REN_ELC', 'REN_HEAT_CL', 'REN_TRA'], unit: 'PC' }),
    fetchDataset('nrg_bal_peh', { nrg_bal: 'GEP', unit: 'GWH', siec: siecCodes }),
    fetchDataset('nrg_ind_eff', { nrg_bal: ['PEC_EED', 'FEC_EED'], unit: 'MTOE' }),
    fetchDataset('nrg_ind_id', { siec: ['TOTAL', 'G3000', 'O4000XBIO', 'C0000X0350-0370'], unit: 'PC' }),
    fetchDataset('demo_pjan', { age: 'TOTAL', sex: 'T', unit: 'NR' }),
  ]);

  const files: Record<string, DataFile> = {
    'renewables.json': { dataset: 'nrg_ind_ren', unit: '%', series: toSeries(ren, 'nrg_bal') },
    'electricity.json': { dataset: 'nrg_bal_peh', unit: 'GWh', series: buildMix(toSeries(peh, 'siec')) },
    'consumption.json': { dataset: 'nrg_ind_eff', unit: 'Mtep', series: toSeries(eff, 'nrg_bal') },
    'import-dependency.json': { dataset: 'nrg_ind_id', unit: '%', series: toSeries(dep, 'siec') },
    'population.json': { dataset: 'demo_pjan', unit: 'persone', series: toSeries(pop, 'unit') },
  };

  for (const [name, file] of Object.entries(files)) {
    if (Object.keys(file.series).length === 0) throw new Error(`${name}: nessun dato`);
  }

  await mkdir(OUT_DIR, { recursive: true });
  for (const [name, file] of Object.entries(files)) {
    await writeFile(join(OUT_DIR, name), JSON.stringify(file));
  }
  await writeFile(join(OUT_DIR, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
  console.log(`Scritti ${Object.keys(files).length + 1} file in ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
