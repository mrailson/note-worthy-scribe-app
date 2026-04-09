import { ENN_ODS_CODES } from './ennPractices';

/** The 7 NRES neighbourhood practices */
export const NRES_PRACTICES = {
  parks: 'The Parks Medical Practice',
  brackley: 'Brackley Medical Centre',
  springfield: 'Springfield Surgery',
  towcester: 'Towcester Medical Centre',
  bugbrooke: 'Bugbrooke Medical Practice',
  brook: 'Brook Health Centre',
  denton: 'Denton Village Surgery',
} as const;

export type NRESPracticeKey = keyof typeof NRES_PRACTICES;

export const NRES_PRACTICE_KEYS = Object.keys(NRES_PRACTICES) as NRESPracticeKey[];

export const NRES_ODS_CODES: Record<NRESPracticeKey, string> = {
  parks: 'K83052',
  brackley: 'K83049',
  springfield: 'K83018',
  towcester: 'K83022',
  bugbrooke: 'K83070',
  brook: 'K83620',
  denton: 'K83068',
};

/** Get the display name for a practice key, checking both NRES and ENN practices */
export function getPracticeName(key: string | null | undefined): string {
  if (!key) return '—';
  if (key in NRES_PRACTICES) return NRES_PRACTICES[key as NRESPracticeKey];
  return key;
}

/** Get the ODS code for a practice key */
export function getOdsCode(key: string | null | undefined): string {
  if (!key) return '—';
  if (key in NRES_ODS_CODES) return NRES_ODS_CODES[key as NRESPracticeKey];
  // Also check ENN
  if (key in ENN_ODS_CODES) return ENN_ODS_CODES[key as keyof typeof ENN_ODS_CODES];
  return key;
}
