import { describe, expect, it } from 'vitest';
import { parseJsonStat, type JsonStatDataset } from '../scripts/lib/jsonstat';
import fixture from './fixtures/nrg_ind_ren.json';

describe('parseJsonStat', () => {
  const cells = parseJsonStat(fixture as unknown as JsonStatDataset);
  const find = (nrg_bal: string, geo: string, time: string) =>
    cells.find((c) => c.dims.nrg_bal === nrg_bal && c.dims.geo === geo && c.dims.time === time);

  it('returns one cell per value', () => {
    expect(cells).toHaveLength(12);
  });

  it('maps flat indices back to dimension codes (row-major, last dimension fastest)', () => {
    expect(find('REN', 'FR', '2023')?.value).toBe(22.462);
    expect(find('REN', 'IT', '2023')?.value).toBe(19.179);
    expect(find('REN_ELC', 'FR', '2024')?.value).toBe(31.344);
    expect(find('REN_ELC', 'IT', '2025')?.value).toBe(43.5);
  });

  it('attaches status flags', () => {
    expect(find('REN', 'IT', '2025')?.flag).toBe('p');
    expect(find('REN', 'IT', '2024')?.flag).toBeNull();
  });

  it('keeps flagged cells that have no value', () => {
    const ds: JsonStatDataset = {
      label: 't',
      updated: '',
      id: ['geo', 'time'],
      size: [1, 2],
      dimension: {
        geo: { label: 'geo', category: { index: { IT: 0 }, label: { IT: 'Italy' } } },
        time: { label: 'time', category: { index: { '2022': 0, '2023': 1 }, label: { '2022': '2022', '2023': '2023' } } },
      },
      value: { 0: 1 },
      status: { 1: 'c' },
    };
    expect(parseJsonStat(ds)).toEqual([
      { dims: { geo: 'IT', time: '2022' }, value: 1, flag: null },
      { dims: { geo: 'IT', time: '2023' }, value: null, flag: 'c' },
    ]);
  });
});
