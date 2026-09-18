// Electricity generation sources, built from SIEC codes of Eurostat dataset nrg_bal_peh.
// Shared by the data pipeline (which computes each source) and the frontend (labels, colors).
// RA100 (hydro) already excludes pumped storage (RA130); RA000 = RA100 + RA200 + RA300 + RA4xx + BIOE.
// Solid fossil fuels also include manufactured gases, peat and oil shale (relevant for Estonia).

export interface MixSource {
  key: string;
  label: string;
  color: string;
  siec: string[];
  renewable: boolean;
}

export const MIX_SOURCES: MixSource[] = [
  { key: 'nuclear', label: 'Nucleare', color: '#8e6cc9', siec: ['N900H'], renewable: false },
  { key: 'gas', label: 'Gas naturale', color: '#e8a33d', siec: ['G3000'], renewable: false },
  { key: 'coal', label: 'Carbone e altri solidi fossili', color: '#5b5550', siec: ['C0000X0350-0370', 'C0350-0370', 'P1000', 'S2000'], renewable: false },
  { key: 'oil', label: 'Petrolio', color: '#a0522d', siec: ['O4000XBIO'], renewable: false },
  { key: 'hydro', label: 'Idroelettrico', color: '#3a7dc9', siec: ['RA100'], renewable: true },
  { key: 'pumped', label: 'Pompaggio idroelettrico', color: '#9dbde0', siec: ['RA130'], renewable: false },
  { key: 'wind', label: 'Eolico', color: '#5bb5c9', siec: ['RA300'], renewable: true },
  { key: 'solar', label: 'Solare', color: '#f2cc38', siec: ['RA410', 'RA420'], renewable: true },
  { key: 'geothermal', label: 'Geotermico', color: '#d9644a', siec: ['RA200'], renewable: true },
  { key: 'bio', label: 'Bioenergie', color: '#6aa84f', siec: ['BIOE'], renewable: true },
  { key: 'waste', label: 'Rifiuti non rinnovabili', color: '#9c9c7a', siec: ['W6100_6220'], renewable: false },
];

/** Remainder: total minus all the sources above (manufactured gases, other fuels, batteries…). */
export const MIX_OTHER = { key: 'other', label: 'Altro', color: '#c4c4c4' };

export const MIX_TOTAL_SIEC = 'TOTAL';
