const formatters = new Map<number, Intl.NumberFormat>();

export function formatNumber(value: number, decimals: number): string {
  let f = formatters.get(decimals);
  if (!f) {
    f = new Intl.NumberFormat('it-IT', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    formatters.set(decimals, f);
  }
  return f.format(value);
}

export function formatValue(value: number, unit: string, decimals: number): string {
  return unit === '%' ? `${formatNumber(value, decimals)}%` : `${formatNumber(value, decimals)} ${unit}`;
}

const FLAG_LABELS: Record<string, string> = {
  p: 'provvisorio',
  e: 'stima',
  b: 'discontinuità nella serie',
  d: 'definizione diversa',
  c: 'confidenziale',
  u: 'bassa affidabilità',
};

/** Eurostat flags may combine letters, e.g. "bep". */
export function describeFlag(flag: string | null): string {
  if (!flag) return '';
  return [...flag].map((c) => FLAG_LABELS[c] ?? c).join(', ');
}

export function formatDate(iso: string): string {
  // Eurostat writes offsets as +0200; Safari only parses the ISO form +02:00.
  return new Date(iso.replace(/([+-]\d\d)(\d\d)$/, '$1:$2')).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
}
