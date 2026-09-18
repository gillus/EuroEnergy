// Downloads GISCO country boundaries, clips them to a European bounding box and writes
// public/geo/europe.json. Boundaries rarely change, so the output is committed and this script
// is run by hand only.
//
//   npm run geo

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from 'geojson';
import { COUNTRY_NAMES } from '../src/countries';

const URL = 'https://gisco-services.ec.europa.eu/distribution/v2/countries/geojson/CNTR_RG_20M_2024_4326.geojson';
const OUT = join(import.meta.dirname, '..', 'public', 'geo', 'europe.json');

// [west, south, east, north]: continental Europe, Iceland, Cyprus, Turkey; cuts Svalbard and
// overseas territories.
const BBOX = [-25, 34, 45, 71.5] as const;
const PRECISION = 100; // two decimals ≈ 1 km
// Once projected, a long straight edge in lon/lat becomes a visible straight cut: split edges into
// steps of at most this many degrees so clipped borders follow the projection's curvature.
const MAX_STEP = 0.5;

// Countries without Eurostat data drawn in grey for context: European neighbours and microstates.
// North Africa and the Middle East are left out so the map stays zoomed on Europe.
const CONTEXT = new Set(['RU', 'BY', 'AD', 'MC', 'SM', 'VA', 'FO', 'IM', 'JE', 'GG', 'GI']);

type Ring = Position[];

/** Sutherland–Hodgman clipping of one ring against the bounding box. */
function clipRing(ring: Ring): Ring {
  const edges: [(p: Position) => boolean, (a: Position, b: Position) => Position][] = [
    [(p) => p[0] >= BBOX[0], (a, b) => lerpX(a, b, BBOX[0])],
    [(p) => p[0] <= BBOX[2], (a, b) => lerpX(a, b, BBOX[2])],
    [(p) => p[1] >= BBOX[1], (a, b) => lerpY(a, b, BBOX[1])],
    [(p) => p[1] <= BBOX[3], (a, b) => lerpY(a, b, BBOX[3])],
  ];
  let out = ring;
  for (const [inside, intersect] of edges) {
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const cur = input[i];
      const prev = input[(i + input.length - 1) % input.length];
      if (inside(cur)) {
        if (!inside(prev)) out.push(intersect(prev, cur));
        out.push(cur);
      } else if (inside(prev)) {
        out.push(intersect(prev, cur));
      }
    }
    if (out.length === 0) break;
  }
  return out;
}

function lerpX(a: Position, b: Position, x: number): Position {
  return [x, a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0])];
}

function lerpY(a: Position, b: Position, y: number): Position {
  return [a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]), y];
}

function densify(ring: Ring): Ring {
  const out: Ring = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    out.push(a);
    const steps = Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) / MAX_STEP);
    for (let k = 1; k < steps; k++) out.push([a[0] + ((b[0] - a[0]) * k) / steps, a[1] + ((b[1] - a[1]) * k) / steps]);
  }
  return out;
}

/** Rounds coordinates and drops consecutive duplicates; returns null for degenerate rings. */
function simplifyRing(ring: Ring): Ring | null {
  const out: Ring = [];
  for (const [x, y] of ring) {
    const p = [Math.round(x * PRECISION) / PRECISION, Math.round(y * PRECISION) / PRECISION];
    const last = out[out.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  }
  if (out.length < 3) return null;
  out.push(out[0]); // close the ring again
  return out;
}

function processPolygon(rings: Ring[]): Ring[] | null {
  const outer = simplifyRing(densify(clipRing(rings[0])));
  if (!outer) return null;
  const holes = rings.slice(1).map((r) => simplifyRing(densify(clipRing(r)))).filter((r): r is Ring => r !== null);
  return [outer, ...holes];
}

async function main() {
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const world = (await res.json()) as FeatureCollection<Polygon | MultiPolygon>;

  const features: Feature<MultiPolygon, { id: string }>[] = [];
  for (const f of world.features) {
    const id: string = f.properties!.CNTR_ID;
    if (!(id in COUNTRY_NAMES) && !CONTEXT.has(id)) continue;
    const polygons = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    const clipped = polygons.map(processPolygon).filter((p): p is Ring[] => p !== null);
    if (clipped.length === 0) continue;
    features.push({
      type: 'Feature',
      // ECharts matches data to regions through `properties.name`, so it carries the geo code.
      properties: { id, name: id } as { id: string },
      geometry: { type: 'MultiPolygon', coordinates: clipped },
    });
  }

  await mkdir(join(OUT, '..'), { recursive: true });
  await writeFile(OUT, JSON.stringify({ type: 'FeatureCollection', features }));
  console.log(`${features.length} paesi scritti in ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
