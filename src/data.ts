import type { DataFile, Meta } from './types';

export interface Data {
  renewables: DataFile;
  electricity: DataFile;
  consumption: DataFile;
  importDependency: DataFile;
  population: DataFile;
  meta: Meta;
}

async function load<T>(path: string): Promise<T> {
  const res = await fetch(`${import.meta.env.BASE_URL}${path}`);
  if (!res.ok) throw new Error(`Impossibile caricare ${path} (HTTP ${res.status})`);
  return res.json() as Promise<T>;
}

export async function loadData(): Promise<Data> {
  const [renewables, electricity, consumption, importDependency, population, meta] = await Promise.all([
    load<DataFile>('data/renewables.json'),
    load<DataFile>('data/electricity.json'),
    load<DataFile>('data/consumption.json'),
    load<DataFile>('data/import-dependency.json'),
    load<DataFile>('data/population.json'),
    load<Meta>('data/meta.json'),
  ]);
  return { renewables, electricity, consumption, importDependency, population, meta };
}

export function population(data: Data, geo: string, year: string): number | undefined {
  return data.population.series.NR?.[geo]?.[year]?.[0];
}
