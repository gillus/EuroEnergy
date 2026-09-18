// Countries shown on the map, keyed by Eurostat geo code (EL = Greece, UK = United Kingdom).
// Shared by the data pipeline (scripts/) and the frontend.

export const EU27 = [
  'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'EL', 'ES', 'FI', 'FR', 'HR', 'HU',
  'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK',
] as const;

export const COUNTRY_NAMES: Record<string, string> = {
  AT: 'Austria', BE: 'Belgio', BG: 'Bulgaria', CY: 'Cipro', CZ: 'Cechia', DE: 'Germania',
  DK: 'Danimarca', EE: 'Estonia', EL: 'Grecia', ES: 'Spagna', FI: 'Finlandia', FR: 'Francia',
  HR: 'Croazia', HU: 'Ungheria', IE: 'Irlanda', IT: 'Italia', LT: 'Lituania', LU: 'Lussemburgo',
  LV: 'Lettonia', MT: 'Malta', NL: 'Paesi Bassi', PL: 'Polonia', PT: 'Portogallo', RO: 'Romania',
  SE: 'Svezia', SI: 'Slovenia', SK: 'Slovacchia',
  IS: 'Islanda', NO: 'Norvegia', CH: 'Svizzera', LI: 'Liechtenstein', UK: 'Regno Unito',
  AL: 'Albania', BA: 'Bosnia ed Erzegovina', ME: 'Montenegro', MK: 'Macedonia del Nord',
  RS: 'Serbia', XK: 'Kosovo', TR: 'Turchia', UA: 'Ucraina', MD: 'Moldavia', GE: 'Georgia',
  EU27_2020: 'Unione Europea (27)',
};

/** Aggregate used as the EU reference line in the charts. */
export const EU_AGGREGATE = 'EU27_2020';

/** Every geo code the pipeline keeps from Eurostat responses. */
export const GEO_CODES = Object.keys(COUNTRY_NAMES);
