// Shapes of the JSON files in public/data, produced by scripts/fetch-data.ts.

/** [value, Eurostat status flag or null] — flags: p provisional, e estimated, b break in series, ... */
export type Obs = [number, string | null];

/** geo code → year → observation */
export type Series = Record<string, Record<string, Obs>>;

export interface DataFile {
  dataset: string;
  unit: string;
  /** Variant key (e.g. a sub-indicator or a fuel) → series */
  series: Record<string, Series>;
}

export interface Meta {
  fetchedAt: string;
  datasets: Record<string, { label: string; updated: string }>;
}
