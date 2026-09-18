// Minimal parser for the JSON-stat 2.0 responses of the Eurostat dissemination API.
// Values and status flags are sparse objects keyed by the flat (row-major) cell index.

export interface JsonStatDataset {
  label: string;
  updated: string;
  id: string[];
  size: number[];
  dimension: Record<string, { label: string; category: { index: Record<string, number>; label: Record<string, string> } }>;
  value: Record<string, number> | number[];
  status?: Record<string, string> | string[];
}

export interface Cell {
  dims: Record<string, string>;
  value: number | null;
  flag: string | null;
}

export function parseJsonStat(ds: JsonStatDataset): Cell[] {
  // Category codes ordered by their position along each dimension.
  const codes = ds.id.map((dim) => {
    const index = ds.dimension[dim].category.index;
    const ordered: string[] = [];
    for (const [code, pos] of Object.entries(index)) ordered[pos] = code;
    return ordered;
  });

  const cells: Cell[] = [];
  const indices = new Set<number>([
    ...Object.keys(ds.value).map(Number),
    ...Object.keys(ds.status ?? {}).map(Number),
  ]);
  for (const flat of [...indices].sort((a, b) => a - b)) {
    const dims: Record<string, string> = {};
    let rest = flat;
    for (let d = ds.id.length - 1; d >= 0; d--) {
      dims[ds.id[d]] = codes[d][rest % ds.size[d]];
      rest = Math.floor(rest / ds.size[d]);
    }
    const raw = (ds.value as Record<number, number | null>)[flat];
    const flag = (ds.status as Record<number, string> | undefined)?.[flat] ?? null;
    cells.push({ dims, value: raw ?? null, flag });
  }
  return cells;
}
